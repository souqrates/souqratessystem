/*
  # Fix manager_publish_all and manager_sync_all_games_to_live

  ## Problem
  Both functions insert into manager_audit_log using a column named `details`
  which does not exist. The actual column name is `payload`. This causes the
  entire function to crash, and Supabase surfaces the error as
  "delete requires a where clause" because the error occurs after the DELETE
  statements have already been planned.

  ## Changes
  - Rewrite manager_publish_all: replace `details` with `payload` in audit log INSERT
  - Rewrite manager_sync_all_games_to_live: replace `details` with `payload`
  - Add SET search_path on both functions for security
  - Re-grant EXECUTE to authenticated on both
*/

CREATE OR REPLACE FUNCTION manager_publish_all(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config_count integer := 0;
  v_games_count  integer := 0;
  v_row manager_preview_games%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Publish config
  INSERT INTO manager_config (id, key, value, type, category, label, description, updated_at)
  SELECT id, key, value, type, category, label, key, now()
  FROM manager_preview_config
  ON CONFLICT (key) DO UPDATE SET
    value      = EXCLUDED.value,
    type       = EXCLUDED.type,
    category   = EXCLUDED.category,
    label      = EXCLUDED.label,
    updated_at = now();

  GET DIAGNOSTICS v_config_count = ROW_COUNT;
  DELETE FROM manager_preview_config WHERE id IS NOT NULL;

  -- Publish games
  FOR v_row IN SELECT * FROM manager_preview_games LOOP
    INSERT INTO manager_games (
      game_id, enabled, name_override, emoji_override, reward_override,
      difficulty_override, desc_override, entry_fee_skz, win_prize_skz,
      target_score, rules_override, subtitle_override, win_label_override,
      lose_label_override, cta_label_override, duration_seconds,
      trap_penalty, max_score, solo_win_score, max_plausible_score,
      image_url, updated_at
    ) VALUES (
      v_row.game_id, v_row.enabled, v_row.name_override, v_row.emoji_override,
      v_row.reward_override, v_row.difficulty_override, v_row.desc_override,
      v_row.entry_fee_skz, v_row.win_prize_skz, v_row.target_score,
      v_row.rules_override, v_row.subtitle_override, v_row.win_label_override,
      v_row.lose_label_override, v_row.cta_label_override, v_row.duration_seconds,
      v_row.trap_penalty, v_row.max_score, v_row.solo_win_score, v_row.max_plausible_score,
      v_row.image_url, now()
    )
    ON CONFLICT (game_id) DO UPDATE SET
      enabled             = COALESCE(v_row.enabled,             manager_games.enabled),
      name_override       = COALESCE(v_row.name_override,       manager_games.name_override),
      emoji_override      = COALESCE(v_row.emoji_override,      manager_games.emoji_override),
      reward_override     = COALESCE(v_row.reward_override,     manager_games.reward_override),
      difficulty_override = COALESCE(v_row.difficulty_override, manager_games.difficulty_override),
      desc_override       = COALESCE(v_row.desc_override,       manager_games.desc_override),
      entry_fee_skz       = COALESCE(v_row.entry_fee_skz,       manager_games.entry_fee_skz),
      win_prize_skz       = COALESCE(v_row.win_prize_skz,       manager_games.win_prize_skz),
      target_score        = COALESCE(v_row.target_score,        manager_games.target_score),
      rules_override      = COALESCE(v_row.rules_override,      manager_games.rules_override),
      subtitle_override   = COALESCE(v_row.subtitle_override,   manager_games.subtitle_override),
      win_label_override  = COALESCE(v_row.win_label_override,  manager_games.win_label_override),
      lose_label_override = COALESCE(v_row.lose_label_override, manager_games.lose_label_override),
      cta_label_override  = COALESCE(v_row.cta_label_override,  manager_games.cta_label_override),
      duration_seconds    = COALESCE(v_row.duration_seconds,    manager_games.duration_seconds),
      trap_penalty        = COALESCE(v_row.trap_penalty,        manager_games.trap_penalty),
      max_score           = COALESCE(v_row.max_score,           manager_games.max_score),
      solo_win_score      = COALESCE(v_row.solo_win_score,      manager_games.solo_win_score),
      max_plausible_score = COALESCE(v_row.max_plausible_score, manager_games.max_plausible_score),
      image_url           = COALESCE(v_row.image_url,           manager_games.image_url),
      updated_at          = now();

    -- Also sync to game_advanced_configs
    INSERT INTO game_advanced_configs (
      game_id, enabled, entry_fee_skz, win_prize_skz, target_score,
      time_limit_sec, trap_penalty, max_score, solo_win_score, max_plausible_score,
      image_url, updated_at
    ) VALUES (
      v_row.game_id, COALESCE(v_row.enabled, true),
      v_row.entry_fee_skz, v_row.win_prize_skz, v_row.target_score,
      v_row.duration_seconds, v_row.trap_penalty, v_row.max_score,
      v_row.solo_win_score, v_row.max_plausible_score,
      v_row.image_url, now()
    )
    ON CONFLICT (game_id) DO UPDATE SET
      enabled             = COALESCE(v_row.enabled,             game_advanced_configs.enabled),
      entry_fee_skz       = COALESCE(v_row.entry_fee_skz,       game_advanced_configs.entry_fee_skz),
      win_prize_skz       = COALESCE(v_row.win_prize_skz,       game_advanced_configs.win_prize_skz),
      target_score        = COALESCE(v_row.target_score,        game_advanced_configs.target_score),
      time_limit_sec      = COALESCE(v_row.duration_seconds,    game_advanced_configs.time_limit_sec),
      trap_penalty        = COALESCE(v_row.trap_penalty,        game_advanced_configs.trap_penalty),
      max_score           = COALESCE(v_row.max_score,           game_advanced_configs.max_score),
      solo_win_score      = COALESCE(v_row.solo_win_score,      game_advanced_configs.solo_win_score),
      max_plausible_score = COALESCE(v_row.max_plausible_score, game_advanced_configs.max_plausible_score),
      image_url           = COALESCE(v_row.image_url,           game_advanced_configs.image_url),
      updated_at          = now();

    v_games_count := v_games_count + 1;
  END LOOP;

  DELETE FROM manager_preview_games WHERE id IS NOT NULL;

  -- FIX: column is 'payload', not 'details'
  INSERT INTO manager_audit_log (admin_id, action, payload)
  VALUES (p_admin_id, 'publish_all', jsonb_build_object(
    'config_count', v_config_count, 'games_count', v_games_count
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_config_count + v_games_count,
    'config_count', v_config_count,
    'games_count', v_games_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION manager_sync_all_games_to_live(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  v_row manager_games%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  FOR v_row IN SELECT * FROM manager_games LOOP
    INSERT INTO game_advanced_configs (
      game_id, enabled, entry_fee_skz, win_prize_skz, target_score,
      time_limit_sec, trap_penalty, max_score, solo_win_score, max_plausible_score,
      updated_at
    ) VALUES (
      v_row.game_id, COALESCE(v_row.enabled, true),
      v_row.entry_fee_skz, v_row.win_prize_skz, v_row.target_score,
      v_row.duration_seconds, v_row.trap_penalty, v_row.max_score,
      v_row.solo_win_score, v_row.max_plausible_score, now()
    )
    ON CONFLICT (game_id) DO UPDATE SET
      enabled             = COALESCE(v_row.enabled,             game_advanced_configs.enabled),
      entry_fee_skz       = COALESCE(v_row.entry_fee_skz,       game_advanced_configs.entry_fee_skz),
      win_prize_skz       = COALESCE(v_row.win_prize_skz,       game_advanced_configs.win_prize_skz),
      target_score        = COALESCE(v_row.target_score,        game_advanced_configs.target_score),
      time_limit_sec      = COALESCE(v_row.duration_seconds,    game_advanced_configs.time_limit_sec),
      trap_penalty        = COALESCE(v_row.trap_penalty,        game_advanced_configs.trap_penalty),
      max_score           = COALESCE(v_row.max_score,           game_advanced_configs.max_score),
      solo_win_score      = COALESCE(v_row.solo_win_score,      game_advanced_configs.solo_win_score),
      max_plausible_score = COALESCE(v_row.max_plausible_score, game_advanced_configs.max_plausible_score),
      updated_at          = now();
    v_count := v_count + 1;
  END LOOP;

  -- FIX: column is 'payload', not 'details'
  INSERT INTO manager_audit_log (admin_id, action, payload)
  VALUES (p_admin_id, 'sync_all_games_to_live', jsonb_build_object('synced', v_count));

  RETURN jsonb_build_object('ok', true, 'synced', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION manager_sync_all_games_to_live(bigint) TO authenticated;
