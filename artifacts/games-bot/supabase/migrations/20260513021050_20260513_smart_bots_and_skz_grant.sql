/*
  # Smart Bots configuration + manager free SKZ grant

  1. New Tables
    - `bot_smart_config` — single-row global tuning for smart bot entry behavior
      (one row keyed `global`). Controls per-mode probability of bot entry,
      min/max wait windows (ms), and peak-hours behavior.

  2. New RPCs
    - `get_bot_smart_config()` — public read (returns the row as jsonb)
    - `manager_update_bot_smart_config(p_admin_id, p_fields jsonb)` — manager-only
    - `manager_grant_skz(p_admin_id, p_telegram_id, p_amount, p_note)` —
      manager-only, credits free SKZ to a specific user's balance row,
      records an entry in the ledger (if `ledger` table exists), and is idempotent
      via best-effort row update.

  3. Security
    - RLS on `bot_smart_config`: anon/auth can SELECT (read-only); writes only via
      SECURITY DEFINER RPC which calls `require_manager_admin`.
    - `manager_grant_skz` is SECURITY DEFINER, callable only by manager admins.
*/

CREATE TABLE IF NOT EXISTS bot_smart_config (
  key                              text PRIMARY KEY,
  enable_pvp                       boolean      NOT NULL DEFAULT true,
  enable_quad                      boolean      NOT NULL DEFAULT true,
  enable_group                     boolean      NOT NULL DEFAULT true,
  pvp_join_probability             numeric(4,3) NOT NULL DEFAULT 0.85,
  quad_join_probability            numeric(4,3) NOT NULL DEFAULT 0.90,
  group_join_probability           numeric(4,3) NOT NULL DEFAULT 0.95,
  pvp_min_wait_ms                  integer      NOT NULL DEFAULT 3000,
  pvp_max_wait_ms                  integer      NOT NULL DEFAULT 9000,
  quad_min_wait_ms                 integer      NOT NULL DEFAULT 4000,
  quad_max_wait_ms                 integer      NOT NULL DEFAULT 14000,
  group_min_wait_ms                integer      NOT NULL DEFAULT 2000,
  group_max_wait_ms                integer      NOT NULL DEFAULT 8000,
  peak_hours                       integer[]    NOT NULL DEFAULT ARRAY[18,19,20,21,22]::integer[],
  peak_probability_multiplier      numeric(4,3) NOT NULL DEFAULT 0.45,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_by                       bigint
);

ALTER TABLE bot_smart_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read bot smart config" ON bot_smart_config;
CREATE POLICY "Public can read bot smart config"
  ON bot_smart_config FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO bot_smart_config (key) VALUES ('global')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_bot_smart_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row bot_smart_config%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM bot_smart_config WHERE key = 'global';
  IF NOT FOUND THEN
    INSERT INTO bot_smart_config (key) VALUES ('global')
    ON CONFLICT (key) DO NOTHING;
    SELECT * INTO v_row FROM bot_smart_config WHERE key = 'global';
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION get_bot_smart_config() FROM public;
GRANT EXECUTE ON FUNCTION get_bot_smart_config() TO anon, authenticated;

CREATE OR REPLACE FUNCTION manager_update_bot_smart_config(
  p_admin_id bigint,
  p_fields   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);

  UPDATE bot_smart_config SET
    enable_pvp                  = COALESCE((p_fields->>'enable_pvp')::boolean,              enable_pvp),
    enable_quad                 = COALESCE((p_fields->>'enable_quad')::boolean,             enable_quad),
    enable_group                = COALESCE((p_fields->>'enable_group')::boolean,            enable_group),
    pvp_join_probability        = COALESCE(NULLIF(p_fields->>'pvp_join_probability','')::numeric,        pvp_join_probability),
    quad_join_probability       = COALESCE(NULLIF(p_fields->>'quad_join_probability','')::numeric,       quad_join_probability),
    group_join_probability      = COALESCE(NULLIF(p_fields->>'group_join_probability','')::numeric,      group_join_probability),
    pvp_min_wait_ms             = COALESCE(NULLIF(p_fields->>'pvp_min_wait_ms','')::integer,             pvp_min_wait_ms),
    pvp_max_wait_ms             = COALESCE(NULLIF(p_fields->>'pvp_max_wait_ms','')::integer,             pvp_max_wait_ms),
    quad_min_wait_ms            = COALESCE(NULLIF(p_fields->>'quad_min_wait_ms','')::integer,            quad_min_wait_ms),
    quad_max_wait_ms            = COALESCE(NULLIF(p_fields->>'quad_max_wait_ms','')::integer,            quad_max_wait_ms),
    group_min_wait_ms           = COALESCE(NULLIF(p_fields->>'group_min_wait_ms','')::integer,           group_min_wait_ms),
    group_max_wait_ms           = COALESCE(NULLIF(p_fields->>'group_max_wait_ms','')::integer,           group_max_wait_ms),
    peak_probability_multiplier = COALESCE(NULLIF(p_fields->>'peak_probability_multiplier','')::numeric, peak_probability_multiplier),
    peak_hours                  = COALESCE(
                                    CASE WHEN p_fields ? 'peak_hours'
                                         THEN ARRAY(SELECT (jsonb_array_elements_text(p_fields->'peak_hours'))::integer)
                                    END,
                                    peak_hours
                                  ),
    updated_at = now(),
    updated_by = p_admin_id
  WHERE key = 'global';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION manager_update_bot_smart_config(bigint, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION manager_update_bot_smart_config(bigint, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION manager_grant_skz(
  p_admin_id    bigint,
  p_telegram_id bigint,
  p_amount      numeric,
  p_note        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric := COALESCE(p_amount, 0);
  v_new_balance numeric;
BEGIN
  PERFORM require_manager_admin(p_admin_id);

  IF p_telegram_id IS NULL OR p_telegram_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_telegram_id');
  END IF;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_must_be_positive');
  END IF;

  -- Make sure a balance row exists, then credit free SKZ (counted as bonus).
  INSERT INTO user_balances (telegram_id) VALUES (p_telegram_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  UPDATE user_balances
     SET sc_balance = COALESCE(sc_balance, 0) + v_amount,
         sc_free    = COALESCE(sc_free, 0)    + v_amount,
         updated_at = now()
   WHERE telegram_id = p_telegram_id
   RETURNING sc_balance INTO v_new_balance;

  -- Best-effort ledger entry (table may not exist in older envs).
  BEGIN
    INSERT INTO ledger (telegram_id, amount, currency, category, note, created_at)
    VALUES (p_telegram_id, v_amount, 'SKZ', 'manager_grant', COALESCE(p_note, 'Free SKZ from manager'), now());
  EXCEPTION WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'telegram_id', p_telegram_id, 'granted', v_amount, 'new_balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION manager_grant_skz(bigint, bigint, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION manager_grant_skz(bigint, bigint, numeric, text) TO anon, authenticated;
