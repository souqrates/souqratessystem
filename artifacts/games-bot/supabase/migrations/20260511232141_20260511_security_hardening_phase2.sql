/*
  # Security Hardening Phase 2

  1. Goal
    Address remaining Supabase advisor warnings without breaking gameplay.

  2. Changes
    a. View `public_treasury_wallets` recreated with `security_invoker = on`.
    b. Drop unused open INSERT policies on `user_deposit_requests` and
       `user_withdrawal_requests` (writes go through SECURITY DEFINER RPCs).
    c. Drop open `manager_visitors` upsert policy; add `track_visitor` RPC.
    d. Drop open `manager_admins` SELECT policy; add `check_is_admin` and
       `manager_list_admins` RPCs.
    e. Tighten `tournament_players` UPDATE policy using `current_setting`
       session GUC `app.player_id` for ownership.

  3. What is intentionally still public
    `games`, `manager_config`, `manager_games`, `manager_preview_config`,
    `manager_preview_games`, `hall_of_fame`, `leaderboard` — public by design.
    Gameplay tables remain accessible for direct client writes; anti-cheat
    runs in edge functions.
*/

ALTER VIEW public_treasury_wallets SET (security_invoker = on);

DROP POLICY IF EXISTS "Users can create deposit requests"    ON user_deposit_requests;
DROP POLICY IF EXISTS "Users can create withdrawal requests" ON user_withdrawal_requests;

DROP POLICY IF EXISTS "Anyone can upsert visitor data" ON manager_visitors;

CREATE OR REPLACE FUNCTION public.track_visitor(
  p_telegram_id bigint,
  p_first_name  text DEFAULT '',
  p_username    text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_telegram_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO manager_visitors (telegram_id, first_name, username, last_seen, session_count)
  VALUES (p_telegram_id, coalesce(p_first_name,''), coalesce(p_username,''), now(), 1)
  ON CONFLICT (telegram_id) DO UPDATE
    SET first_name    = EXCLUDED.first_name,
        username      = EXCLUDED.username,
        last_seen     = now(),
        session_count = coalesce(manager_visitors.session_count,0) + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.track_visitor(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_visitor(bigint, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read admins for auth" ON manager_admins;

CREATE OR REPLACE FUNCTION public.check_is_admin(p_telegram_id bigint)
RETURNS TABLE(telegram_id bigint, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT a.telegram_id, a.name, a.role
    FROM manager_admins a
    WHERE a.telegram_id = p_telegram_id
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_is_admin(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_admin(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.manager_list_admins(p_admin_id bigint)
RETURNS SETOF manager_admins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  RETURN QUERY SELECT * FROM manager_admins ORDER BY created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.manager_list_admins(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_list_admins(bigint) TO anon, authenticated;

DROP POLICY IF EXISTS "Players can update own score" ON tournament_players;
CREATE POLICY "Players can update own score"
  ON tournament_players FOR UPDATE
  TO anon, authenticated
  USING (
    coalesce(current_setting('app.player_id', true), '') <> ''
    AND player_id::text = current_setting('app.player_id', true)
  )
  WITH CHECK (
    player_id::text = current_setting('app.player_id', true)
  );
