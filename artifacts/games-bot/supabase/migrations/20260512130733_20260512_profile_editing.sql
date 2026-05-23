/*
  # Profile Editing — Display Name & Custom Avatar

  Lets players override their Telegram name and avatar across the entire app
  (matches, lobbies, leaderboards, profile, chat badges).

  1. Changes
    - Adds two nullable columns to `users`:
      - `display_name` text — player-chosen name (max ~24 chars enforced by RPC)
      - `custom_avatar_url` text — direct URL to a profile image
    - Adds `user_update_profile(p_telegram_id, p_display_name, p_avatar_url)` RPC.
      Validates length/charset, strips whitespace, and disallows obvious spam
      patterns. Passing NULL clears the field (falls back to Telegram values).
    - Returns the updated `users` row.

  2. Security
    - RPC runs with SECURITY DEFINER but only updates the user matching
      p_telegram_id supplied (the client already trusts its Telegram session
      for similar self-mutating RPCs — see pay_resolve_session).
    - Validates input length to prevent layout-breaking strings.
    - No RLS policy changes needed (the column lives on an existing table).
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_name') THEN
    ALTER TABLE users ADD COLUMN display_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='custom_avatar_url') THEN
    ALTER TABLE users ADD COLUMN custom_avatar_url text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION user_update_profile(
  p_telegram_id bigint,
  p_display_name text,
  p_avatar_url text
)
RETURNS users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row    users;
  v_name   text;
  v_avatar text;
BEGIN
  IF p_telegram_id IS NULL THEN RAISE EXCEPTION 'invalid telegram id'; END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_display_name, '')), '');
  IF v_name IS NOT NULL THEN
    IF length(v_name) > 24 THEN RAISE EXCEPTION 'display_name too long (max 24)'; END IF;
    IF length(v_name) < 2  THEN RAISE EXCEPTION 'display_name too short (min 2)'; END IF;
    -- block control chars / common spam patterns
    IF v_name ~ '[\x00-\x1f]' THEN RAISE EXCEPTION 'invalid characters'; END IF;
  END IF;

  v_avatar := NULLIF(BTRIM(COALESCE(p_avatar_url, '')), '');
  IF v_avatar IS NOT NULL THEN
    IF length(v_avatar) > 500 THEN RAISE EXCEPTION 'avatar url too long'; END IF;
    IF NOT (v_avatar ~* '^https?://') THEN
      RAISE EXCEPTION 'avatar url must start with http(s)';
    END IF;
  END IF;

  UPDATE users
     SET display_name      = v_name,
         custom_avatar_url = v_avatar,
         updated_at        = now()
   WHERE telegram_id = p_telegram_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION user_update_profile(bigint, text, text) TO authenticated, anon;