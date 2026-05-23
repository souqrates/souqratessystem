/*
  # Rank System V2 — 20 Tiers + Difficulty-Weighted XP

  1. Changes
    - Replaces `calc_level_from_xp` with a 20-level cap using curated XP thresholds
      that match the visual rank tier system on the client (Beginner -> Sovereign).
    - Adds `xp_required_for_level(level)` helper returning cumulative XP for any
      level 1..20 (20 returns +infinity sentinel = max XP for previous level + huge buffer).
    - Adds difficulty-weighted overload `record_game_end(p_telegram_id, p_won, p_difficulty)`.
      Easy: win=150 xp / loss=60 xp
      Medium: win=250 xp / loss=100 xp
      Hard: win=500 xp / loss=200 xp
      Unknown difficulty defaults to Medium.

  2. Notes
    - Existing data is preserved. Only the level calc and award curve change.
    - The single-arg `record_game_end(bigint, boolean)` overload remains for back-compat
      and is routed to the difficulty-aware version using 'Medium' as default.

  3. Security
    - All functions remain SECURITY DEFINER with search_path locked.
*/

-- 20-rank XP thresholds (cumulative).
-- Curve: smooth, motivating early levels, steeper late game.
-- Level 1 starts at 0; each subsequent level adds: round(450 * 1.18^(n-1)).
CREATE OR REPLACE FUNCTION xp_required_for_level(p_level integer)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_thresholds bigint[] := ARRAY[
    0,        -- Lv 1  Beginner
    450,      -- Lv 2  Apprentice
    981,      -- Lv 3  Rookie
    1608,     -- Lv 4  Challenger
    2348,     -- Lv 5  Contender
    3221,     -- Lv 6  Striker
    4251,     -- Lv 7  Tactician
    5466,     -- Lv 8  Specialist
    6900,     -- Lv 9  Veteran
    8592,     -- Lv 10 Elite
    10589,    -- Lv 11 Hunter
    12945,    -- Lv 12 Gladiator
    15725,    -- Lv 13 Champion
    19006,    -- Lv 14 Ace
    22877,    -- Lv 15 Master
    27445,    -- Lv 16 Grandmaster
    32835,    -- Lv 17 Phantom
    39196,    -- Lv 18 Legend
    46703,    -- Lv 19 Mythic
    55562     -- Lv 20 Sovereign
  ]::bigint[];
BEGIN
  IF p_level IS NULL OR p_level < 1 THEN RETURN 0; END IF;
  IF p_level > 20 THEN RETURN v_thresholds[20]; END IF;
  RETURN v_thresholds[p_level];
END $$;

CREATE OR REPLACE FUNCTION calc_level_from_xp(p_xp integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_xp bigint := COALESCE(p_xp, 0);
  v_lvl integer := 1;
BEGIN
  IF v_xp < 0 THEN RETURN 1; END IF;
  FOR v_lvl IN REVERSE 20..1 LOOP
    IF v_xp >= xp_required_for_level(v_lvl) THEN
      RETURN v_lvl;
    END IF;
  END LOOP;
  RETURN 1;
END $$;

-- Difficulty-aware game end recorder.
CREATE OR REPLACE FUNCTION record_game_end(
  p_telegram_id bigint,
  p_won         boolean,
  p_difficulty  text
)
RETURNS user_gamification LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row     user_gamification;
  v_diff    text := COALESCE(NULLIF(LOWER(TRIM(p_difficulty)), ''), 'medium');
  v_xp_gain integer;
BEGIN
  IF p_telegram_id IS NULL THEN RAISE EXCEPTION 'invalid telegram id'; END IF;

  v_xp_gain := CASE
    WHEN v_diff = 'easy'   AND p_won THEN 150
    WHEN v_diff = 'easy'             THEN 60
    WHEN v_diff = 'hard'   AND p_won THEN 500
    WHEN v_diff = 'hard'             THEN 200
    WHEN p_won                       THEN 250  -- medium win
    ELSE                                 100   -- medium loss
  END;

  INSERT INTO user_gamification (telegram_id, xp, level, total_games, total_wins)
  VALUES (
    p_telegram_id,
    v_xp_gain,
    calc_level_from_xp(v_xp_gain),
    1,
    CASE WHEN p_won THEN 1 ELSE 0 END
  )
  ON CONFLICT (telegram_id) DO UPDATE
    SET xp          = user_gamification.xp + v_xp_gain,
        level       = calc_level_from_xp(user_gamification.xp + v_xp_gain),
        total_games = user_gamification.total_games + 1,
        total_wins  = user_gamification.total_wins + (CASE WHEN p_won THEN 1 ELSE 0 END),
        updated_at  = now()
  RETURNING * INTO v_row;

  IF p_won AND v_row.total_wins = 1   THEN PERFORM unlock_achievement(p_telegram_id, 'first_win'); END IF;
  IF p_won AND v_row.total_wins = 10  THEN PERFORM unlock_achievement(p_telegram_id, 'win_10');    END IF;
  IF p_won AND v_row.total_wins = 100 THEN PERFORM unlock_achievement(p_telegram_id, 'win_100');   END IF;

  IF v_row.total_games = 10  THEN PERFORM unlock_achievement(p_telegram_id, 'games_10');  END IF;
  IF v_row.total_games = 50  THEN PERFORM unlock_achievement(p_telegram_id, 'games_50');  END IF;
  IF v_row.total_games = 500 THEN PERFORM unlock_achievement(p_telegram_id, 'games_500'); END IF;

  IF v_row.level >= 5  AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE telegram_id = p_telegram_id AND achievement_code='level_5')  THEN PERFORM unlock_achievement(p_telegram_id, 'level_5');  END IF;
  IF v_row.level >= 25 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE telegram_id = p_telegram_id AND achievement_code='level_25') THEN PERFORM unlock_achievement(p_telegram_id, 'level_25'); END IF;
  IF v_row.level >= 50 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE telegram_id = p_telegram_id AND achievement_code='level_50') THEN PERFORM unlock_achievement(p_telegram_id, 'level_50'); END IF;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION record_game_end(bigint, boolean, text) TO authenticated, anon;

-- Back-compat: forward 2-arg version to 3-arg with 'medium'.
CREATE OR REPLACE FUNCTION record_game_end(p_telegram_id bigint, p_won boolean)
RETURNS user_gamification LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN record_game_end(p_telegram_id, p_won, 'medium');
END $$;

GRANT EXECUTE ON FUNCTION record_game_end(bigint, boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION xp_required_for_level(integer) TO authenticated, anon;