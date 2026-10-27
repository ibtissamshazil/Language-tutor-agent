import { Router } from "express";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { RequestEmailCodeBody, VerifyEmailCodeBody } from "@workspace/api-zod";
import { credentialLimit, takeAuthAttempt } from "../lib/auth-rate-limit";
import { emailDeliveryConfigured, sendSignInCode } from "../lib/email-delivery";
import { establishSession, hashPassword, revokeActiveStreams } from "../lib/auth";
import { verifiedAccount } from "../lib/verified-account";

function codeHash(id: string, code: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  return createHmac("sha256", process.env.SESSION_SECRET).update(`${id}:${code}`).digest("hex");
}

export function emailCodeRouter(deliver = sendSignInCode, configured = emailDeliveryConfigured) {
  const router = Router();
  router.post("/request", credentialLimit, async (req, res) => {
    const parsed = RequestEmailCodeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Enter a valid email address." }); return; }
    if (!configured() || !process.env.SESSION_SECRET) {
      res.status(503).json({ error: "Email sign-in is not configured yet. Please use password sign-in for now." }); return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    if (!await takeAuthAttempt(`email-cooldown:${email}`, 1, 60) ||
        !await takeAuthAttempt(`email-hour:${email}`, 5, 3600)) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Please wait before requesting another code." }); return;
    }
    const id = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    // A resend invalidates earlier codes, including codes sent from another tab.
    await pool.query("UPDATE email_challenges SET consumed_at=now() WHERE email=$1 AND consumed_at IS NULL", [email]);
    await pool.query("INSERT INTO email_challenges(id,email,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
      [id, email, codeHash(id, code)]);
    try { await deliver(email, code); }
    catch {
      await pool.query("UPDATE email_challenges SET consumed_at=now() WHERE id=$1", [id]);
      // SMTP errors can contain credentials, addresses or message text: never log them.
      res.status(503).json({ error: "We could not send your code. Please try again later or use another sign-in method." }); return;
    }
    // Opportunistic cleanup; no stored raw codes, and expired records are not needed.
    await pool.query("DELETE FROM email_challenges WHERE expires_at<now()-interval '1 day'");
    await pool.query("DELETE FROM auth_rate_limits WHERE expires_at<now()-interval '1 day'");
    res.json({ challengeId: id, expiresInSeconds: 600, resendAfterSeconds: 60 });
  });
  router.post("/verify", credentialLimit, async (req, res) => {
    const parsed = VerifyEmailCodeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Enter the six-digit code from your email." }); return; }
    const { challengeId, code, password } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [challenge] } = await client.query(
        "SELECT * FROM email_challenges WHERE id=$1 FOR UPDATE", [challengeId]);
      if (!challenge || challenge.consumed_at || challenge.expires_at <= new Date() || challenge.attempts >= 5) {
        await client.query("ROLLBACK");
        res.status(401).json({ error: "This code is invalid or expired. Request a new code." }); return;
      }
      if (!timingSafeEqual(Buffer.from(challenge.code_hash, "hex"), Buffer.from(codeHash(challengeId, code), "hex"))) {
        await client.query("UPDATE email_challenges SET attempts=attempts+1 WHERE id=$1", [challengeId]);
        await client.query("COMMIT");
        res.status(401).json({ error: "This code is invalid or expired. Request a new code." }); return;
      }
      await client.query("UPDATE email_challenges SET consumed_at=now() WHERE id=$1", [challengeId]);
      const result = await verifiedAccount(client, challenge.email, password ? await hashPassword(password) : undefined);
      await client.query("COMMIT");
      result.revoked.forEach(revokeActiveStreams);
      await establishSession(req, res, result.user.id);
      res.json({ user: result.user });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  });
  return router;
}
