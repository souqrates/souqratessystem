/*
  # Fix ambiguous telegram_id reference in manager_web_login

  ## Summary
  The previous version of `manager_web_login` referenced `telegram_id`
  inside the rate-limit count without table qualification. PL/pgSQL
  resolved it against the OUT column rather than the table, causing
  every call to error out with `42702: column reference "telegram_id"
  is ambiguous`. We add a table alias and qualify the column.

  ## Changes
  1. `manager_web_login` rewritten with `mla` alias on
     `manager_login_attempts` to disambiguate `telegram_id`.
*/

CREATE OR REPLACE FUNCTION public.manager_web_login(p_telegram_id bigint, p_passcode text)
RETURNS TABLE(telegram_id bigint, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_hash        text;
  v_fail_count  integer;
  v_ok          boolean := false;
BEGIN
  IF p_telegram_id IS NULL OR p_passcode IS NULL OR length(p_passcode) < 4 THEN
    INSERT INTO manager_login_attempts (telegram_id, success)
    VALUES (COALESCE(p_telegram_id, 0), false);
    RETURN;
  END IF;

  SELECT count(*) INTO v_fail_count
  FROM manager_login_attempts mla
  WHERE mla.telegram_id = p_telegram_id
    AND mla.success = false
    AND mla.attempted_at > now() - interval '15 minutes';

  IF v_fail_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '53400';
  END IF;

  SELECT a.web_passcode_hash INTO v_hash
  FROM manager_admins a
  WHERE a.telegram_id = p_telegram_id;

  IF v_hash IS NOT NULL AND crypt(p_passcode, v_hash) = v_hash THEN
    v_ok := true;
  END IF;

  INSERT INTO manager_login_attempts (telegram_id, success)
  VALUES (p_telegram_id, v_ok);

  IF v_ok THEN
    RETURN QUERY
    SELECT a.telegram_id, a.name, a.role
    FROM manager_admins a
    WHERE a.telegram_id = p_telegram_id;
  END IF;
END;
$function$;
