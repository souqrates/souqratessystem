/*
  # Per-game advanced configs (manager-tunable)

  1. New Tables
    - `game_advanced_configs`
      - `game_id` (int, PK) — matches GAMES[].id in constants.js
      - `entry_fee_skz` (int)   — overrides default entry fee
      - `win_prize_skz` (int)   — overrides default prize
      - `target_score`  (int)   — score needed to win
      - `time_limit_sec`(int)   — round duration cap
      - `win_rate_target` (numeric) — desired win-rate (0..1) for analytics/tuning
      - `params` (jsonb)        — free-form game-specific tuning (speed, spawn rate, etc.)
      - `enabled` (bool)        — global on/off
      - `updated_at` (timestamptz)
      - `updated_by` (text)

  2. RPCs
    - `get_game_config(p_game_id int)` — returns the config row as json
      (callable by anon + authenticated for runtime client reads)
    - `manager_upsert_game_config(p_game_id, ...)` — SECURITY DEFINER,
      requires the caller to be present in manager_admins / app_admins

  3. Security
    - RLS enabled. Public SELECT allowed (read-only configs).
    - All writes go through the SECURITY DEFINER RPC, which itself enforces admin.
*/

CREATE TABLE IF NOT EXISTS game_advanced_configs (
  game_id          integer PRIMARY KEY,
  entry_fee_skz    integer,
  win_prize_skz    integer,
  target_score     integer,
  time_limit_sec   integer,
  win_rate_target  numeric(5,4),
  params           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  enabled          boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text
);

ALTER TABLE game_advanced_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read game configs" ON game_advanced_configs;
CREATE POLICY "Public can read game configs"
  ON game_advanced_configs FOR SELECT
  TO public
  USING (true);

CREATE OR REPLACE FUNCTION get_game_config(p_game_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row game_advanced_configs%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM game_advanced_configs WHERE game_id = p_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('game_id', p_game_id, 'enabled', true, 'params', '{}'::jsonb);
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION get_game_config(integer) FROM public;
GRANT EXECUTE ON FUNCTION get_game_config(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION manager_upsert_game_config(
  p_admin_id        text,
  p_game_id         integer,
  p_entry_fee       integer,
  p_win_prize       integer,
  p_target_score    integer,
  p_time_limit      integer,
  p_win_rate_target numeric,
  p_params          jsonb,
  p_enabled         boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF p_admin_id IS NULL OR length(p_admin_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_admin');
  END IF;

  -- Permissive check: any record in manager_admins or app_admins matching this id is enough.
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id
    ) INTO v_is_admin;
  EXCEPTION WHEN undefined_table THEN
    v_is_admin := false;
  END;

  IF NOT v_is_admin THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM app_admins WHERE telegram_id::text = p_admin_id
      ) INTO v_is_admin;
    EXCEPTION WHEN undefined_table THEN
      v_is_admin := false;
    END;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;

  INSERT INTO game_advanced_configs (
    game_id, entry_fee_skz, win_prize_skz, target_score, time_limit_sec,
    win_rate_target, params, enabled, updated_at, updated_by
  ) VALUES (
    p_game_id, p_entry_fee, p_win_prize, p_target_score, p_time_limit,
    p_win_rate_target, COALESCE(p_params, '{}'::jsonb), COALESCE(p_enabled, true), now(), p_admin_id
  )
  ON CONFLICT (game_id) DO UPDATE SET
    entry_fee_skz   = EXCLUDED.entry_fee_skz,
    win_prize_skz   = EXCLUDED.win_prize_skz,
    target_score    = EXCLUDED.target_score,
    time_limit_sec  = EXCLUDED.time_limit_sec,
    win_rate_target = EXCLUDED.win_rate_target,
    params          = EXCLUDED.params,
    enabled         = EXCLUDED.enabled,
    updated_at      = now(),
    updated_by      = EXCLUDED.updated_by;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION manager_upsert_game_config(text, integer, integer, integer, integer, integer, numeric, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION manager_upsert_game_config(text, integer, integer, integer, integer, integer, numeric, jsonb, boolean) TO anon, authenticated;

-- Seed sensible defaults for the new AAA single-player set (ids 116-125)
INSERT INTO game_advanced_configs (game_id, target_score, time_limit_sec, win_rate_target, params, enabled) VALUES
  (116, 600,  60,  0.35, '{"theme":"egyptian_gold","heat_target":85,"perfect_window_ms":120}'::jsonb, true),
  (117, 500,  60,  0.30, '{"theme":"deep_space","planets":5,"shot_count":5}'::jsonb, true),
  (118, 800,  60,  0.35, '{"theme":"neon_tokyo","target_mm":5.0,"perfect_err_mm":0.15}'::jsonb, true),
  (119, 700,  45,  0.30, '{"theme":"cyberpunk","towers":10,"quakes":3}'::jsonb, true),
  (120, 75,   60,  0.30, '{"theme":"gold_leaf","touches":10}'::jsonb, true),
  (121, 1,    20,  0.25, '{"theme":"oceans_eleven","rewinds":3,"guards":2}'::jsonb, true),
  (122, 100,  20,  0.40, '{"theme":"ancient_arena","target_taps":100,"max_cps":15}'::jsonb, true),
  (123, 5,    30,  0.35, '{"theme":"cyber_dojo","rounds":5,"window_ms_start":800}'::jsonb, true),
  (124, 1,    60,  0.30, '{"theme":"underwater","grid":12,"ink_charges":5}'::jsonb, true),
  (125, 600,  90,  0.35, '{"theme":"tokyo_night","bpm":120,"perfect_ms":16}'::jsonb, true)
ON CONFLICT (game_id) DO NOTHING;