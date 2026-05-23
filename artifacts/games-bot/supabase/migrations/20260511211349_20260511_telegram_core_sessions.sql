/*
  # Telegram Core: Sessions, Bot Events, and Webapp Auth

  ## Summary
  Adds tables required for verified Telegram authentication and bot interaction:

  1. New Tables
    - `telegram_sessions`: stores verified WebApp sessions (signed initData hash).
      Used by the frontend to confirm that a given telegram_id was actually signed
      by Telegram (HMAC-SHA256 against bot token). Never trust client-side
      telegram_id without first validating through the Edge Function.
    - `telegram_bot_events`: append-only log of every interaction received by
      the bot webhook (commands, callbacks). Useful for audit + replay.
    - `telegram_outbox`: outgoing message queue for bot push notifications
      (deposit confirmed, withdrawal sent, etc.). Worker reads and dispatches.

  2. Security
    - All tables RLS enabled
    - telegram_sessions: only service_role can write; authenticated users may
      read their own active session (lookup by telegram_id stored in JWT claim).
    - telegram_bot_events: service_role only (raw bot data, sensitive).
    - telegram_outbox: service_role only.

  3. Notes
    1. We do NOT store the bot token here. It lives in
       TELEGRAM_BOT_TOKEN edge function secret.
    2. Sessions expire after 24 hours. Frontend refreshes by calling the
       verify_init_data function on every cold start.
    3. The init_data_hash column lets us idempotently verify the same payload
       without recomputing HMAC.
*/

CREATE TABLE IF NOT EXISTS telegram_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  username text DEFAULT '',
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  photo_url text DEFAULT '',
  language_code text DEFAULT 'en',
  is_premium boolean DEFAULT false,
  init_data_hash text NOT NULL,
  auth_date timestamptz NOT NULL,
  start_param text DEFAULT '',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_sessions_tg_idx
  ON telegram_sessions (telegram_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS telegram_sessions_hash_idx
  ON telegram_sessions (init_data_hash);

ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read own session"
  ON telegram_sessions FOR SELECT
  TO authenticated
  USING (telegram_id::text = (auth.jwt() ->> 'telegram_id'));

CREATE TABLE IF NOT EXISTS telegram_bot_events (
  id bigserial PRIMARY KEY,
  telegram_id bigint,
  chat_id bigint,
  event_type text NOT NULL DEFAULT 'message',
  command text DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_bot_events_tg_idx
  ON telegram_bot_events (telegram_id, created_at DESC);

ALTER TABLE telegram_bot_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS telegram_outbox (
  id bigserial PRIMARY KEY,
  telegram_id bigint NOT NULL,
  message text NOT NULL,
  parse_mode text DEFAULT 'HTML',
  reply_markup jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS telegram_outbox_status_idx
  ON telegram_outbox (status, created_at);

ALTER TABLE telegram_outbox ENABLE ROW LEVEL SECURITY;
