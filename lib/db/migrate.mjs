import pg from "pg";
import { applyMigrations } from "./migrations/run.mjs";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await applyMigrations(pool);
  console.log("Account migration applied; legacy rows remain unclaimed.");
} finally { await pool.end(); }
