import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { digest, establishSession } from "../lib/auth";
import { credentialLimit } from "../lib/auth-rate-limit";
import { googleConfiguration, exchangeGoogleCode } from "../lib/google-signin";
import { verifiedGoogleAccount } from "../lib/verified-account";

const stateCookie = "tutor_google_state";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function googleSigninRouter(exchange = exchangeGoogleCode, configuration = googleConfiguration) {
  const router = Router();
  router.post("/start", credentialLimit, async (req, res) => {
    const config = configuration();
    if (!config) { res.status(503).json({ error: "Google sign-in is not configured yet. Please use another sign-in method." }); return; }
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    if (typeof req.cookies?.[stateCookie] === "string") {
      await pool.query("DELETE FROM oauth_states WHERE state_hash=$1", [digest(req.cookies[stateCookie])]);
    }
    await pool.query("DELETE FROM oauth_states WHERE expires_at<=now()");
    await pool.query("INSERT INTO oauth_states(state_hash,nonce_hash,verifier,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
      [digest(state), digest(nonce), verifier]);
    res.cookie(stateCookie, state, { ...cookieOptions, maxAge: 600_000 });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
      scope: "openid email", state, nonce, prompt: "select_account",
      code_challenge: Buffer.from(digest(verifier), "hex").toString("base64url"), code_challenge_method: "S256",
    }).toString();
    res.json({ url: url.toString() });
  });
  router.get("/callback", async (req, res) => {
    const config = configuration();
    const fail = () => res.redirect(`${config?.origin ?? ""}/login?authError=google`);
    const { state, code } = req.query;
    const cookie = req.cookies?.[stateCookie];
    res.clearCookie(stateCookie, cookieOptions);
    if (!config || typeof state !== "string" || state.length > 128 || typeof cookie !== "string" || state !== cookie) {
      fail(); return;
    }
    // Delete is atomic: a state can be exchanged at most once, even concurrently.
    const { rows: [saved] } = await pool.query("DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at>now() RETURNING *", [digest(state)]);
    if (!saved || typeof code !== "string" || code.length > 4096 || req.query.error) { fail(); return; }
    try {
      const identity = await exchange(code, saved.verifier);
      if (!identity.nonce || digest(identity.nonce) !== saved.nonce_hash) { fail(); return; }
      const user = await verifiedGoogleAccount(identity.email, identity.subject);
      await establishSession(req, res, user.id);
      res.redirect(`${config.origin}/`);
    } catch {
      // Provider errors may contain OAuth tokens or secrets. Never log the error.
      fail();
    }
  });
  return router;
}
