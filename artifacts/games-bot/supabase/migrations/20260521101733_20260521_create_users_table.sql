/*
  # Create users table

  ## Summary
  Creates a general-purpose `users` table that stores core user identity and profile
  information. This table complements the existing `player_profiles` table (which holds
  game-specific stats) by providing a clean identity layer.

  ## New Table: users
  - `id`           — UUID primary key, auto-generated
  - `telegram_id`  — Unique Telegram user ID (bigint)
  - `username`     — Telegram or chosen username
  - `first_name`   — User's first name
  - `last_name`    — User's last name (optional)
  - `avatar_url`   — Profile picture URL or data URI
  - `language_code`— Preferred language (e.g. 'en', 'ar')
  - `is_active`    — Whether the account is active
  - `is_banned`    — Whether the account is banned
  - `metadata`     — Flexible JSONB for extra data
  - `created_at`   — Row creation timestamp
  - `updated_at`   — Last update timestamp

  ## Security
  - RLS enabled
  - Authenticated users can read and update only their own row
  - Service role has full access for server-side operations
*/

CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   bigint      UNIQUE NOT NULL,
  username      text        NOT NULL DEFAULT '',
  first_name    text        NOT NULL DEFAULT '',
  last_name     text        NOT NULL DEFAULT '',
  avatar_url    text        NOT NULL DEFAULT '',
  language_code text        NOT NULL DEFAULT 'en',
  is_active     boolean     NOT NULL DEFAULT true,
  is_banned     boolean     NOT NULL DEFAULT false,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by telegram_id
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at_trigger ON users;
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "Users can view own record"
  ON users FOR SELECT
  TO authenticated
  USING (
    telegram_id = (
      SELECT (raw_app_meta_data->>'telegram_id')::bigint
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Users can update their own row (non-sensitive fields only — enforce in app layer)
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (
    telegram_id = (
      SELECT (raw_app_meta_data->>'telegram_id')::bigint
      FROM auth.users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    telegram_id = (
      SELECT (raw_app_meta_data->>'telegram_id')::bigint
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Service role can do everything (used by edge functions and RPCs)
CREATE POLICY "Service role full access select"
  ON users FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role full access insert"
  ON users FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role full access update"
  ON users FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access delete"
  ON users FOR DELETE
  TO service_role
  USING (true);
