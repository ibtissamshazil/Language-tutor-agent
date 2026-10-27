BEGIN;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lesson_slug text;
CREATE INDEX IF NOT EXISTS conversations_owner_language_idx ON conversations(user_id, language, id);
CREATE INDEX IF NOT EXISTS messages_memory_recent_idx ON messages(created_at DESC, id DESC) WHERE role = 'assistant';
COMMIT;
