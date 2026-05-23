/*
  # Leaderboard returns display_name + custom_avatar_url

  Updates `get_global_leaderboard` to expose the new profile fields so the
  Leaderboard UI can show player-chosen names and avatars everywhere.
*/

DROP FUNCTION IF EXISTS public.get_global_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_global_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  telegram_id       bigint,
  username          text,
  first_name        text,
  display_name      text,
  custom_avatar_url text,
  profile_photo_url text,
  total_won         numeric,
  total_wins        integer,
  level             integer,
  xp                integer,
  rank              bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
SELECT
  u.telegram_id,
  COALESCE(u.username, '')          AS username,
  COALESCE(u.first_name, '')        AS first_name,
  u.display_name,
  u.custom_avatar_url,
  u.profile_photo_url,
  COALESCE(ub.total_won_usd, 0)     AS total_won,
  COALESCE(g.total_wins, 0)         AS total_wins,
  COALESCE(g.level, 1)              AS level,
  COALESCE(g.xp, 0)                 AS xp,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(ub.total_won_usd, 0) DESC,
             COALESCE(g.total_wins, 0)     DESC,
             COALESCE(g.xp, 0)             DESC
  ) AS rank
FROM users u
LEFT JOIN user_balances      ub ON ub.telegram_id = u.telegram_id
LEFT JOIN user_gamification  g  ON g.telegram_id  = u.telegram_id
WHERE COALESCE(ub.total_won_usd, 0) > 0 OR COALESCE(g.total_wins, 0) > 0
ORDER BY total_won DESC, total_wins DESC, xp DESC
LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(integer) TO authenticated, anon;