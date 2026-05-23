/*
  # Allow data URI avatars in user profiles

  1. Changes
    - Updates the `user_update_profile` RPC to accept `data:image/` URIs
      in addition to `http://` and `https://` URLs for avatar images
    - This allows users to use the built-in SVG avatar presets which are
      encoded as `data:image/svg+xml` URIs

  2. Security
    - Only `data:image/` prefix is allowed (not arbitrary data URIs)
    - Max length of 2000 chars for data URIs (SVG presets are ~600-800 chars)
    - http(s) URLs still limited to 500 chars
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
END
$$;
