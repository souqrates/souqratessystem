/*
  # Extended manager controls for games (SKZ pricing, target score, full text)

  1. Schema changes
    - `manager_games` and `manager_preview_games` gain:
      - `entry_fee_skz` (int, nullable)        – override solo entry fee in SKZ
      - `win_prize_skz` (int, nullable)        – override prize in SKZ
      - `target_score` (int, nullable)         – min score required for a solo win
      - `rules_override` (text, nullable)      – override the in-game rules text
      - `subtitle_override` (text, nullable)   – short tagline shown on intro
      - `win_label_override` (text, nullable)  – override "VICTORY!"
      - `lose_label_override` (text, nullable) – override "GAME OVER"
      - `cta_label_override` (text, nullable)  – override "PLAY" CTA button text
  2. RPCs
    - `manager_upsert_staging_game` updated to write the new fields when present.
    - `manager_publish_all` updated to copy new fields from preview to live.
  3. Security
    - RLS already enabled on both tables; existing public-read policies apply.
    - All writes still flow through admin-gated SECURITY DEFINER RPCs.
*/

DO $$
DECLARE
  cols text[] := ARRAY[
    'entry_fee_skz integer',
    'win_prize_skz integer',
    'target_score integer',
    'rules_override text',
    'subtitle_override text',
    'win_label_override text',
    'lose_label_override text',
    'cta_label_override text'
  ];
  pair text;
  cname text;
  ctype text;
BEGIN
  FOREACH pair IN ARRAY cols LOOP
    cname := split_part(pair, ' ', 1);
    ctype := substring(pair from position(' ' in pair) + 1);
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'manager_games' AND column_name = cname
    ) THEN
      EXECUTE format('ALTER TABLE manager_games ADD COLUMN %I %s', cname, ctype);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'manager_preview_games' AND column_name = cname
    ) THEN
      EXECUTE format('ALTER TABLE manager_preview_games ADD COLUMN %I %s', cname, ctype);
    END IF;
  END LOOP;
END $$;

-- Updated upsert RPC: supports all new override fields.
CREATE OR REPLACE FUNCTION manager_upsert_staging_game(
  p_admin_id bigint,
  p_game_id integer,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_preview_games (
    game_id, enabled,
    name_override, emoji_override, reward_override, difficulty_override, desc_override,
    entry_fee_skz, win_prize_skz, target_score,
    rules_override, subtitle_override, win_label_override, lose_label_override, cta_label_override,
    updated_at
  )
  VALUES (
    p_game_id,
    CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean ELSE NULL END,
    p_fields->>'name_override',
    p_fields->>'emoji_override',
    p_fields->>'reward_override',
    p_fields->>'difficulty_override',
    p_fields->>'desc_override',
    NULLIF(p_fields->>'entry_fee_skz','')::int,
    NULLIF(p_fields->>'win_prize_skz','')::int,
    NULLIF(p_fields->>'target_score','')::int,
    p_fields->>'rules_override',
    p_fields->>'subtitle_override',
    p_fields->>'win_label_override',
    p_fields->>'lose_label_override',
    p_fields->>'cta_label_override',
    now()
  )
  ON CONFLICT (game_id) DO UPDATE
    SET enabled             = COALESCE(CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean END, manager_preview_games.enabled),
        name_override       = COALESCE(p_fields->>'name_override',       manager_preview_games.name_override),
        emoji_override      = COALESCE(p_fields->>'emoji_override',      manager_preview_games.emoji_override),
        reward_override     = COALESCE(p_fields->>'reward_override',     manager_preview_games.reward_override),
        difficulty_override = COALESCE(p_fields->>'difficulty_override', manager_preview_games.difficulty_override),
        desc_override       = COALESCE(p_fields->>'desc_override',       manager_preview_games.desc_override),
        entry_fee_skz       = COALESCE(NULLIF(p_fields->>'entry_fee_skz','')::int, manager_preview_games.entry_fee_skz),
        win_prize_skz       = COALESCE(NULLIF(p_fields->>'win_prize_skz','')::int, manager_preview_games.win_prize_skz),
        target_score        = COALESCE(NULLIF(p_fields->>'target_score','')::int,  manager_preview_games.target_score),
        rules_override      = COALESCE(p_fields->>'rules_override',      manager_preview_games.rules_override),
        subtitle_override   = COALESCE(p_fields->>'subtitle_override',   manager_preview_games.subtitle_override),
        win_label_override  = COALESCE(p_fields->>'win_label_override',  manager_preview_games.win_label_override),
        lose_label_override = COALESCE(p_fields->>'lose_label_override', manager_preview_games.lose_label_override),
        cta_label_override  = COALESCE(p_fields->>'cta_label_override',  manager_preview_games.cta_label_override),
        updated_at          = now();
END;
$$;

-- Updated publish RPC: carries all new fields from preview to live.
CREATE OR REPLACE FUNCTION manager_publish_all(p_admin_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config_count integer := 0;
  v_games_count  integer := 0;
  rec  record;
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
      game_id, enabled,
      name_override, emoji_override, reward_override, difficulty_override, desc_override,
      entry_fee_skz, win_prize_skz, target_score,
      rules_override, subtitle_override, win_label_override, lose_label_override, cta_label_override,
      updated_at
    )
    VALUES (
      grec.game_id, COALESCE(grec.enabled, true),
      grec.name_override, grec.emoji_override, grec.reward_override,
      grec.difficulty_override, grec.desc_override,
      grec.entry_fee_skz, grec.win_prize_skz, grec.target_score,
      grec.rules_override, grec.subtitle_override, grec.win_label_override, grec.lose_label_override, grec.cta_label_override,
      now()
    )
    ON CONFLICT (game_id) DO UPDATE
      SET enabled             = COALESCE(grec.enabled, manager_games.enabled),
          name_override       = COALESCE(grec.name_override,       manager_games.name_override),
          emoji_override      = COALESCE(grec.emoji_override,      manager_games.emoji_override),
          reward_override     = COALESCE(grec.reward_override,     manager_games.reward_override),
          difficulty_override = COALESCE(grec.difficulty_override, manager_games.difficulty_override),
          desc_override       = COALESCE(grec.desc_override,       manager_games.desc_override),
          entry_fee_skz       = COALESCE(grec.entry_fee_skz,       manager_games.entry_fee_skz),
          win_prize_skz       = COALESCE(grec.win_prize_skz,       manager_games.win_prize_skz),
          target_score        = COALESCE(grec.target_score,        manager_games.target_score),
          rules_override      = COALESCE(grec.rules_override,      manager_games.rules_override),
          subtitle_override   = COALESCE(grec.subtitle_override,   manager_games.subtitle_override),
          win_label_override  = COALESCE(grec.win_label_override,  manager_games.win_label_override),
          lose_label_override = COALESCE(grec.lose_label_override, manager_games.lose_label_override),
          cta_label_override  = COALESCE(grec.cta_label_override,  manager_games.cta_label_override),
          updated_at          = now();
    v_games_count := v_games_count + 1;
  END LOOP;
  DELETE FROM manager_preview_games WHERE true;

  RETURN jsonb_build_object('config_count', v_config_count, 'games_count', v_games_count, 'total', v_config_count + v_games_count);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_staging_game(bigint, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO anon, authenticated;
