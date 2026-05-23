/*
  # Guest Session Fallback

  Allows clients running outside Telegram (browser preview, web) to create
  a guest session so quad/group lobbies and economy flows still work.

  1. New Function
    - `pay_create_guest_session(p_guest_tg_id bigint, p_first_name text)`
      Inserts a row into `telegram_sessions` for a guest user and returns
      `{ session_id, telegram_id, expires_at }`.
  2. Security
    - SECURITY DEFINER, search_path locked
    - Granted EXECUTE to anon, authenticated
    - Guest telegram_ids are restricted to the negative range to avoid
      collision with real Telegram user IDs.
*/

CREATE OR REPLACE FUNCTION public.pay_create_guest_session(
  p_guest_tg_id bigint,
  p_first_name text DEFAULT 'Guest'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_expires_at timestamptz;
  v_tg_id bigint;
BEGIN
  IF p_guest_tg_id IS NULL OR p_guest_tg_id >= 0 THEN
    v_tg_id := -(floor(random() * 1000000000)::bigint + 1);
  ELSE
    v_tg_id := p_guest_tg_id;
  END IF;

  INSERT INTO telegram_sessions (
    telegram_id, username, first_name, last_name,
    photo_url, language_code, is_premium,
    init_data_hash, auth_date, start_param
  ) VALUES (
    v_tg_id, '', COALESCE(p_first_name, 'Guest'), '',
    '', 'en', false,
    'guest', now(), ''
  )
  RETURNING id, expires_at INTO v_session_id, v_expires_at;

  INSERT INTO manager_visitors (telegram_id, first_name, username, last_seen)
  VALUES (v_tg_id, COALESCE(p_first_name, 'Guest'), '', now())
  ON CONFLICT (telegram_id) DO UPDATE SET last_seen = excluded.last_seen;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'telegram_id', v_tg_id,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_create_guest_session(bigint, text) TO anon, authenticated;
