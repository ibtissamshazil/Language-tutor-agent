import assert from "node:assert/strict";
import type { Express } from "express";
import { pool } from "@workspace/db";
import { credentialLimit } from "../src/lib/auth-rate-limit";

export function mountIngressTests(app: Express) {
  app.post("/test-ingress/rate", credentialLimit, (req, res) => res.json({ ip: req.ip }));
  const address = (peer: string, forwarded: string) => {
    const req = Object.create(app.request);
    req.app = app;
    req.connection = { remoteAddress: peer };
    req.headers = { "x-forwarded-for": forwarded };
    return req.ip;
  };
  return async (origin: string) => {
    // No trust in public peers or private network peers, only local ingress.
    assert.equal(address("198.51.100.1", "203.0.113.42"), "198.51.100.1");
    assert.equal(address("10.60.1.2", "203.0.113.42"), "10.60.1.2");
    assert.equal(address("127.0.0.1", "203.0.113.42, 198.51.100.1, 127.0.0.1"), "198.51.100.1");
    // Match the observed preview chain: stop at the unknown private upstream.
    assert.equal(address("127.0.0.1", "203.0.113.42, 10.60.1.2, 127.0.0.1"), "10.60.1.2");
    await pool.query("DELETE FROM auth_rate_limits");
    const call = (forwarded: string, body: object) => fetch(`${origin}/test-ingress/rate`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Tutor-Request": "1", "X-Forwarded-For": forwarded },
      body: JSON.stringify(body),
    });
    const a = "198.51.100.1, 127.0.0.1";
    const b = "198.51.100.2, 127.0.0.1";
    for (let n = 0; n < 30; n++) assert.equal((await call(a, { email: "same@example.test" })).status, 200);
    assert.equal((await call(a, { email: "same@example.test" })).status, 429);
    assert.equal((await call(b, { email: "same@example.test" })).status, 200);
    assert.equal((await call(`203.0.113.200, ${a}`, { email: "same@example.test" })).status, 429);
    assert.equal((await call(a, { email: "another@example.test" })).status, 200);
    const shared = "203.0.113.42, 10.60.1.2, 127.0.0.1";
    for (let n = 0; n < 31; n++) await call(shared, {});
    assert.equal((await call(shared, {})).status, 429);
    assert.equal((await call(shared, { email: "unaffected@example.test" })).status, 200);
    assert.equal((await call(shared, { challengeId: "a-valid-challenge" })).status, 200);
    console.log("PASS: trusted loopback ingress, forwarded-client budgets, spoof rejection and shared-proxy account isolation");
  };
}
