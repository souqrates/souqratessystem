/*
  # Game End Gamification Hook

  Adds `record_game_end` RPC that atomically:
  1. Increments total_games / total_wins on user_gamification
  2. Awards XP based on outcome
  3. Auto-unlocks milestone achievements (first_win, win_10, win_100,
     games_10, games_50, games_500, level_5, level_25, level_50)

  This keeps the client tamper-resistant — the client only reports
  win|loss and the server decides everything else.
*/

CREATE OR REPLACE FUNCTION record_game_end(p_telegram_id bigint, p_won boolean)
RETURNS user_gamification LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row     user_gamification;
  v_xp_gain integer;
BEGIN
  IF p_telegram_id IS NULL THEN RAISE EXCEPTION 'invalid telegram id'; END IF;

  v_xp_gain := CASE WHEN p_won THEN 40 ELSE 10 END;

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

  -- Unlock milestone achievements
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

GRANT EXECUTE ON FUNCTION record_game_end(bigint, boolean) TO authenticated, anon;