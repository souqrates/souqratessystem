/*
  # Fix DELETE-without-WHERE in manager RPC functions

  Supabase enables the `pg-safeupdate` extension which blocks any DELETE
  or UPDATE statement that lacks a WHERE clause. Several manager functions
  use bare `DELETE FROM <table>` and fail at runtime with
  "DELETE requires a WHERE clause".

  This migration replaces the affected functions, adding `WHERE true` to
  the bulk-purge DELETEs. Behavior is unchanged — all rows still removed.

  1. Functions Updated
    - manager_publish_all(bigint)
    - manager_discard_all_staging(bigint)
    - manager_discard_all_staging_games(bigint)

  2. Security
    - SECURITY DEFINER preserved
    - require_manager_admin() checks preserved
    - GRANTs re-applied to anon, authenticated
*/

CREATE OR REPLACE FUNCTION manager_publish_all(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config_count integer := 0;
  v_games_count integer := 0;
  rec record;
  grec record;
BEGIN
  PERFORM require_manager_admin(p_admin_id);

  FOR rec IN SELECT * FROM manager_preview_config LOOP
    INSERT INTO manager_config (key, value, type, category, label, description, updated_at)
    VALUES (rec.key, rec.value, COALESCE(rec.type,'text'), COALESCE(rec.category,'general'), COALESCE(rec.label,rec.key), '', now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, type = EXCLUDED.type, category = EXCLUDED.category,
          label = EXCLUDED.label, updated_at = now();
    v_config_count := v_config_count + 1;
  END LOOP;
  DELETE FROM manager_preview_config WHERE true;

  FOR grec IN SELECT * FROM manager_preview_games LOOP
    INSERT INTO manager_games (
      game_id, enabled, name_override, emoji_override, reward_override, difficulty_override, desc_override, updated_at
    )
    VALUES (
      grec.game_id, COALESCE(grec.enabled, true),
      grec.name_override, grec.emoji_override, grec.reward_override,
      grec.difficulty_override, grec.desc_override, now()
    )
    ON CONFLICT (game_id) DO UPDATE
      SET enabled             = COALESCE(grec.enabled, manager_games.enabled),
          name_override       = COALESCE(grec.name_override, manager_games.name_override),
          emoji_override      = COALESCE(grec.emoji_override, manager_games.emoji_override),
          reward_override     = COALESCE(grec.reward_override, manager_games.reward_override),
          difficulty_override = COALESCE(grec.difficulty_override, manager_games.difficulty_override),
          desc_override       = COALESCE(grec.desc_override, manager_games.desc_override),
          updated_at          = now();
    v_games_count := v_games_count + 1;
  END LOOP;
  DELETE FROM manager_preview_games WHERE true;

  RETURN jsonb_build_object('config_count', v_config_count, 'games_count', v_games_count, 'total', v_config_count + v_games_count);
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_all_staging(p_admin_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_config WHERE true;
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_all_staging_games(p_admin_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_games WHERE true;
END;
$$;

GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_all_staging(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_all_staging_games(bigint) TO anon, authenticated;
