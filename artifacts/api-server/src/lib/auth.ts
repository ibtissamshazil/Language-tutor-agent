import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { RequestHandler, Request, Response } from "express";
import { db, pool, accounts, sessions } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

const scrypt = (password: string, salt: string, length: number) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, length, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key));
});
export const COOKIE = "tutor_session";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt, hex] = stored.split(":");
  const key = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
declare global {
  namespace Express { interface Request { account: { id: number; email: string }; sessionHash: string; sessionExpiresAt: Date } }
}
const activeStreams = new Map<string, Set<() => void>>();
export function revokeActiveStreams(hash: string) {
  for (const close of activeStreams.get(hash) ?? []) close();
  activeStreams.delete(hash);
}
export function watchSession(req: Request, res: Response, close: () => void) {
  const callbacks = activeStreams.get(req.sessionHash) ?? new Set();
  callbacks.add(close);
  activeStreams.set(req.sessionHash, callbacks);
  const timer = setTimeout(close, Math.max(0, req.sessionExpiresAt.getTime() - Date.now()));
  // Also detect revocation in another server process.
  const poll = setInterval(() => {
    db.select({ tokenHash: sessions.tokenHash }).from(sessions)
      .where(and(eq(sessions.tokenHash, req.sessionHash), gt(sessions.expiresAt, new Date())))
      .then(rows => { if (!rows.length) close(); }).catch(close);
  }, 10_000);
  res.once("close", () => {
    clearTimeout(timer);
    clearInterval(poll);
    callbacks.delete(close);
    if (!callbacks.size) activeStreams.delete(req.sessionHash);
  });
}
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export async function establishSession(req: Request, res: Response, userId: number, expectedPasswordHash?: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  const oldHash = typeof req.cookies?.[COOKIE] === "string" ? digest(req.cookies[COOKIE]) : undefined;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize credential checks/session issuance with email verification and
    // password replacement. A stale password check must not resurrect a session.
    const { rows: [account] } = await client.query("SELECT password_hash FROM accounts WHERE id=$1 FOR UPDATE", [userId]);
    if (!account || (expectedPasswordHash !== undefined && account.password_hash !== expectedPasswordHash)) {
      await client.query("ROLLBACK");
      return false;
    }
    if (oldHash) await client.query("DELETE FROM sessions WHERE token_hash=$1", [oldHash]);
    await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [digest(token), userId, expiresAt]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  if (oldHash) revokeActiveStreams(oldHash);
  res.cookie(COOKIE, token, { ...cookieOptions, expires: expiresAt });
  return true;
}
export function clearSession(res: Response) { res.clearCookie(COOKIE, cookieOptions); }
export const requireAuth: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const token = req.cookies?.[COOKIE];
  if (typeof token !== "string" || token.length > 128) { res.status(401).json({ error: "Sign in required" }); return; }
  const [row] = await db.select({ id: accounts.id, email: accounts.email, tokenHash: sessions.tokenHash, expiresAt: sessions.expiresAt })
    .from(sessions).innerJoin(accounts, eq(accounts.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date())));
  if (!row) { clearSession(res); res.status(401).json({ error: "Session expired. Please sign in." }); return; }
  req.account = { id: row.id, email: row.email };
  req.sessionHash = row.tokenHash;
  req.sessionExpiresAt = row.expiresAt;
  next();
};
// Custom header prevents cross-origin form submissions; no CORS permissions are
// granted. Browser fetches also must carry an origin matching the proxy host.
export const csrfProtection: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
  let validOrigin = !origin;
  try { if (origin) validOrigin = new URL(origin).host === host; } catch { validOrigin = false; }
  if (req.get("x-tutor-request") !== "1" || !validOrigin || req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Request origin rejected" }); return;
  }
  next();
};
