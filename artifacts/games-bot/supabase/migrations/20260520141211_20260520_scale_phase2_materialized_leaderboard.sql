/*
  # Scale Phase 2 — Materialized Leaderboard Cache

  ## Problem
  get_global_leaderboard() does full table scans + JOINs on every page load.
  Under 1M users this is O(n) and will timeout under concurrent traffic.

  ## Solution
  - mv_global_leaderboard: top 1000, refreshed every 5 minutes via pg_cron
  - mv_weekly_leaderboard: top 500 this week, same refresh
  - All leaderboard RPCs now do O(1) index scan on the MV
  - REFRESH CONCURRENTLY = zero read lock during refresh
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GLOBAL LEADERBOARD MATERIALIZED VIEW
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_global_leaderboard AS
SELECT
  u.telegram_id,
  COALESCE(u.username, '')         AS username,
  COALESCE(u.first_name, '')       AS first_name,
  u.display_name,
  u.custom_avatar_url,
  u.profile_photo_url,
  COALESCE(ub.total_won_usd, 0)    AS total_won,
  COALESCE(g.total_wins, 0)        AS total_wins,
  COALESCE(g.level, 1)             AS level,
  COALESCE(g.xp, 0)                AS xp,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(ub.total_won_usd, 0) DESC,
      COALESCE(g.total_wins, 0)     DESC,
      COALESCE(g.xp, 0)             DESC
  ) AS rank,
  now() AS cached_at
FROM users u
LEFT JOIN user_balances     ub ON ub.telegram_id = u.telegram_id
LEFT JOIN user_gamification g  ON g.telegram_id  = u.telegram_id
WHERE COALESCE(ub.total_won_usd, 0) > 0
   OR COALESCE(g.total_wins, 0)     > 0
ORDER BY total_won DESC, total_wins DESC, xp DESC
LIMIT 1000;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_rank
  ON mv_global_leaderboard(rank);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leaderboard_telegram_id
  ON mv_global_leaderboard(telegram_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WEEKLY LEADERBOARD MATERIALIZED VIEW
-- ─────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_leaderboard AS
SELECT
  u.telegram_id,
  COALESCE(u.username, '')      AS username,
  COALESCE(u.first_name, '')    AS first_name,
  u.display_name,
  u.custom_avatar_url,
  u.profile_photo_url,
  COALESCE(SUM(CASE
    WHEN le.category = 'payout'
     AND le.direction = 'credit'
     AND le.created_at >= date_trunc('week', now())
    THEN le.amount_usd ELSE 0
  END), 0) AS total_won,
  COUNT(CASE
    WHEN le.category = 'payout'
     AND le.direction = 'credit'
     AND le.created_at >= date_trunc('week', now())
    THEN 1
  END)     AS total_wins,
  COALESCE(g.level, 1)          AS level,
  COALESCE(g.xp, 0)             AS xp,
  ROW_NUMBER() OVER (
    ORDER BY COALESCE(SUM(CASE
      WHEN le.category = 'payout'
       AND le.direction = 'credit'
       AND le.created_at >= date_trunc('week', now())
      THEN le.amount_usd ELSE 0
    END), 0) DESC
  ) AS rank,
  now() AS cached_at
FROM users u
LEFT JOIN user_gamification g  ON g.telegram_id       = u.telegram_id
LEFT JOIN ledger_entries    le ON le.user_telegram_id  = u.telegram_id
WHERE le.created_at >= date_trunc('week', now())
GROUP BY
  u.telegram_id, u.username, u.first_name, u.display_name,
  u.custom_avatar_url, u.profile_photo_url, g.level, g.xp
HAVING COALESCE(SUM(CASE
  WHEN le.category = 'payout' AND le.direction = 'credit'
   AND le.created_at >= date_trunc('week', now())
  THEN le.amount_usd ELSE 0
END), 0) > 0
ORDER BY total_won DESC
LIMIT 500;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_leaderboard_rank
  ON mv_weekly_leaderboard(rank);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_leaderboard_telegram_id
  ON mv_weekly_leaderboard(telegram_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REFRESH FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_leaderboard;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_leaderboard;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'refresh_leaderboard_cache failed: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DROP old signatures before replacing (return type may differ)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_global_leaderboard(integer);
DROP FUNCTION IF EXISTS get_weekly_leaderboard(integer);
DROP FUNCTION IF EXISTS get_player_rank(bigint);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. get_global_leaderboard — O(1) MV scan
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_global_leaderboard(p_limit integer DEFAULT 50)
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    telegram_id, username, first_name, display_name,
    custom_avatar_url, profile_photo_url,
    total_won, total_wins, level, xp, rank
  FROM mv_global_leaderboard
  ORDER BY rank
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. get_weekly_leaderboard — O(1) MV scan
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_weekly_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  telegram_id       bigint,
  username          text,
  first_name        text,
  display_name      text,
  custom_avatar_url text,
  profile_photo_url text,
  total_won         numeric,
  total_wins        bigint,
  level             integer,
  xp                integer,
  rank              bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    telegram_id, username, first_name, display_name,
    custom_avatar_url, profile_photo_url,
    total_won, total_wins::bigint, level, xp, rank
  FROM mv_weekly_leaderboard
  ORDER BY rank
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_player_rank — instant O(1) from MV
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_player_rank(p_telegram_id bigint)
RETURNS TABLE(rank bigint, total_won numeric, total_wins integer, percentile numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    mv.rank,
    mv.total_won,
    mv.total_wins,
    ROUND(
      (1 - mv.rank::numeric
           / NULLIF((SELECT COUNT(*) FROM mv_global_leaderboard), 0)
      ) * 100, 1
    ) AS percentile
  FROM mv_global_leaderboard mv
  WHERE mv.telegram_id = p_telegram_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SCHEDULE REFRESH EVERY 5 MINUTES
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'refresh-leaderboard-cache',
  '*/5 * * * *',
  $$SELECT refresh_leaderboard_cache();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-leaderboard-cache'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. INITIAL POPULATE
-- ─────────────────────────────────────────────────────────────────────────────

REFRESH MATERIALIZED VIEW mv_global_leaderboard;

DO $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_weekly_leaderboard;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Weekly leaderboard initial refresh skipped: %', SQLERRM;
END $$;
