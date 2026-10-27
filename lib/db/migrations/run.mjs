import { readFile } from "node:fs/promises";

/** Shared by the setup command and tests: identical bootstrap/upgrade path. */
export async function applyMigrations(pool) {
  for (const file of ["000-baseline.sql", "001-accounts.sql", "002-signin-methods.sql"]) {
    await pool.query(await readFile(new URL(file, import.meta.url), "utf8"));
  }
}
