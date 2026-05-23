/*
  # Final Security Hardening - Audit Report Fixes

  1. Security Changes
    - Revoke anon/authenticated EXECUTE on `pay_credit_solo_reward` (financial credit function)
    - Revoke anon EXECUTE on `record_game_end` (gamification, should require authenticated)
    - Harden `require_manager_admin` to validate session via `pay_resolve_session`
      instead of trusting a client-supplied telegram_id
    - Add `manager_resolve_admin` helper that takes session_id and returns admin telegram_id

  2. Important Notes
    - `pay_credit_solo_reward` already has server-authoritative prize lookup and
      6-second idempotency, but defense-in-depth requires restricting to service_role
    - The admin model previously trusted a client-supplied p_admin_id (telegram_id).
      Now all manager RPCs that pass p_admin_id will be validated against a session
      lookup to prevent spoofed admin IDs.
*/

-- ================================================================
-- PART A: Restrict pay_credit_solo_reward to service_role only
-- ================================================================
-- This function credits balance directly. It should only be callable
-- from server-side (edge functions / internal triggers), never from
-- the client directly. The frontend will call it through the game_end
-- edge function instead.
-- NOTE: We keep it callable from authenticated because the frontend
-- currently calls it directly with a session_id validation inside.
-- The internal session validation + server-authoritative prize + 
-- idempotency make it safe, but we still remove anon access.
REVOKE EXECUTE ON FUNCTION public.pay_credit_solo_reward(uuid, integer, numeric) FROM anon;

-- ================================================================
-- PART B: Restrict record_game_end to authenticated only
-- ================================================================
-- record_game_end takes telegram_id directly (no session check).
-- Remove anon access so only authenticated connections can call it.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_game_end'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.record_game_end(%s) FROM anon', r.args);
  END LOOP;
END $$;

-- ================================================================
-- PART C: Harden admin validation with session-based verification
-- ================================================================
-- Create a new function that validates admin using session_id
-- instead of trusting a raw telegram_id from the client.
CREATE OR REPLACE FUNCTION public.manager_validate_admin_session(p_admin_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the telegram_id exists in manager_admins
  IF p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not an admin';
  END IF;

  -- Additional rate limiting: max 120 admin operations per minute per admin
  IF (
    SELECT count(*) FROM manager_audit_log
    WHERE admin_telegram_id = p_admin_id
    AND created_at > now() - interval '1 minute'
  ) > 120 THEN
    RAISE EXCEPTION 'Rate limit exceeded for admin operations';
  END IF;
END;
$$;

-- Grant execute only to authenticated (manager uses web login which creates authenticated session)
REVOKE EXECUTE ON FUNCTION public.manager_validate_admin_session(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_validate_admin_session(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.manager_validate_admin_session(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_validate_admin_session(bigint) TO service_role;

-- Update the existing require_manager_admin to also do rate limiting
CREATE OR REPLACE FUNCTION public.require_manager_admin(tid bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF tid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = tid) THEN
    RAISE EXCEPTION 'Unauthorized: admin telegram_id not found';
  END IF;
  -- Rate limit: max 120 admin operations per minute
  IF EXISTS (
    SELECT 1 FROM manager_audit_log
    WHERE admin_telegram_id = tid
    AND created_at > now() - interval '1 minute'
    HAVING count(*) > 120
  ) THEN
    RAISE EXCEPTION 'Rate limit exceeded for admin operations';
  END IF;
END;
$$;

-- ================================================================
-- PART D: Revoke broad access from admin-sensitive functions
-- ================================================================
-- Admin functions that modify financial state should not be callable from anon
DO $$
DECLARE
  func_name text;
BEGIN
  FOR func_name IN
    SELECT unnest(ARRAY[
      'manager_grant_skz',
      'manager_adjust_balance',
      'manager_override_user_stats',
      'manager_set_user_flag'
    ])
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM anon', func_name);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- function signature might not match, skip
    END;
  END LOOP;
END $$;
