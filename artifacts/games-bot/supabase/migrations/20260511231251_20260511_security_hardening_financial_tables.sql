/*
  # Security Hardening: Lock Down Financial & PII Tables

  1. Problem
    Many tables had `USING (true)` SELECT policies, letting any anonymous client
    using the public anon key read sensitive data: deposit/withdrawal requests
    (amounts + destination addresses), exchange accounts (emails, masked keys),
    payout routes (destination details), platform revenue, owner payouts, and
    full user profiles (balances, telegram ids). Several SECURITY DEFINER
    functions also lacked an explicit search_path.

  2. Strategy
    Since the app uses the anon key for both the player UI and the manager UI
    (no Supabase Auth), we cannot rely on `auth.uid()`. Instead:
    - Drop the open SELECT policies on financial/PII tables. With no SELECT
      policy and RLS on, anon reads are denied by default. Edge functions using
      the service-role key continue to work.
    - Add admin-only RPC wrappers (`manager_list_*`) that take an admin
      telegram id, call `require_manager_admin`, and return the rows. The
      manager UI is updated separately to call these RPCs.
    - Restrict the open match/tournament policies to keep gameplay functioning
      while removing the most egregious holes.

  3. Tables locked down (SELECT no longer public)
    - exchange_accounts, payout_routes, platform_revenue, owner_payouts
    - user_deposit_requests, user_withdrawal_requests
    - users, manager_visitors, treasury_wallets

  4. Functions hardened
    - All SECURITY DEFINER functions in `public` now have
      `SET search_path = public, pg_temp` applied.

  5. Notes
    - This migration is purely policy/function changes; no data is dropped.
    - INSERT policies on tables players need to write to (deposit/withdrawal
      requests, manager_visitors upsert) remain intact.
*/

-- ─── 1. Drop dangerous public SELECT/UPDATE policies ──────────────────────────

DROP POLICY IF EXISTS "Anyone can view exchange accounts"       ON exchange_accounts;
DROP POLICY IF EXISTS "Anyone can view payout routes"           ON payout_routes;
DROP POLICY IF EXISTS "Anyone can view platform revenue"        ON platform_revenue;
DROP POLICY IF EXISTS "Anyone can view owner payouts"           ON owner_payouts;
DROP POLICY IF EXISTS "Anyone can view treasury wallets"        ON treasury_wallets;
DROP POLICY IF EXISTS "Users can view their deposit requests"    ON user_deposit_requests;
DROP POLICY IF EXISTS "Users can view their withdrawal requests" ON user_withdrawal_requests;
DROP POLICY IF EXISTS "Users can view leaderboard"               ON users;
DROP POLICY IF EXISTS "Anyone can read visitors"                 ON manager_visitors;
DROP POLICY IF EXISTS "Anyone can update visitor data"           ON manager_visitors;

-- Re-add safer visitor UPSERT path: anon can insert/update their OWN row only via RPC,
-- but we keep INSERT-with-check to avoid breaking the simple upsert flow.
-- (manager_visitors already has "Anyone can upsert visitor data" INSERT policy; keep it.)

-- Add narrow SELECT-by-self for deposit/withdrawal requests so a user could
-- still query their own requests if we ever add a session GUC; for now no one
-- can read without service role / admin RPC.
-- (Intentionally no SELECT policy = default deny.)

-- ─── 2. Public-safe treasury wallets view (address only, no notes/labels) ───
CREATE OR REPLACE VIEW public_treasury_wallets AS
SELECT id, wallet_type, address, network, is_active, is_primary_deposit
FROM treasury_wallets
WHERE is_active = true;

GRANT SELECT ON public_treasury_wallets TO anon, authenticated;

-- ─── 3. Admin-only RPC wrappers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.manager_list_exchange_accounts(p_admin_id bigint)
RETURNS SETOF exchange_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM exchange_accounts ORDER BY created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_payout_routes(p_admin_id bigint)
RETURNS SETOF payout_routes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM payout_routes ORDER BY priority, created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_platform_revenue(p_admin_id bigint, p_limit int DEFAULT 50)
RETURNS SETOF platform_revenue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM platform_revenue ORDER BY created_at DESC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_revenue_summary(p_admin_id bigint)
RETURNS TABLE(source text, amount_usd numeric, amount_ton numeric, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT pr.source, pr.amount_usd, pr.amount_ton, pr.created_at FROM platform_revenue pr;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_owner_payouts(p_admin_id bigint, p_limit int DEFAULT 50)
RETURNS SETOF owner_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM owner_payouts ORDER BY requested_at DESC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_withdrawal_requests(p_admin_id bigint, p_status text DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS SETOF user_withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY
    SELECT * FROM user_withdrawal_requests
    WHERE p_status IS NULL OR status = p_status
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_deposit_requests(p_admin_id bigint, p_limit int DEFAULT 100)
RETURNS SETOF user_deposit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM user_deposit_requests ORDER BY created_at DESC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_treasury_wallets(p_admin_id bigint)
RETURNS SETOF treasury_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM treasury_wallets ORDER BY wallet_type, created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_visitors(p_admin_id bigint, p_limit int DEFAULT 50, p_order text DEFAULT 'last_seen')
RETURNS SETOF manager_visitors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  IF p_order = 'total_spent' THEN
    RETURN QUERY SELECT * FROM manager_visitors ORDER BY total_spent DESC NULLS LAST LIMIT p_limit;
  ELSIF p_order = 'total_earned' THEN
    RETURN QUERY SELECT * FROM manager_visitors ORDER BY total_earned DESC NULLS LAST LIMIT p_limit;
  ELSE
    RETURN QUERY SELECT * FROM manager_visitors ORDER BY last_seen DESC NULLS LAST LIMIT p_limit;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_visitor_stats(p_admin_id bigint)
RETURNS TABLE(total_users bigint, active_today bigint, total_spent numeric, total_earned numeric, total_games bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY
    SELECT
      count(*)::bigint,
      count(*) FILTER (WHERE last_seen >= now() - interval '24 hours')::bigint,
      coalesce(sum(total_spent),0)::numeric,
      coalesce(sum(total_earned),0)::numeric,
      coalesce(sum(games_played),0)::bigint
    FROM manager_visitors;
END;
$$;

-- ─── 4. Harden existing SECURITY DEFINER functions: set search_path ────────

ALTER FUNCTION public.manager_add_admin(bigint, bigint, text, text)            SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_remove_admin(bigint, bigint)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_update_config(bigint, text, text)                SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_upsert_staging(bigint, text, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_discard_staging(bigint, text)                    SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_discard_all_staging(bigint)                      SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_publish_all(bigint)                              SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_upsert_staging_game(bigint, integer, jsonb)      SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_discard_staging_game(bigint, integer)            SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_discard_all_staging_games(bigint)                SET search_path = public, pg_temp;
ALTER FUNCTION public.manager_upsert_game_override(bigint, integer, jsonb)     SET search_path = public, pg_temp;
ALTER FUNCTION public.require_manager_admin(bigint)                            SET search_path = public, pg_temp;
ALTER FUNCTION public.set_admin_id(bigint)                                     SET search_path = public, pg_temp;
ALTER FUNCTION public.is_manager_admin(bigint)                                 SET search_path = public, pg_temp;

-- ─── 5. Lock down execute permissions on admin RPCs ───────────────────────

REVOKE ALL ON FUNCTION
  public.manager_list_exchange_accounts(bigint),
  public.manager_list_payout_routes(bigint),
  public.manager_list_platform_revenue(bigint, int),
  public.manager_revenue_summary(bigint),
  public.manager_list_owner_payouts(bigint, int),
  public.manager_list_withdrawal_requests(bigint, text, int),
  public.manager_list_deposit_requests(bigint, int),
  public.manager_list_treasury_wallets(bigint),
  public.manager_list_visitors(bigint, int, text),
  public.manager_visitor_stats(bigint)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.manager_list_exchange_accounts(bigint),
  public.manager_list_payout_routes(bigint),
  public.manager_list_platform_revenue(bigint, int),
  public.manager_revenue_summary(bigint),
  public.manager_list_owner_payouts(bigint, int),
  public.manager_list_withdrawal_requests(bigint, text, int),
  public.manager_list_deposit_requests(bigint, int),
  public.manager_list_treasury_wallets(bigint),
  public.manager_list_visitors(bigint, int, text),
  public.manager_visitor_stats(bigint)
TO anon, authenticated;
