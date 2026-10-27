BEGIN;
CREATE TABLE IF NOT EXISTS accounts (
 id serial PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT normalized_email CHECK (email = lower(btrim(email)))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id integer REFERENCES accounts(id);
CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id);
ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES accounts(id);
ALTER TABLE lesson_completions DROP CONSTRAINT IF EXISTS lesson_completions_language_lesson_slug_unique;
CREATE UNIQUE INDEX IF NOT EXISTS lesson_completions_user_language_slug_unique ON lesson_completions(user_id, language, lesson_slug);
-- Old NULL owners remain valid, but all new records require an owner.
CREATE OR REPLACE FUNCTION require_new_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'New records require an owner'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS conversations_require_owner ON conversations;
CREATE TRIGGER conversations_require_owner BEFORE INSERT ON conversations FOR EACH ROW EXECUTE FUNCTION require_new_owner();
DROP TRIGGER IF EXISTS completions_require_owner ON lesson_completions;
CREATE TRIGGER completions_require_owner BEFORE INSERT ON lesson_completions FOR EACH ROW EXECUTE FUNCTION require_new_owner();
COMMIT;
