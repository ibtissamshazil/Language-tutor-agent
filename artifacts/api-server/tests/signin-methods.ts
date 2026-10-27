import assert from "node:assert/strict";
import type { Express } from "express";
import { pool } from "@workspace/db";
import { emailCodeRouter } from "../src/routes/email-code";
import { googleSigninRouter } from "../src/routes/google-signin";
import { digest } from "../src/lib/auth";

/** Only this test module has delivery/identity doubles; production has no test bypass. */
export function mountMethodFixtures(app: Express) {
  let delivered = { email: "", code: "" };
  let failDelivery = false;
  let googleIdentity = { email: "google@example.test", subject: "google-subject-one", nonce: "" };
  let exchanges = 0;
  app.use("/test-auth/email", emailCodeRouter(async (email, code) => {
    if (failDelivery) throw new Error("SMTP unavailable");
    delivered = { email, code };
  }, () => true));
  app.use("/test-auth/google", googleSigninRouter(async () => {
    exchanges++;
    return googleIdentity;
  }, () => ({ clientId: "test-client-id", clientSecret: "test-secret", origin: "https://tutor.example.test", redirectUri: "https://tutor.example.test/api/auth/google/callback" })));

  return async function testMethods(origin: string) {
    async function call(path: string, method = "POST", data?: unknown, cookie = "") {
      return fetch(origin + path, { method, redirect: "manual", headers: {
        "Content-Type": "application/json", "X-Tutor-Request": "1", cookie,
      }, body: data === undefined ? undefined : JSON.stringify(data) });
    }
    const resetLimits = () => pool.query("DELETE FROM auth_rate_limits");
    await resetLimits();
    const email = "verified@example.test";
    const requested = await call("/test-auth/email/request", "POST", { email });
    assert.equal(requested.status, 200);
    const challenge = await requested.json();
    assert.match(delivered.code, /^\d{6}$/);
    const stored = (await pool.query("SELECT code_hash FROM email_challenges WHERE id=$1", [challenge.challengeId])).rows[0];
    assert.notEqual(stored.code_hash, delivered.code);
    assert.equal((await call("/test-auth/email/request", "POST", { email })).status, 429);
    const correct = delivered.code;
    const wrong = correct === "000000" ? "111111" : "000000";
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: challenge.challengeId, code: wrong })).status, 401);
    const both = await Promise.all([1, 2].map(() => call("/test-auth/email/verify", "POST", { challengeId: challenge.challengeId, code: correct })));
    assert.deepEqual(both.map(r => r.status).sort(), [200, 401]);
    const signedIn = both.find(r => r.status === 200)!;
    const user = (await signedIn.json()).user;
    const cookie = signedIn.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await call("/api/auth/session", "GET", undefined, cookie)).status, 200);
    assert.equal((await pool.query("SELECT email_verified FROM accounts WHERE id=$1", [user.id])).rows[0].email_verified, true);
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: challenge.challengeId, code: correct })).status, 401);

    // Exhausted, expired, superseded and undelivered codes cannot authenticate.
    await resetLimits();
    const exhausted = await (await call("/test-auth/email/request", "POST", { email: "attempts@example.test" })).json();
    const exhaustedCorrect = delivered.code;
    for (let n = 0; n < 5; n++) await call("/test-auth/email/verify", "POST", { challengeId: exhausted.challengeId, code: exhaustedCorrect === "123456" ? "654321" : "123456" });
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: exhausted.challengeId, code: exhaustedCorrect })).status, 401);
    const expired = await (await call("/test-auth/email/request", "POST", { email: "expired@example.test" })).json();
    await pool.query("UPDATE email_challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [expired.challengeId]);
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: expired.challengeId, code: delivered.code })).status, 401);
    await resetLimits();
    const previous = await (await call("/test-auth/email/request", "POST", { email })).json();
    const oldCode = delivered.code;
    await resetLimits();
    await call("/test-auth/email/request", "POST", { email });
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: previous.challengeId, code: oldCode })).status, 401);
    failDelivery = true;
    assert.equal((await call("/test-auth/email/request", "POST", { email: "delivery-failed@example.test" })).status, 503);
    assert.equal((await pool.query("SELECT count(*) FROM email_challenges WHERE email='delivery-failed@example.test' AND consumed_at IS NULL")).rows[0].count, "0");
    failDelivery = false;

    // Proving ownership disables a potentially pre-registered password + sessions.
    await resetLimits();
    const password = "A-new-test-password-123";
    const legacyRegistration = await call("/api/auth/register", "POST", { email: "claim@example.test", password });
    assert.equal(legacyRegistration.status, 201);
    const legacyCookie = legacyRegistration.headers.get("set-cookie")!.split(";")[0];
    const claim = await (await call("/test-auth/email/request", "POST", { email: "claim@example.test" })).json();
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: claim.challengeId, code: delivered.code })).status, 200);
    assert.equal((await call("/api/auth/session", "GET", undefined, legacyCookie)).status, 401);
    assert.equal((await call("/api/auth/login", "POST", { email: "claim@example.test", password })).status, 401);
    await resetLimits();
    const setPassword = await (await call("/test-auth/email/request", "POST", { email: "claim@example.test" })).json();
    assert.equal((await call("/test-auth/email/verify", "POST", { challengeId: setPassword.challengeId, code: delivered.code, password })).status, 200);
    assert.equal((await call("/api/auth/login", "POST", { email: "claim@example.test", password })).status, 200);

    async function googleStart() {
      const response = await call("/test-auth/google/start");
      assert.equal(response.status, 200);
      const url = new URL((await response.json()).url);
      assert.equal(url.origin, "https://accounts.google.com");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(url.searchParams.get("scope"), "openid email");
      const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      const state = url.searchParams.get("state")!;
      const record = (await pool.query("SELECT verifier FROM oauth_states WHERE state_hash=$1", [digest(state)])).rows[0];
      assert.equal(url.searchParams.get("code_challenge"), Buffer.from(digest(record.verifier), "hex").toString("base64url"));
      return { state, cookie, nonce: url.searchParams.get("nonce")! };
    }
    await resetLimits();
    const google = await googleStart();
    googleIdentity = { ...googleIdentity, nonce: google.nonce };
    const callback = `/test-auth/google/callback?code=test-code&state=${google.state}`;
    const rejected = await call(callback, "GET");
    assert.match(rejected.headers.get("location")!, /authError=google/);
    assert.equal(exchanges, 0);
    const accepted = await call(callback, "GET", undefined, google.cookie);
    assert.equal(accepted.headers.get("location"), "https://tutor.example.test/");
    assert.match(accepted.headers.get("set-cookie")!, /tutor_session=/);
    const replayed = await call(callback, "GET", undefined, google.cookie);
    assert.match(replayed.headers.get("location")!, /authError=google/);
    assert.equal(exchanges, 1);
    const nonceMismatch = await googleStart();
    assert.match((await call(`/test-auth/google/callback?code=test-code&state=${nonceMismatch.state}`, "GET", undefined, nonceMismatch.cookie)).headers.get("location")!, /authError=google/);
    const expiredGoogle = await googleStart();
    await pool.query("UPDATE oauth_states SET expires_at=now()-interval '1 second' WHERE state_hash=$1", [digest(expiredGoogle.state)]);
    assert.match((await call(`/test-auth/google/callback?code=test-code&state=${expiredGoogle.state}`, "GET", undefined, expiredGoogle.cookie)).headers.get("location")!, /authError=google/);
    assert.equal((await pool.query("SELECT count(*) FROM accounts WHERE google_subject='google-subject-one'")).rows[0].count, "1");
    console.log("PASS: email code delivery failures, hashing, expiry, attempts, single-use/concurrent replay, resend, verified password setup, pre-registration protection, Google state/PKCE/nonce/replay/expiry");
  };
}
