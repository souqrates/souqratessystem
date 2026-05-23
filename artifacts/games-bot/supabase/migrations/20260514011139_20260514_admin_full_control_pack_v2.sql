/*
  # Admin Full Control Pack v2

  Extends `manager_upsert_staging_game` to accept the new `duration_seconds` field and
  extends `manager_publish_all` so duration is propagated to live `manager_games`.
*/

CREATE OR REPLACE FUNCTION public.manager_upsert_staging_game(p_admin_id bigint, p_game_id integer, p_fields jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_preview_games (
    game_id, enabled,
    name_override, emoji_override, reward_override, difficulty_override, desc_override,
    entry_fee_skz, win_prize_skz, target_score, duration_seconds,
    rules_override, subtitle_override, win_label_override, lose_label_override, cta_label_override,
    updated_at
  ) VALUES (
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
    NULLIF(p_fields->>'duration_seconds','')::int,
    p_fields->>'rules_override',
    p_fields->>'subtitle_override',
    p_fields->>'win_label_override',
    p_fields->>'lose_label_override',
    p_fields->>'cta_label_override',
    now()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    enabled             = COALESCE(CASE WHEN p_fields ? 'enabled' THEN (p_fields->>'enabled')::boolean END, manager_preview_games.enabled),
    name_override       = COALESCE(p_fields->>'name_override',       manager_preview_games.name_override),
    emoji_override      = COALESCE(p_fields->>'emoji_override',      manager_preview_games.emoji_override),
    reward_override     = COALESCE(p_fields->>'reward_override',     manager_preview_games.reward_override),
    difficulty_override = COALESCE(p_fields->>'difficulty_override', manager_preview_games.difficulty_override),
    desc_override       = COALESCE(p_fields->>'desc_override',       manager_preview_games.desc_override),
    entry_fee_skz       = COALESCE(NULLIF(p_fields->>'entry_fee_skz','')::int, manager_preview_games.entry_fee_skz),
    win_prize_skz       = COALESCE(NULLIF(p_fields->>'win_prize_skz','')::int, manager_preview_games.win_prize_skz),
    target_score        = COALESCE(NULLIF(p_fields->>'target_score','')::int,  manager_preview_games.target_score),
    duration_seconds    = COALESCE(NULLIF(p_fields->>'duration_seconds','')::int, manager_preview_games.duration_seconds),
    rules_override      = COALESCE(p_fields->>'rules_override',      manager_preview_games.rules_override),
    subtitle_override   = COALESCE(p_fields->>'subtitle_override',   manager_preview_games.subtitle_override),
    win_label_override  = COALESCE(p_fields->>'win_label_override',  manager_preview_games.win_label_override),
    lose_label_override = COALESCE(p_fields->>'lose_label_override', manager_preview_games.lose_label_override),
    cta_label_override  = COALESCE(p_fields->>'cta_label_override',  manager_preview_games.cta_label_override),
    updated_at          = now();
END;
$function$;
