import { pool, type PoolClient } from "@workspace/db";
import { revokeActiveStreams } from "./auth";

export interface VerifiedUser { id: number; email: string }

/**
 * Verification proves mailbox ownership. Never retain an unverified password or
 * sessions: a third party could have pre-registered the victim's email.
 * Lock the account row so concurrent email/Google verification cannot race.
 */
export async function verifiedAccount(
  client: PoolClient,
  email: string,
  passwordHash?: string,
  googleSubject?: string,
): Promise<{ user: VerifiedUser; revoked: string[] }> {
  if (googleSubject) {
    const existing = await client.query<VerifiedUser>("SELECT id,email FROM accounts WHERE google_subject=$1 FOR UPDATE", [googleSubject]);
    if (existing.rows[0]) return { user: existing.rows[0], revoked: [] };
  }
  await client.query("INSERT INTO accounts(email,email_verified) VALUES ($1,true) ON CONFLICT(email) DO NOTHING", [email]);
  const { rows: [account] } = await client.query("SELECT * FROM accounts WHERE email=$1 FOR UPDATE", [email]);
  if (googleSubject && account.google_subject && account.google_subject !== googleSubject) {
    throw new Error("Google account does not match");
  }
  const resetCredentials = !account.email_verified || passwordHash !== undefined;
  const revoked: string[] = [];
  if (resetCredentials) {
    const result = await client.query("DELETE FROM sessions WHERE user_id=$1 RETURNING token_hash", [account.id]);
    revoked.push(...result.rows.map(row => row.token_hash));
  }
  await client.query(`UPDATE accounts SET email_verified=true,
    password_hash=CASE WHEN $2 THEN $3 ELSE password_hash END,
    google_subject=COALESCE($4,google_subject) WHERE id=$1`,
    [account.id, resetCredentials, passwordHash ?? null, googleSubject ?? null]);
  return { user: { id: account.id, email: account.email }, revoked };
}

export async function verifiedGoogleAccount(email: string, subject: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await verifiedAccount(client, email, undefined, subject);
    await client.query("COMMIT");
    result.revoked.forEach(revokeActiveStreams);
    return result.user;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
