/*
  # Fix admin RPC failures: broken rate-limit column + missing EXECUTE grants

  ## Root Causes Fixed

  ### 1. require_manager_admin crashes on every call
  The rate-limit check referenced column `admin_telegram_id` which does not exist
  in `manager_audit_log`. The actual column is `admin_id`. This caused every admin
  RPC (save game, publish, sync, ban, etc.) to fail with a PostgreSQL column error.

  ### 2. Missing EXECUTE grants on admin RPCs
  `manager_upsert_staging_game` and related functions had no EXECUTE grant for
  the `authenticated` role, so Supabase rejected calls before even entering the function.

  ### 3. Missing image_url column in manager_preview_games
  GamesPage sends `image_url` in the fields payload but the staging table had no
  such column, causing insert failures.

  ## Changes
  - Fix `require_manager_admin`: replace `admin_telegram_id` with `admin_id`
  - Add `image_url` to `manager_preview_games`
  - Grant EXECUTE on all manager RPCs to `authenticated`
*/

-- 1. Fix require_manager_admin: broken column reference in rate-limit check
CREATE OR REPLACE FUNCTION require_manager_admin(tid bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF tid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = tid) THEN
    RAISE EXCEPTION 'Unauthorized: admin telegram_id not found';
  END IF;
  -- Rate limit: max 120 admin operations per minute
  -- NOTE: column is admin_id, not admin_telegram_id
  IF (
    SELECT count(*) FROM manager_audit_log
    WHERE admin_id = tid
    AND created_at > now() - interval '1 minute'
  ) > 120 THEN
    RAISE EXCEPTION 'Rate limit exceeded for admin operations';
  END IF;
END;
$$;

-- 2. Add image_url to manager_preview_games if missing
ALTER TABLE manager_preview_games
  ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Update manager_upsert_staging_game to also handle image_url
CREATE OR REPLACE FUNCTION manager_upsert_staging_game(
  p_admin_id bigint,
  p_game_id  integer,
  p_fields   jsonb
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
    entry_fee_skz, win_prize_skz, target_score, duration_seconds,
    trap_penalty, max_score, solo_win_score, max_plausible_score,
    rules_override, subtitle_override, win_label_override, lose_label_override, cta_label_override,
    image_url,
    updated_at
  ) VALUES (
    p_game_id,
    CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean ELSE NULL END,
    p_fields->>'name_override',
    p_fields->>'emoji_override',
    p_fields->>'reward_override',
    p_fields->>'difficulty_override',
    p_fields->>'desc_override',
    NULLIF(p_fields->>'entry_fee_skz','')::numeric,
    NULLIF(p_fields->>'win_prize_skz','')::numeric,
    NULLIF(p_fields->>'target_score','')::numeric,
    NULLIF(p_fields->>'duration_seconds','')::numeric,
    NULLIF(p_fields->>'trap_penalty','')::numeric,
    NULLIF(p_fields->>'max_score','')::numeric,
    NULLIF(p_fields->>'solo_win_score','')::numeric,
    NULLIF(p_fields->>'max_plausible_score','')::numeric,
    p_fields->>'rules_override',
    p_fields->>'subtitle_override',
    p_fields->>'win_label_override',
    p_fields->>'lose_label_override',
    p_fields->>'cta_label_override',
    NULLIF(p_fields->>'image_url',''),
    now()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    enabled              = COALESCE(CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean END, manager_preview_games.enabled),
    name_override        = COALESCE(p_fields->>'name_override',       manager_preview_games.name_override),
    emoji_override       = COALESCE(p_fields->>'emoji_override',      manager_preview_games.emoji_override),
    reward_override      = COALESCE(p_fields->>'reward_override',     manager_preview_games.reward_override),
    difficulty_override  = COALESCE(p_fields->>'difficulty_override', manager_preview_games.difficulty_override),
    desc_override        = COALESCE(p_fields->>'desc_override',       manager_preview_games.desc_override),
    entry_fee_skz        = COALESCE(NULLIF(p_fields->>'entry_fee_skz','')::numeric,        manager_preview_games.entry_fee_skz),
    win_prize_skz        = COALESCE(NULLIF(p_fields->>'win_prize_skz','')::numeric,        manager_preview_games.win_prize_skz),
    target_score         = COALESCE(NULLIF(p_fields->>'target_score','')::numeric,         manager_preview_games.target_score),
    duration_seconds     = COALESCE(NULLIF(p_fields->>'duration_seconds','')::numeric,     manager_preview_games.duration_seconds),
    trap_penalty         = COALESCE(NULLIF(p_fields->>'trap_penalty','')::numeric,         manager_preview_games.trap_penalty),
    max_score            = COALESCE(NULLIF(p_fields->>'max_score','')::numeric,            manager_preview_games.max_score),
    solo_win_score       = COALESCE(NULLIF(p_fields->>'solo_win_score','')::numeric,       manager_preview_games.solo_win_score),
    max_plausible_score  = COALESCE(NULLIF(p_fields->>'max_plausible_score','')::numeric,  manager_preview_games.max_plausible_score),
    rules_override       = COALESCE(p_fields->>'rules_override',      manager_preview_games.rules_override),
    subtitle_override    = COALESCE(p_fields->>'subtitle_override',   manager_preview_games.subtitle_override),
    win_label_override   = COALESCE(p_fields->>'win_label_override',  manager_preview_games.win_label_override),
    lose_label_override  = COALESCE(p_fields->>'lose_label_override', manager_preview_games.lose_label_override),
    cta_label_override   = COALESCE(p_fields->>'cta_label_override',  manager_preview_games.cta_label_override),
    image_url            = COALESCE(NULLIF(p_fields->>'image_url',''), manager_preview_games.image_url),
    updated_at           = now();
END;
$$;

-- 4. Grant EXECUTE on all manager RPCs to authenticated role
GRANT EXECUTE ON FUNCTION require_manager_admin(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION manager_upsert_staging_game(bigint, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION manager_sync_all_games_to_live(bigint) TO authenticated;

-- Grant on other manager functions that may be missing grants
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname LIKE 'manager_%'
    AND p.proname NOT IN ('manager_upsert_staging_game', 'manager_publish_all', 'manager_sync_all_games_to_live')
  LOOP
    BEGIN
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || fn || ' TO authenticated';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;
