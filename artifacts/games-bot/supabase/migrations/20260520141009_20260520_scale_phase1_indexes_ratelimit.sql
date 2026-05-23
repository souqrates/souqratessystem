/*
  # Scale Phase 1 — Critical Indexes + Per-User RPC Rate Limiting

  ## What this does
  1. Adds missing performance indexes on all hot tables
  2. Creates UNLOGGED rate-limit table (no WAL overhead — pure speed)
  3. Creates check_rate_limit() helper for all high-frequency RPCs
  4. Adds referral chain depth guard (max 20 levels, cycle-safe CTE)

  ## Tables created
  - `rpc_rate_limits` (UNLOGGED)

  ## Functions created
  - `check_rate_limit(user_id text, action text, max_calls int, window_seconds int) → boolean`
  - `get_referral_depth(user_id uuid) → int`
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MISSING PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- Fast startup: load only enabled games
CREATE INDEX IF NOT EXISTS idx_manager_games_enabled
  ON manager_games(game_id)
  WHERE enabled = true;

-- Contest leaderboard: top players per room
CREATE INDEX IF NOT EXISTS idx_tournament_players_room_score
  ON tournament_players(room_id, score DESC NULLS LAST);

-- Deposit polling: partial index on pending/watching only
CREATE INDEX IF NOT EXISTS idx_ton_deposit_intents_status_created
  ON ton_deposit_intents(status, created_at)
  WHERE status IN ('pending', 'watching');

-- Referral chain traversal
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id
  ON referrals(referrer_id)
  WHERE referrer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referred_id
  ON referrals(referred_id);

-- Match rooms: snapshotter scans playing rooms by start time
CREATE INDEX IF NOT EXISTS idx_match_rooms_status_started
  ON match_rooms(status, started_at)
  WHERE status = 'playing';

-- Ledger: user + category + time composite
CREATE INDEX IF NOT EXISTS idx_ledger_user_cat_time
  ON ledger_entries(user_telegram_id, category, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RATE LIMIT TABLE — UNLOGGED (no WAL = max write throughput)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNLOGGED TABLE IF NOT EXISTS rpc_rate_limits (
  user_id   text        NOT NULL,
  action    text        NOT NULL,
  window_ts timestamptz NOT NULL,
  count     int         NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action, window_ts)
);

CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_window
  ON rpc_rate_limits(window_ts);

ALTER TABLE rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RATE LIMIT HELPER
--    TRUE = under limit, FALSE = throttled
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id        text,
  p_action         text,
  p_max_calls      int DEFAULT 10,
  p_window_seconds int DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_window timestamptz;
  v_count  int;
BEGIN
  v_window := date_trunc('minute', now())
    + floor(extract(second FROM now()) / p_window_seconds)
      * p_window_seconds * interval '1 second';

  INSERT INTO rpc_rate_limits(user_id, action, window_ts, count)
  VALUES (p_user_id, p_action, v_window, 1)
  ON CONFLICT (user_id, action, window_ts)
  DO UPDATE SET count = rpc_rate_limits.count + 1
  RETURNING count INTO v_count;

  DELETE FROM rpc_rate_limits
  WHERE user_id   = p_user_id
    AND action    = p_action
    AND window_ts < now() - (p_window_seconds * 3 * interval '1 second');

  RETURN v_count <= p_max_calls;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, text, int, int) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REFERRAL CHAIN DEPTH GUARD (uuid keys, max 20 levels)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_referral_depth(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH RECURSIVE chain AS (
    SELECT referrer_id, 1 AS depth
    FROM referrals
    WHERE referred_id = p_user_id
    UNION ALL
    SELECT r.referrer_id, c.depth + 1
    FROM referrals r
    INNER JOIN chain c ON r.referred_id = c.referrer_id
    WHERE c.depth < 20
  )
  SELECT COALESCE(MAX(depth), 0) FROM chain;
$$;
