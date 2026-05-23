/*
  # Make user_update_profile upsert instead of update-only

  1. Problem
    - If a user attempts to edit their profile before `track_visitor`
      has created their `users` row (race condition or timing issue),
      the RPC fails with "user not found"

  2. Fix
    - Change the UPDATE to an INSERT ... ON CONFLICT ... DO UPDATE
    - If the user row does not exist yet, it is created automatically
    - This ensures profile editing never fails due to a missing row
*/

CREATE OR REPLACE FUNCTION user_update_profile(
  p_telegram_id bigint,
  p_display_name text DEFAULT NULL,
  p_avatar_url   text DEFAULT NULL
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    IF v_name ~ '[\x00-\x1f]' THEN RAISE EXCEPTION 'invalid characters'; END IF;
  END IF;

  v_avatar := NULLIF(BTRIM(COALESCE(p_avatar_url, '')), '');
  IF v_avatar IS NOT NULL THEN
    IF v_avatar ~* '^https?://' THEN
      IF length(v_avatar) > 500 THEN RAISE EXCEPTION 'avatar url too long'; END IF;
    ELSIF v_avatar ~* '^data:image/' THEN
      IF length(v_avatar) > 2000 THEN RAISE EXCEPTION 'avatar data uri too long'; END IF;
    ELSE
      RAISE EXCEPTION 'avatar url must start with http(s):// or be a data:image URI';
    END IF;
  END IF;

  INSERT INTO public.users (telegram_id, display_name, custom_avatar_url, created_at, updated_at)
  VALUES (p_telegram_id, v_name, v_avatar, now(), now())
  ON CONFLICT (telegram_id) DO UPDATE
    SET display_name      = EXCLUDED.display_name,
        custom_avatar_url = EXCLUDED.custom_avatar_url,
        updated_at        = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END
$$;
