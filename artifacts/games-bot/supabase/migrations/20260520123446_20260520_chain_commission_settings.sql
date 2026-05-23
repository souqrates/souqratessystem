/*
  # Chain Commission Settings — Manager Control Panel

  ## Summary
  Adds manager-configurable settings for the infinite chain commission system
  and an RPC to read/write them, so any change in the manager dashboard takes
  effect immediately on all future earnings.

  ## New manager_config keys inserted
  - commission_l1_pct      : L1 base percentage (default 5)
  - commission_chain_pct   : Per-level cascade percentage for L2, L3, L4... (default 2)
  - commission_min_amount  : Minimum commission to credit (default 0.01)
  - commission_max_levels  : Hard cap on chain depth (default 15)

  ## Modified function
  - credit_referral_commission now reads the four keys above from manager_config
    at call time, so any manager change is immediately applied to the next winning match.

  ## New RPCs
  - manager_get_chain_settings(p_admin_id) — read the four keys
  - manager_set_chain_settings(p_admin_id, p_l1_pct, p_chain_pct, p_min_amount, p_max_levels) — write all at once
*/

-- ─── 1. Seed default config keys if not present ──────────────────────────────

INSERT INTO manager_config (key, value) VALUES
  ('commission_l1_pct',    '5'),
  ('commission_chain_pct', '2'),
  ('commission_min_amount','0.01'),
  ('commission_max_levels','15')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Read RPC ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION manager_get_chain_settings(p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM managers WHERE admin_id = p_admin_id AND is_active = true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'l1_pct',     (SELECT COALESCE(NULLIF(value,'')::numeric, 5)    FROM manager_config WHERE key = 'commission_l1_pct'),
    'chain_pct',  (SELECT COALESCE(NULLIF(value,'')::numeric, 2)    FROM manager_config WHERE key = 'commission_chain_pct'),
    'min_amount', (SELECT COALESCE(NULLIF(value,'')::numeric, 0.01) FROM manager_config WHERE key = 'commission_min_amount'),
    'max_levels', (SELECT COALESCE(NULLIF(value,'')::int, 15)       FROM manager_config WHERE key = 'commission_max_levels')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manager_get_chain_settings(text) TO anon, authenticated;

-- ─── 3. Write RPC ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION manager_set_chain_settings(
  p_admin_id    text,
  p_l1_pct      numeric,
  p_chain_pct   numeric,
  p_min_amount  numeric,
  p_max_levels  int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM managers WHERE admin_id = p_admin_id AND is_active = true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Validate ranges
  IF p_l1_pct    < 0 OR p_l1_pct    > 50  THEN RETURN jsonb_build_object('ok', false, 'error', 'l1_pct out of range 0-50');    END IF;
  IF p_chain_pct < 0 OR p_chain_pct > 50  THEN RETURN jsonb_build_object('ok', false, 'error', 'chain_pct out of range 0-50'); END IF;
  IF p_min_amount < 0                      THEN RETURN jsonb_build_object('ok', false, 'error', 'min_amount must be >= 0');     END IF;
  IF p_max_levels < 1 OR p_max_levels > 50 THEN RETURN jsonb_build_object('ok', false, 'error', 'max_levels out of range 1-50'); END IF;

  INSERT INTO manager_config (key, value) VALUES
    ('commission_l1_pct',     p_l1_pct::text),
    ('commission_chain_pct',  p_chain_pct::text),
    ('commission_min_amount', p_min_amount::text),
    ('commission_max_levels', p_max_levels::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_set_chain_settings(text, numeric, numeric, numeric, int) TO anon, authenticated;

-- ─── 4. Rewrite credit_referral_commission to read settings live ──────────────

DROP FUNCTION IF EXISTS credit_referral_commission(bigint, numeric, text);

CREATE FUNCTION credit_referral_commission(
  p_referred_telegram_id bigint,
  p_amount_won_skz       numeric,
  p_source               text DEFAULT 'match_win'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Settings read live from manager_config each call
  v_base_pct       numeric;
  v_chain_pct      numeric;
  v_min_commission numeric;
  v_max_levels     int;

  v_prev_amount    numeric;
  v_cur_tg         bigint;
  v_parent_tg      bigint;
  v_commission     numeric;
  v_level          int := 0;
  v_level_code     text;
  v_tier_mult      numeric;
  v_ref_count      int;
  v_credited_count int := 0;
  v_existing       uuid;
BEGIN
  IF p_amount_won_skz IS NULL OR p_amount_won_skz <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_amount');
  END IF;

  -- ── Read live settings from manager_config ────────────────────────────────
  SELECT COALESCE(NULLIF(value,'')::numeric, 5)    INTO v_base_pct    FROM manager_config WHERE key = 'commission_l1_pct';
  SELECT COALESCE(NULLIF(value,'')::numeric, 2)    INTO v_chain_pct   FROM manager_config WHERE key = 'commission_chain_pct';
  SELECT COALESCE(NULLIF(value,'')::numeric, 0.01) INTO v_min_commission FROM manager_config WHERE key = 'commission_min_amount';
  SELECT COALESCE(NULLIF(value,'')::int, 15)       INTO v_max_levels  FROM manager_config WHERE key = 'commission_max_levels';

  v_base_pct       := COALESCE(v_base_pct, 5);
  v_chain_pct      := COALESCE(v_chain_pct, 2);
  v_min_commission := COALESCE(v_min_commission, 0.01);
  v_max_levels     := COALESCE(v_max_levels, 15);

  -- Override L1 % from active referral program if one exists
  DECLARE v_prog_pct numeric;
  BEGIN
    SELECT LEAST(COALESCE(p.commission_pct, v_base_pct), 50) INTO v_prog_pct
    FROM referral_programs p
    WHERE p.is_active = true
      AND (p.valid_from IS NULL OR p.valid_from <= now())
      AND (p.valid_until IS NULL OR p.valid_until > now())
    ORDER BY p.created_at DESC
    LIMIT 1;
    IF v_prog_pct IS NOT NULL THEN v_base_pct := v_prog_pct; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Idempotency check (60s window) on L1
  SELECT ur.referrer_tg INTO v_parent_tg
  FROM user_referrals ur
  WHERE ur.referred_tg = p_referred_telegram_id
  LIMIT 1;

  IF v_parent_tg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_referrer');
  END IF;

  SELECT id INTO v_existing
  FROM referral_earnings
  WHERE referrer_telegram_id = v_parent_tg
    AND referred_telegram_id = p_referred_telegram_id
    AND source = p_source
    AND base_amount_skz = p_amount_won_skz
    AND created_at > now() - interval '60 seconds';

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_commission');
  END IF;

  -- ── Traverse chain ────────────────────────────────────────────────────────
  v_cur_tg      := p_referred_telegram_id;
  v_prev_amount := p_amount_won_skz;

  LOOP
    v_level := v_level + 1;
    EXIT WHEN v_level > v_max_levels;

    SELECT ur.referrer_tg INTO v_parent_tg
    FROM user_referrals ur
    WHERE ur.referred_tg = v_cur_tg
    LIMIT 1;

    EXIT WHEN v_parent_tg IS NULL;
    EXIT WHEN v_parent_tg = p_referred_telegram_id;

    IF v_level = 1 THEN
      -- L1: tier-boosted base percentage of original prize
      SELECT COUNT(*) INTO v_ref_count
      FROM user_referrals WHERE referrer_tg = v_parent_tg;

      SELECT COALESCE(commission_multiplier, 1.0) INTO v_tier_mult
      FROM affiliate_tiers
      WHERE min_referrals <= v_ref_count
      ORDER BY min_referrals DESC
      LIMIT 1;

      v_tier_mult  := COALESCE(v_tier_mult, 1.0);
      v_commission := ROUND(p_amount_won_skz * LEAST(v_base_pct * v_tier_mult, 50) / 100.0, 4);
    ELSE
      -- L2+: chain_pct % of the PREVIOUS level's commission
      v_commission := ROUND(v_prev_amount * v_chain_pct / 100.0, 4);
    END IF;

    EXIT WHEN v_commission < v_min_commission;

    v_level_code := 'L' || v_level::text;

    INSERT INTO user_balances (telegram_id, sc_balance, referral_balance)
    VALUES (v_parent_tg, 0, 0)
    ON CONFLICT (telegram_id) DO NOTHING;

    UPDATE user_balances
    SET referral_balance = COALESCE(referral_balance, 0) + v_commission,
        updated_at = now()
    WHERE telegram_id = v_parent_tg;

    INSERT INTO referral_earnings (
      referrer_telegram_id, referred_telegram_id,
      source, amount_skz, base_amount_skz, pct_applied, code
    ) VALUES (
      v_parent_tg, p_referred_telegram_id,
      p_source, v_commission, p_amount_won_skz,
      CASE WHEN v_level = 1 THEN LEAST(v_base_pct * v_tier_mult, 50) ELSE v_chain_pct END,
      v_level_code
    );

    v_credited_count := v_credited_count + 1;
    v_prev_amount    := v_commission;
    v_cur_tg         := v_parent_tg;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'levels_credited', v_credited_count,
    'l1_pct_used',     v_base_pct,
    'chain_pct_used',  v_chain_pct
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_referral_commission(bigint, numeric, text) TO anon, authenticated;
