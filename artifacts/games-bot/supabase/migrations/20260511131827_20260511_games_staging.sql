
/*
  # Games Staging Layer

  Adds staging table `manager_preview_games` so edits to games don't go
  live immediately. Edits are merged in preview mode and only published
  to users when admin clicks "Publish".
*/

-- ─── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_preview_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id integer UNIQUE NOT NULL,
  enabled boolean,
  name_override text,
  emoji_override text,
  reward_override text,
  difficulty_override text,
  desc_override text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE manager_preview_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read staged games" ON manager_preview_games;
CREATE POLICY "Public can read staged games"
  ON manager_preview_games FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─── Staging RPCs ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_upsert_staging_game(
  p_admin_id bigint,
  p_game_id integer,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_preview_games (
    game_id, enabled, name_override, emoji_override, reward_override, difficulty_override, desc_override, updated_at
  )
  VALUES (
    p_game_id,
    CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean ELSE NULL END,
    p_fields->>'name_override',
    p_fields->>'emoji_override',
    p_fields->>'reward_override',
    p_fields->>'difficulty_override',
    p_fields->>'desc_override',
    now()
  )
  ON CONFLICT (game_id) DO UPDATE
    SET enabled             = COALESCE(CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean END, manager_preview_games.enabled),
        name_override       = COALESCE(p_fields->>'name_override', manager_preview_games.name_override),
        emoji_override      = COALESCE(p_fields->>'emoji_override', manager_preview_games.emoji_override),
        reward_override     = COALESCE(p_fields->>'reward_override', manager_preview_games.reward_override),
        difficulty_override = COALESCE(p_fields->>'difficulty_override', manager_preview_games.difficulty_override),
        desc_override       = COALESCE(p_fields->>'desc_override', manager_preview_games.desc_override),
        updated_at          = now();
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_staging_game(p_admin_id bigint, p_game_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_games WHERE game_id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_all_staging_games(p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_games;
END;
$$;

-- ─── Replace publish to publish BOTH config and games ───────────────────────
DROP FUNCTION IF EXISTS manager_publish_all(bigint);

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
  DELETE FROM manager_preview_config;

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
  DELETE FROM manager_preview_games;

  RETURN jsonb_build_object('config_count', v_config_count, 'games_count', v_games_count, 'total', v_config_count + v_games_count);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_staging_game(bigint, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_staging_game(bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_all_staging_games(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO anon, authenticated;
