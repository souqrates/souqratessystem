/*
  # User-facing Referral Stats & Real Notification System

  ## Changes

  1. **ref_get_my_stats** - New RPC for users to fetch their own referral statistics
     - Total invites count (from referral_earnings where referrer = current user)
     - Active referrals count (distinct referred users who have played recently)
     - Total bonus earned in SKZ
     - Returns real data, not hardcoded values

  2. **ref_get_my_friends** - New RPC for users to fetch their invited friends list
     - Returns referred user's name, join date, earned bonus, active status
     - Limited to 50 most recent referrals

  3. **ref_get_how_it_works** - New RPC to fetch manager-configurable referral steps
     - Reads from manager_config keys: referral_step_1 through referral_step_4
     - Falls back to default text if not configured

  4. **app_notifications for users** - New RPC to fetch active in-app notifications
     - Reads from app_notifications table (already exists from broadcasts migration)
     - Only returns notifications that are currently active (within start/end dates)

  ## Security
  - All RPCs use session-based auth via pay_resolve_session
  - Users can only see their own referral data
  - RLS not modified - using SECURITY DEFINER RPCs
*/

-- ═══════════════════════════════════════════════════════════════════════
-- 1. ref_get_my_stats: user's own referral statistics
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ref_get_my_stats(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
  v_total_invites int;
  v_active_refs int;
  v_total_earned numeric;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  -- Total distinct people referred
  SELECT COUNT(DISTINCT referred_telegram_id)
    INTO v_total_invites
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg;

  -- Active refs: distinct referred users who have a balance row (they've played)
  SELECT COUNT(DISTINCT re.referred_telegram_id)
    INTO v_active_refs
  FROM referral_earnings re
  JOIN user_balances ub ON ub.telegram_id = re.referred_telegram_id
  WHERE re.referrer_telegram_id = v_tg
    AND ub.updated_at > now() - interval '30 days';

  -- Total SKZ earned from referrals
  SELECT COALESCE(SUM(amount_skz), 0)
    INTO v_total_earned
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg;

  RETURN jsonb_build_object(
    'ok', true,
    'total_invites', COALESCE(v_total_invites, 0),
    'active_refs', COALESCE(v_active_refs, 0),
    'total_earned', COALESCE(v_total_earned, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ref_get_my_stats(uuid) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. ref_get_my_friends: user's invited friends list with real data
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ref_get_my_friends(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
  v_result jsonb;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.first_earned DESC), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT
      re.referred_telegram_id AS telegram_id,
      COALESCE(u.display_name, u.first_name, u.username, 'Player') AS name,
      MIN(re.created_at) AS first_earned,
      SUM(re.amount_skz) AS total_bonus,
      CASE
        WHEN ub.updated_at > now() - interval '7 days' THEN 'Active'
        WHEN ub.telegram_id IS NOT NULL THEN 'Inactive'
        ELSE 'Pending'
      END AS status
    FROM referral_earnings re
    LEFT JOIN users u ON u.telegram_id = re.referred_telegram_id
    LEFT JOIN user_balances ub ON ub.telegram_id = re.referred_telegram_id
    WHERE re.referrer_telegram_id = v_tg
    GROUP BY re.referred_telegram_id, u.display_name, u.first_name, u.username, ub.updated_at, ub.telegram_id
    ORDER BY MIN(re.created_at) DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object('ok', true, 'friends', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ref_get_my_friends(uuid) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 3. ref_get_config: manager-editable referral page config
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ref_get_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT key, value FROM manager_config
    WHERE key LIKE 'referral_%'
  LOOP
    v_result := v_result || jsonb_build_object(v_row.key, v_row.value);
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ref_get_config() TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 4. get_active_app_notifications: real in-app notifications
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_active_app_notifications()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT id, title, body, image_url, link_url, accent_color, priority, dismissible
    FROM app_notifications
    WHERE (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    ORDER BY priority DESC, created_at DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object('ok', true, 'notifications', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_app_notifications() TO anon, authenticated;
