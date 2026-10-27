import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { build } from "esbuild";
import assert from "node:assert/strict";
import { applyMigrations } from "../../../lib/db/migrations/run.mjs";
const require = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const admin = new Pool({ connectionString: process.env.DATABASE_URL });
const name = `tutor_test_${randomUUID().replaceAll("-", "")}`;
let testPool;
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + name;
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = "production";
  process.env.LOG_LEVEL = "silent";
  testPool = new Pool({ connectionString: url.toString() });
  // Exercise the actual setup runner on a completely empty schema, twice.
  await testPool.query("CREATE SCHEMA fresh_bootstrap");
  const fresh = new Pool({ connectionString: url.toString(), options: "-c search_path=fresh_bootstrap" });
  try {
    await applyMigrations(fresh);
    await applyMigrations(fresh);
    const { rows: [user] } = await fresh.query("INSERT INTO accounts(email,email_verified) VALUES ('fresh@example.test',true) RETURNING id");
    const { rows: [chat] } = await fresh.query("INSERT INTO conversations(title,user_id) VALUES ('fresh',$1) RETURNING id", [user.id]);
    await fresh.query("INSERT INTO messages(conversation_id,role,content) VALUES ($1,'user','hello')", [chat.id]);
    await fresh.query("INSERT INTO lesson_completions(user_id,language,lesson_slug) VALUES ($1,'ur','fresh')", [user.id]);
    await assert.rejects(fresh.query("INSERT INTO conversations(title) VALUES ('no owner')"));
    await fresh.query("DELETE FROM conversations WHERE id=$1", [chat.id]);
    assert.equal((await fresh.query("SELECT count(*) FROM messages")).rows[0].count, "0");
    console.log("PASS: repeatable fresh-database bootstrap, owned records and message cascade");
  } finally { await fresh.end(); }
  await testPool.query(`
    CREATE TABLE conversations(id serial PRIMARY KEY,title text NOT NULL,language text NOT NULL DEFAULT 'ur',level text NOT NULL DEFAULT 'beginner',created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE messages(id serial PRIMARY KEY,conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,role text NOT NULL,content text NOT NULL,model text,created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lesson_completions(id serial PRIMARY KEY,language text NOT NULL,lesson_slug text NOT NULL,completed_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT lesson_completions_language_lesson_slug_unique UNIQUE(language,lesson_slug));
    INSERT INTO conversations(title) VALUES ('Legacy');
    INSERT INTO messages(conversation_id,role,content) VALUES (1,'assistant','[[legacy||legacy]]');
    INSERT INTO lesson_completions(language,lesson_slug) VALUES ('ur','legacy');
  `);
  await applyMigrations(testPool);
  await applyMigrations(testPool);
  await build({ entryPoints: [new URL("./accounts.ts", import.meta.url).pathname], outfile: new URL("./.accounts-test.mjs", import.meta.url).pathname, bundle: true, platform: "node", format: "esm", external: ["pg-native", "pino", "pino-http"], banner: { js: 'import {createRequire} from "node:module"; const require=createRequire(import.meta.url);' } });
  await import("./.accounts-test.mjs");
} finally {
  await testPool?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
  await rm(new URL("./.accounts-test.mjs", import.meta.url), { force: true });
}
