/*
  # Make session resolution more resilient

  1. Problem
    - pay_resolve_session strictly checks expires_at on the exact session_id
    - If the frontend holds a slightly stale session_id but the user has a newer valid session,
      the RPC fails with session_invalid_or_expired

  2. Fix
    - If the exact session lookup fails (expired), fall back to finding ANY valid session
      for the same telegram_id
    - This prevents "session expired" errors when the user has a valid session under a different ID
    - Still raises an exception if truly no valid session exists

  3. Security
    - SECURITY DEFINER with restricted search_path
    - Only returns telegram_id, never exposes session contents
    - Falls back by telegram_id ownership, not by guessing
*/

CREATE OR REPLACE FUNCTION public.pay_resolve_session(p_session_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tg bigint;
  v_tg_from_expired bigint;
BEGIN
  SELECT telegram_id INTO v_tg
  FROM telegram_sessions
  WHERE id = p_session_id AND expires_at > now()
  LIMIT 1;

  IF v_tg IS NOT NULL THEN
    RETURN v_tg;
  END IF;

  SELECT telegram_id INTO v_tg_from_expired
  FROM telegram_sessions
  WHERE id = p_session_id
  LIMIT 1;

  IF v_tg_from_expired IS NOT NULL THEN
    SELECT telegram_id INTO v_tg
    FROM telegram_sessions
    WHERE telegram_id = v_tg_from_expired AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_tg IS NOT NULL THEN
      RETURN v_tg;
    END IF;
  END IF;

  RAISE EXCEPTION 'session_invalid_or_expired' USING ERRCODE = '28000';
END;
$function$;
