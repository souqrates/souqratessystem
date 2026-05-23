/*
  # Real-time Leaderboard + Realtime Balance Wiring

  Adds two ingredients needed to make the app fully reactive:

  1. New Functions
    - `get_global_leaderboard(p_limit int)` — returns the top N players
      ordered by total_won_usd desc, joined with users + gamification.
      Public (anon + authenticated) — only safe public columns exposed.
    - `get_player_rank(p_telegram_id bigint)` — returns the caller's
      rank among all players with positive earnings, plus their stats.

  2. Realtime
    - Adds `user_balances` to the `supabase_realtime` publication so
      clients receive INSERT/UPDATE events on their own balance rows.
    - Adds `hall_of_fame` to the publication for future use.

  3. Auto-population of hall_of_fame
    - Wraps `pay_credit_winnings` with a trigger-like extension that
      logs each payout as a hall_of_fame row (so a per-match history
      exists even if the user later spends the balance).
    - Done as a wrapper function `pay_credit_winnings_logged` that
      `match_submit_score` and `tour_finish` already invoke via
      `pay_credit_winnings`. We extend `pay_credit_winnings` itself.

  Safety: all functions are SECURITY DEFINER and bounded by parameter
  validation. Read functions are intentionally world-readable since
  leaderboards are public by design.
*/

-- ============================================================
-- 1. GLOBAL LEADERBOARD RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  telegram_id   bigint,
  username      text,
  first_name    text,
  total_won     numeric,
  total_wins    integer,
  level         integer,
  xp            integer,
  rank          bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    u.telegram_id,
    COALESCE(u.username, '')   AS username,
    COALESCE(u.first_name, '') AS first_name,
    COALESCE(ub.total_won_usd, 0)  AS total_won,
    COALESCE(g.total_wins, 0)      AS total_wins,
    COALESCE(g.level, 1)           AS level,
    COALESCE(g.xp, 0)              AS xp,
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

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(int) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_player_rank(p_telegram_id bigint)
RETURNS TABLE (
  telegram_id  bigint,
  total_won    numeric,
  total_wins   integer,
  level        integer,
  xp           integer,
  rank         bigint,
  total_ranked bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ranked AS (
    SELECT
      u.telegram_id,
      COALESCE(ub.total_won_usd, 0) AS total_won,
      COALESCE(g.total_wins, 0)     AS total_wins,
      COALESCE(g.level, 1)          AS level,
      COALESCE(g.xp, 0)             AS xp,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(ub.total_won_usd, 0) DESC,
                 COALESCE(g.total_wins, 0)     DESC,
                 COALESCE(g.xp, 0)             DESC
      ) AS rk,
      COUNT(*) OVER ()              AS total
    FROM users u
    LEFT JOIN user_balances      ub ON ub.telegram_id = u.telegram_id
    LEFT JOIN user_gamification  g  ON g.telegram_id  = u.telegram_id
    WHERE COALESCE(ub.total_won_usd, 0) > 0 OR COALESCE(g.total_wins, 0) > 0
  )
  SELECT telegram_id, total_won, total_wins, level, xp, rk AS rank, total AS total_ranked
  FROM ranked
  WHERE telegram_id = p_telegram_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_rank(bigint) TO authenticated, anon;

-- ============================================================
-- 2. AUTO HALL_OF_FAME ON WINNINGS
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_credit_winnings(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid;
  v_username text;
BEGIN
  IF p_tg IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  PERFORM pay_ensure_balance_row(p_tg);
  UPDATE user_balances
    SET sc_balance    = sc_balance + p_amount,
        total_won_usd = COALESCE(total_won_usd, 0) + p_amount,
        updated_at    = now()
    WHERE telegram_id = p_tg;

  -- Log into hall_of_fame so we always retain a history of wins
  SELECT id, COALESCE(username, COALESCE(first_name,'Player'))
    INTO v_uid, v_username
    FROM users WHERE telegram_id = p_tg LIMIT 1;

  IF v_uid IS NOT NULL THEN
    INSERT INTO hall_of_fame (user_id, username, game_id, score, earnings_usd)
    VALUES (v_uid, v_username, 0, 0, p_amount);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.pay_credit_winnings(bigint, numeric) TO authenticated, anon;

-- ============================================================
-- 3. REALTIME PUBLICATION
-- ============================================================
DO $$
BEGIN
  -- user_balances
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_balances'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_balances';
  END IF;

  -- hall_of_fame
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hall_of_fame'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.hall_of_fame';
  END IF;

  -- user_gamification
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_gamification'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_gamification';
  END IF;
END $$;