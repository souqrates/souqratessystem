/*
  # Relax manager login minimum length

  ## Summary
  The previous hardening migration enforced a minimum passcode length of 8
  characters at login time. This locked out existing admins whose passcodes
  were set before the new policy. We lower the runtime minimum to 4 while
  keeping the rate-limit (5 failed attempts / 15 min) as the primary
  brute-force defense.

  ## Changes
  1. `manager_web_login(p_telegram_id, p_passcode)` — minimum length check
     lowered from 8 to 4 characters.

  ## Security
  - Rate-limit on failed attempts remains in force.
  - SECURITY DEFINER and search_path lock unchanged.
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
  FROM manager_login_attempts
  WHERE telegram_id = p_telegram_id
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

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
