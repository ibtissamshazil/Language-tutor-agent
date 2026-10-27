BEGIN;
-- Bootstrap empty databases without schema push. On existing databases these
-- statements leave all tables and data untouched; later migrations add owners.
CREATE TABLE IF NOT EXISTS conversations (
 id serial PRIMARY KEY,
 title text NOT NULL,
 language text NOT NULL DEFAULT 'ur',
 level text NOT NULL DEFAULT 'beginner',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
 id serial PRIMARY KEY,
 conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role text NOT NULL,
 content text NOT NULL,
 model text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lesson_completions (
 id serial PRIMARY KEY,
 language text NOT NULL,
 lesson_slug text NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT lesson_completions_language_lesson_slug_unique UNIQUE(language,lesson_slug)
);
COMMIT;
