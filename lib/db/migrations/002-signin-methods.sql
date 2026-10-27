BEGIN;
ALTER TABLE accounts ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_subject text;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_google_subject_unique ON accounts(google_subject);
CREATE TABLE IF NOT EXISTS email_challenges (
 id uuid PRIMARY KEY,
 email text NOT NULL,
 code_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_challenges_email_idx ON email_challenges(email, created_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 key text PRIMARY KEY,
 count integer NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash text PRIMARY KEY,
 nonce_hash text NOT NULL,
 verifier text NOT NULL,
 expires_at timestamptz NOT NULL
);
COMMIT;
