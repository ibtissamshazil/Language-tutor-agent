import { pool } from "@workspace/db";
import type { RequestHandler } from "express";
import { digest } from "./auth";
import { randomBytes } from "node:crypto";

/** Atomic fixed-window limits shared by server processes; identifiers are hashed. */
export async function takeAuthAttempt(key: string, limit: number, seconds: number) {
  const result = await pool.query<{ count: number }>(`
    INSERT INTO auth_rate_limits(key,count,expires_at) VALUES ($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.count+1 END,
      expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
    RETURNING count`, [digest(key), seconds]);
  return result.rows[0].count <= limit;
}

export const credentialLimit: RequestHandler = async (req, res, next) => {
  // The nearest untrusted hop can still be a shared ingress/NAT. Never attach a
  // small global credential budget to that address: one visitor could lock out
  // every other account. Scope by submitted identity/challenge as well.
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : undefined;
  const challenge = typeof req.body?.challengeId === "string" ? req.body.challengeId.slice(0, 128) : undefined;
  let subject = email ? `email:${email}` : challenge ? `challenge:${challenge}` : undefined;
  if (!subject && req.path === "/start") {
    // OAuth initiation has no account identifier yet. Use a separate browser
    // budget; rotating it cannot bypass password or OTP verification limits.
    let browser = req.cookies?.tutor_auth_browser;
    if (typeof browser !== "string" || !/^[a-f0-9]{64}$/.test(browser)) {
      browser = randomBytes(32).toString("hex");
      res.cookie("tutor_auth_browser", browser, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: 900_000,
      });
    }
    subject = `browser:${browser}`;
  }
  subject ??= "invalid-input";
  if (!await takeAuthAttempt(`credentials:${req.ip}:${subject}`, 30, 900)) {
    res.setHeader("Retry-After", "900");
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }
  next();
};
