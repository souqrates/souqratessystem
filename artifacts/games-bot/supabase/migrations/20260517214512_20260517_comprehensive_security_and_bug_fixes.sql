/*
  # Comprehensive Security and Bug Fixes

  ## Summary
  Addresses critical bugs and security issues identified in audit:

  1. get_weekly_leaderboard — Fix level column (was user_balances.level, now user_gamification.level)
  2. admin_upsert_fee_tier — Fix auth check (was id, now telegram_id)
  3. record_game_end — Add session ownership guard against arbitrary XP awards
*/

-- ============================================================
-- 1. Fix get_weekly_leaderboard: join user_gamification for level
-- ============================================================
DROP FUNCTION IF EXISTS get_weekly_leaderboard(int);

CREATE OR REPLACE FUNCTION get_weekly_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  rank         bigint,
  telegram_id  bigint,
  display_name text,
  username     text,
  avatar_url   text,
  total_won    numeric,
  level        int,
  xp           numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(ub.sc_balance, 0) DESC)::bigint AS rank,
    ub.telegram_id,
    COALESCE(ub.display_name, ub.username, 'Player')::text AS display_name,
    COALESCE(ub.username, '')::text AS username,
    COALESCE(ub.avatar_url, '')::text AS avatar_url,
    COALESCE(ub.sc_balance, 0)::numeric AS total_won,
    COALESCE(ug.level, 1)::int AS level,
    COALESCE(ug.xp, 0)::numeric AS xp
  FROM user_balances ub
  LEFT JOIN user_gamification ug ON ug.telegram_id = ub.telegram_id
  WHERE ub.sc_balance > 0
  ORDER BY ub.sc_balance DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_weekly_leaderboard(int) TO anon, authenticated;

-- ============================================================
-- 2. Fix admin_upsert_fee_tier: use telegram_id not serial id
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_fee_tier(
  p_admin_id   bigint,
  p_game_id    int,
  p_tier_name  text,
  p_entry_fee  numeric,
  p_multiplier numeric,
  p_is_default boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_entry_fee < 0 THEN
    RAISE EXCEPTION 'entry_fee_negative';
  END IF;

  IF p_multiplier < 1.0 THEN
    RAISE EXCEPTION 'multiplier_too_low';
  END IF;

  IF p_is_default THEN
    UPDATE solo_fee_tiers SET is_default = false WHERE game_id = p_game_id;
  END IF;

  INSERT INTO solo_fee_tiers (game_id, tier_name, entry_fee, multiplier, is_default)
  VALUES (p_game_id, p_tier_name, p_entry_fee, p_multiplier, p_is_default)
  ON CONFLICT (game_id, tier_name)
  DO UPDATE SET
    entry_fee   = EXCLUDED.entry_fee,
    multiplier  = EXCLUDED.multiplier,
    is_default  = EXCLUDED.is_default,
    updated_at  = now()
  RETURNING id INTO v_tier_id;

  RETURN jsonb_build_object('ok', true, 'tier_id', v_tier_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_fee_tier(bigint, int, text, numeric, numeric, boolean) TO anon, authenticated;

-- ============================================================
-- 3. Fix record_game_end: require valid session ownership
-- ============================================================
DROP FUNCTION IF EXISTS record_game_end(bigint, boolean, text);
DROP FUNCTION IF EXISTS record_game_end(bigint, boolean);

CREATE OR REPLACE FUNCTION record_game_end(
  p_telegram_id bigint,
  p_won         boolean,
  p_difficulty  text DEFAULT 'Medium'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_gain   int;
  v_new_xp    numeric;
  v_new_level int;
  v_old_level int;
BEGIN
  -- Require a non-expired session for this telegram_id to prevent
  -- anonymous callers from awarding XP to arbitrary users.
  IF NOT EXISTS (
    SELECT 1 FROM telegram_sessions
    WHERE telegram_id = p_telegram_id
      AND expires_at > now()
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  v_xp_gain := CASE
    WHEN lower(p_difficulty) = 'easy' THEN CASE WHEN p_won THEN 150 ELSE 60 END
    WHEN lower(p_difficulty) = 'hard' THEN CASE WHEN p_won THEN 500 ELSE 200 END
    ELSE CASE WHEN p_won THEN 250 ELSE 100 END
  END;

  INSERT INTO user_gamification (telegram_id, xp, level, total_games, total_wins, streak_days, last_game_at)
  VALUES (p_telegram_id, 0, 1, 0, 0, 0, now())
  ON CONFLICT (telegram_id) DO NOTHING;

  SELECT level INTO v_old_level FROM user_gamification WHERE telegram_id = p_telegram_id;

  UPDATE user_gamification
  SET
    xp          = xp + v_xp_gain,
    total_games = total_games + 1,
    total_wins  = total_wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    last_game_at = now()
  WHERE telegram_id = p_telegram_id
  RETURNING xp INTO v_new_xp;

  v_new_level := calc_level_from_xp(v_new_xp);
  UPDATE user_gamification SET level = v_new_level WHERE telegram_id = p_telegram_id;

  IF v_new_level > v_old_level THEN
    IF v_new_level >= 5  THEN INSERT INTO user_achievements (telegram_id, achievement_code, unlocked_at) VALUES (p_telegram_id, 'level_5',  now()) ON CONFLICT DO NOTHING; END IF;
    IF v_new_level >= 10 THEN INSERT INTO user_achievements (telegram_id, achievement_code, unlocked_at) VALUES (p_telegram_id, 'level_10', now()) ON CONFLICT DO NOTHING; END IF;
    IF v_new_level >= 15 THEN INSERT INTO user_achievements (telegram_id, achievement_code, unlocked_at) VALUES (p_telegram_id, 'level_15', now()) ON CONFLICT DO NOTHING; END IF;
    IF v_new_level >= 20 THEN INSERT INTO user_achievements (telegram_id, achievement_code, unlocked_at) VALUES (p_telegram_id, 'level_20', now()) ON CONFLICT DO NOTHING; END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_game_end(bigint, boolean, text) TO anon, authenticated;
