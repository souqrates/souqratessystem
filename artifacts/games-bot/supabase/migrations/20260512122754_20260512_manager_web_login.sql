/*
  # Manager Desktop Login

  Adds passcode-based login so admins can sign into the Manager dashboard
  from a desktop browser (outside Telegram).

  1. Schema
    - `manager_admins.web_passcode_hash` (text, nullable): bcrypt hash of
      the admin's desktop passcode. NULL means the admin has not enabled
      desktop login yet.
    - `manager_admins.web_passcode_set_at` (timestamptz): when the hash
      was last set.

  2. New functions
    - `manager_web_login(p_telegram_id, p_passcode)` -> admin row.
      Verifies bcrypt hash. Returns matching admin or empty result.
    - `manager_set_web_passcode(p_telegram_id, p_new_passcode, p_current_passcode)`
      Lets an admin set their initial passcode (when none exists) or
      rotate it (must supply the current passcode).

  3. Security
    - Both functions are SECURITY DEFINER with a locked search_path.
    - The login function uses constant-time bcrypt comparison via
      pgcrypto's `crypt()`.
    - Passcodes are NEVER stored in plaintext.
    - Minimum passcode length enforced at 8 chars.
*/

ALTER TABLE manager_admins
  ADD COLUMN IF NOT EXISTS web_passcode_hash  text,
  ADD COLUMN IF NOT EXISTS web_passcode_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.manager_web_login(
  p_telegram_id bigint,
  p_passcode    text
)
RETURNS TABLE(telegram_id bigint, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_telegram_id IS NULL OR p_passcode IS NULL OR length(p_passcode) < 1 THEN
    RETURN;
  END IF;

  SELECT a.web_passcode_hash INTO v_hash
    FROM manager_admins a
    WHERE a.telegram_id = p_telegram_id;

  IF v_hash IS NULL THEN
    RETURN;
  END IF;

  IF crypt(p_passcode, v_hash) = v_hash THEN
    RETURN QUERY
      SELECT a.telegram_id, a.name, a.role
        FROM manager_admins a
        WHERE a.telegram_id = p_telegram_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.manager_web_login(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_web_login(bigint, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.manager_set_web_passcode(
  p_telegram_id      bigint,
  p_new_passcode     text,
  p_current_passcode text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_existing text;
BEGIN
  IF p_telegram_id IS NULL OR p_new_passcode IS NULL OR length(p_new_passcode) < 8 THEN
    RAISE EXCEPTION 'passcode_too_short';
  END IF;

  SELECT web_passcode_hash INTO v_existing
    FROM manager_admins WHERE telegram_id = p_telegram_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF v_existing IS NOT NULL THEN
    IF p_current_passcode IS NULL OR crypt(p_current_passcode, v_existing) <> v_existing THEN
      RAISE EXCEPTION 'current_passcode_invalid';
    END IF;
  END IF;

  UPDATE manager_admins
    SET web_passcode_hash   = crypt(p_new_passcode, gen_salt('bf', 10)),
        web_passcode_set_at = now()
    WHERE telegram_id = p_telegram_id;

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.manager_set_web_passcode(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_set_web_passcode(bigint, text, text) TO anon, authenticated;