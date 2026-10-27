import { Router } from "express";
import { db, accounts, sessions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COOKIE, digest, hashPassword, verifyPassword, establishSession, clearSession, requireAuth, revokeActiveStreams } from "../lib/auth";
import { LoginAccountBody } from "@workspace/api-zod";
import { emailCodeRouter } from "./email-code";
import { googleSigninRouter } from "./google-signin";
import { credentialLimit } from "../lib/auth-rate-limit";
import { emailDeliveryConfigured } from "../lib/email-delivery";
import { googleConfiguration } from "../lib/google-signin";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/methods", (_req, res) => {
  res.json({
    emailCode: emailDeliveryConfigured() && Boolean(process.env.SESSION_SECRET),
    google: Boolean(googleConfiguration()),
    password: true,
  });
});
router.use("/email-code", emailCodeRouter());
router.use("/google", googleSigninRouter());
router.get("/session", requireAuth, (req, res) => { res.json({ user: req.account }); });
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (typeof token === "string") {
    await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
    revokeActiveStreams(digest(token));
  }
  clearSession(res);
  res.status(204).end();
});
for (const action of ["register", "login"]) {
  router.post(`/${action}`, credentialLimit, async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" || password.length < 12 || password.length > 128) {
      res.status(400).json({ error: "Enter a valid email and a password between 12 and 128 characters." }); return;
    }
    const normalized = email.trim().toLowerCase();
    if (!LoginAccountBody.safeParse({ email: normalized, password }).success) {
      res.status(400).json({ error: "Enter a valid email and a password between 12 and 128 characters." }); return;
    }
    if (action === "register") {
      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(accounts).values({ email: normalized, passwordHash }).onConflictDoNothing().returning({ id: accounts.id, email: accounts.email });
      if (!user) { res.status(409).json({ error: "Unable to create account with this email. Try signing in." }); return; }
      if (!await establishSession(req, res, user.id, passwordHash)) {
        res.status(401).json({ error: "Please sign in with an email code to continue." }); return;
      }
      res.status(201).json({ user });
    } else {
      const [user] = await db.select().from(accounts).where(eq(accounts.email, normalized));
      // Equal-cost hash verification even when no account exists.
      const stored = user?.passwordHash ?? `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
      const valid = await verifyPassword(password, stored);
      if (!user || !valid || !await establishSession(req, res, user.id, stored)) {
        res.status(401).json({ error: "Invalid email or password. You can also sign in with an email code." }); return;
      }
      res.json({ user: { id: user.id, email: user.email } });
    }
  });
}
export default router;
