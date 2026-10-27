import assert from "node:assert/strict";
import app from "../src/app";
import { pool } from "@workspace/db";
import { llm } from "../src/lib/llm";
import { digest } from "../src/lib/auth";
import { mountMethodFixtures } from "./signin-methods";
import { mountIngressTests } from "./ingress";
import { testLearningContext } from "./learning-context";

let providerCalls = 0;
const testSignInMethods = mountMethodFixtures(app);
const testIngress = mountIngressTests(app);
llm.chat.completions.create = (() => { providerCalls++; throw new Error("Provider must not be called"); }) as typeof llm.chat.completions.create;
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(r => server.once("listening", r));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api`;
const password = "Testing-only-password-123!";
async function request(path: string, method = "GET", cookie = "", data?: unknown, extra?: Record<string, string>) {
  return fetch(base + path, { method, headers: { "Content-Type": "application/json", "X-Tutor-Request": "1", cookie, ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
}
async function register(email: string) {
  const response = await request("/auth/register", "POST", "", { email, password });
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(response.headers.get("set-cookie")!, /Secure/);
  assert.match(response.headers.get("set-cookie")!, /SameSite=Lax/);
  return response.headers.get("set-cookie")!.split(";")[0];
}
try {
  const available = await request("/auth/methods");
  assert.equal(available.status, 200);
  const methods = await available.json();
  assert.deepEqual(Object.keys(methods).sort(), ["emailCode", "google", "password"]);
  assert.equal(typeof methods.emailCode, "boolean");
  assert.equal(typeof methods.google, "boolean");
  assert.equal(methods.password, true);
  assert.equal((await request("/auth/register", "POST", "", { email: "bad", password: "short" })).status, 400);
  assert.equal((await request("/auth/register", "POST", "", { email: "a@example.test", password }, { origin: "https://evil.test" })).status, 403);
  assert.equal((await request("/auth/register", "POST", "", { email: "a@example.test", password }, { "X-Tutor-Request": "" })).status, 403);
  const a = await register(" A@example.test ");
  const b = await register("b@example.test");
  await testLearningContext(request, a, b);
  assert.equal((await request("/auth/register", "POST", "", { email: "A@example.test", password })).status, 409);
  const concurrent = await Promise.all([1, 2].map(() => request("/auth/register", "POST", "", { email: "race@example.test", password })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  const stored = await pool.query("SELECT * FROM accounts WHERE email='a@example.test'");
  assert.notEqual(stored.rows[0].password_hash, password);
  assert.match(stored.rows[0].password_hash, /^scrypt:/);
  assert.notEqual(stored.rows[0].password_hash, (await pool.query("SELECT password_hash FROM accounts WHERE email='b@example.test'")).rows[0].password_hash);
  assert.equal((await request("/auth/login", "POST", "", { email: "a@example.test", password: "wrong-password-123" })).status, 401);
  assert.equal((await request("/auth/session", "GET", a)).status, 200);
  const privatePaths = ["/openai/conversations", "/openai/conversations/1", "/openai/conversations/1/messages", "/progress/today", "/progress/history", "/lesson-completions", "/models"];
  for (const path of privatePaths) assert.equal((await request(path)).status, 401, path);
  for (const [path, method] of [["/openai/conversations", "POST"], ["/openai/conversations/1", "PATCH"], ["/openai/conversations/1", "DELETE"], ["/openai/conversations/1/messages", "POST"], ["/lesson-completions", "POST"], ["/lesson-completions/greetings", "DELETE"]]) {
    assert.equal((await request(path, method, "", {})).status, 401);
  }
  assert.deepEqual(await (await request("/openai/conversations", "GET", a)).json(), []);
  assert.equal((await request("/openai/conversations/1", "GET", a)).status, 404);
  const created = await request("/openai/conversations", "POST", a, { title: "Private A", language: "ur" });
  assert.equal(created.status, 201);
  const chat = await created.json();
  const url = `/openai/conversations/${chat.id}`;
  for (const [path, method, body] of [[url, "GET", undefined], [url, "PATCH", { title: "stolen" }], [url, "DELETE", undefined], [url + "/messages", "GET", undefined], [url + "/messages", "POST", { content: "steal" }]] as const) {
    assert.equal((await request(path, method, b, body)).status, 404, `${method} ${path}`);
  }
  assert.equal(providerCalls, 0);
  assert.equal((await pool.query("SELECT count(*) FROM messages WHERE conversation_id=$1", [chat.id])).rows[0].count, "0");
  assert.equal((await request(url, "PATCH", a, { title: "renamed" })).status, 200);
  assert.equal((await (await request(url, "GET", a)).json()).title, "renamed");
  await pool.query("INSERT INTO messages(conversation_id,role,content) VALUES ($1,'assistant','[[سلام|salam|hello]]')", [chat.id]);
  assert.equal((await (await request(url + "/messages", "GET", a)).json()).length, 1);
  assert.equal((await (await request("/progress/today?language=ur", "GET", a)).json()).points, 1);
  assert.equal((await (await request("/progress/today?language=ur", "GET", b)).json()).points, 0);
  assert.equal((await (await request("/progress/history?language=ur", "GET", b)).json()).hasHistory, false);
  const lessons = await (await request("/lessons?language=ur", "GET", a)).json();
  const slug = lessons[0].slug;
  for (const cookie of [a, a, b]) assert.equal((await request("/lesson-completions", "POST", cookie, { language: "ur", slug })).status, 200);
  assert.equal((await (await request("/lesson-completions?language=ur", "GET", a)).json()).completedSlugs.length, 1);
  await request(`/lesson-completions/${slug}?language=ur`, "DELETE", b);
  assert.equal((await (await request("/lesson-completions?language=ur", "GET", a)).json()).completedSlugs.length, 1);
  assert.equal((await (await request("/lesson-completions?language=ur", "GET", b)).json()).completedSlugs.length, 0);
  assert.equal((await request(url, "DELETE", a)).status, 204);
  assert.equal((await pool.query("SELECT count(*) FROM messages WHERE conversation_id=$1", [chat.id])).rows[0].count, "0");
  const login = await request("/auth/login", "POST", a, { email: "a@example.test", password });
  assert.equal(login.status, 200);
  const rotated = login.headers.get("set-cookie")!.split(";")[0];
  assert.notEqual(rotated, a);
  assert.equal((await request("/auth/session", "GET", a)).status, 401);
  assert.equal((await request("/auth/logout", "POST", rotated)).status, 204);
  assert.equal((await request("/auth/session", "GET", rotated)).status, 401);
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE token_hash=$1", [digest(b.split("=")[1])]);
  assert.equal((await request("/auth/session", "GET", b)).status, 401);
  assert.equal((await pool.query("SELECT count(*) FROM conversations WHERE user_id IS NULL")).rows[0].count, "1");
  assert.equal((await pool.query("SELECT count(*) FROM messages WHERE conversation_id=1")).rows[0].count, "1");
  assert.equal((await pool.query("SELECT count(*) FROM lesson_completions WHERE user_id IS NULL")).rows[0].count, "1");
  await assert.rejects(pool.query("INSERT INTO conversations(title) VALUES ('ownerless')"));
  await assert.rejects(pool.query("INSERT INTO lesson_completions(language,lesson_slug) VALUES ('ur','ownerless')"));
  for (let n = 0; n < 31; n++) await request("/auth/login", "POST", "", {});
  assert.equal((await request("/auth/login", "POST", "", {})).status, 429);
  await testSignInMethods(`http://127.0.0.1:${address.port}`);
  await testIngress(`http://127.0.0.1:${address.port}`);
  console.log("PASS: registration, hashes, session lifecycle, CSRF, legacy preservation, two-user chat/message/progress/completion isolation and rejected provider calls");
} finally {
  server.closeAllConnections();
  await new Promise<void>(r => server.close(() => r()));
  await pool.end();
}
