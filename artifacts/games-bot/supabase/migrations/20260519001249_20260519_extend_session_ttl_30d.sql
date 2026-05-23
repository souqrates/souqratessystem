/*
  # Extend telegram_sessions TTL to 30 days + auto-renew on use

  ## Problem
  Sessions expire after 24 hours, causing players to lose access after one day.
  pay_resolve_session does not update expires_at, so sessions silently expire.

  ## Changes
  1. Change default expires_at from 24h to 30d for all new sessions
  2. Update all currently-valid sessions to also get 30d TTL
  3. Modify pay_resolve_session to auto-renew sessions that are still valid
     (extends TTL by 30 days on each successful resolution)
*/

-- 1. Change default TTL to 30 days for new sessions
ALTER TABLE telegram_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- 2. Extend all currently-valid sessions to 30 days from now
UPDATE telegram_sessions
SET expires_at = now() + interval '30 days'
WHERE expires_at > now();

-- 3. Rebuild pay_resolve_session to auto-renew on use
CREATE OR REPLACE FUNCTION public.pay_resolve_session(p_session_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_tg bigint;
BEGIN
  -- Fetch and auto-renew session in one shot
  UPDATE telegram_sessions
  SET    expires_at = now() + interval '30 days'
  WHERE  id         = p_session_id
    AND  expires_at > now()
  RETURNING telegram_id INTO v_tg;

  RETURN v_tg;  -- NULL when session not found or expired
END;
$$;
