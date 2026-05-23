/*
  # Infinite Chain Commission System

  ## Summary
  Replaces the fixed 2-level referral commission with an infinite cascading chain system.

  ## How It Works
  - Level 1 (direct referrer): earns 5% of the winner's prize
  - Level 2+: each level earns 2% of the PREVIOUS level's commission amount (not the original prize)
  - Chain continues until commission drops below 0.01 SKZ or reaches 15 levels (safety cap)

  ## Example (1000 SKZ win):
  - Ahmed invited Ali:   Ahmed (L1) earns 5% of 1000  = 50 SKZ
  - Ali invited Mohamed: Ali  (L1) earns 5% of 1000  = 50 SKZ, Ahmed (L2) earns 2% of 50 = 1 SKZ
  - Mohamed invited Hani: Mohamed (L1)=50, Ali (L2)=2% of 50=1, Ahmed (L3)=2% of 1=0.02 SKZ

  ## Changes
  - Rewrites credit_referral_commission to use iterative chain traversal
  - Updates ref_get_my_stats to aggregate earnings across all levels (L1, L2, L3...)
  - referral_earnings.code now stores 'L1', 'L2', 'L3', ... for each level
*/

-- Drop old 2-level function
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
  v_base_pct       numeric;
  v_prev_amount    numeric;  -- commission amount of the previous level
  v_cur_tg         bigint;   -- current node being credited
  v_parent_tg      bigint;   -- parent of current node
  v_commission     numeric;
  v_level          int := 0;
  v_max_levels     int := 15;
  v_min_commission numeric := 0.01;
  v_tier_mult      numeric;
  v_ref_count      int;
  v_level_code     text;
  v_credited_count int := 0;
  v_existing       uuid;
BEGIN
  -- Basic validation
  IF p_amount_won_skz IS NULL OR p_amount_won_skz <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_amount');
  END IF;

  -- Get base commission % from active program or manager_config fallback
  SELECT LEAST(COALESCE(p.commission_pct, 5), 50) INTO v_base_pct
  FROM referral_programs p
  WHERE p.is_active = true
    AND (p.valid_from IS NULL OR p.valid_from <= now())
    AND (p.valid_until IS NULL OR p.valid_until > now())
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_base_pct IS NULL THEN
    SELECT LEAST(COALESCE(NULLIF(value,'')::numeric, 5), 50) INTO v_base_pct
    FROM manager_config WHERE key = 'referral_lifetime';
    v_base_pct := COALESCE(v_base_pct, 5);
  END IF;

  -- Idempotency check (60s window) — check on L1 only
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

  -- Start chain: first node is the winner
  v_cur_tg := p_referred_telegram_id;
  v_prev_amount := p_amount_won_skz;  -- L1 is calculated from the prize

  LOOP
    v_level := v_level + 1;

    -- Safety cap
    EXIT WHEN v_level > v_max_levels;

    -- Find parent (who referred v_cur_tg)
    SELECT ur.referrer_tg INTO v_parent_tg
    FROM user_referrals ur
    WHERE ur.referred_tg = v_cur_tg
    LIMIT 1;

    EXIT WHEN v_parent_tg IS NULL;
    EXIT WHEN v_parent_tg = p_referred_telegram_id; -- prevent cycles

    -- Calculate commission for this level
    IF v_level = 1 THEN
      -- L1: tier-boosted percentage of the original prize
      SELECT COUNT(*) INTO v_ref_count
      FROM user_referrals WHERE referrer_tg = v_parent_tg;

      SELECT COALESCE(commission_multiplier, 1.0) INTO v_tier_mult
      FROM affiliate_tiers
      WHERE min_referrals <= v_ref_count
      ORDER BY min_referrals DESC
      LIMIT 1;

      v_tier_mult := COALESCE(v_tier_mult, 1.0);
      v_commission := ROUND(p_amount_won_skz * LEAST(v_base_pct * v_tier_mult, 50) / 100.0, 2);
    ELSE
      -- L2+: 2% of the PREVIOUS level's commission
      v_commission := ROUND(v_prev_amount * 0.02, 2);
    END IF;

    -- Stop chain if too small to be meaningful
    EXIT WHEN v_commission < v_min_commission;

    v_level_code := 'L' || v_level::text;

    -- Ensure balance row exists
    INSERT INTO user_balances (telegram_id, sc_balance, referral_balance)
    VALUES (v_parent_tg, 0, 0)
    ON CONFLICT (telegram_id) DO NOTHING;

    -- Credit referral_balance
    UPDATE user_balances
    SET referral_balance = COALESCE(referral_balance, 0) + v_commission,
        updated_at = now()
    WHERE telegram_id = v_parent_tg;

    -- Record in earnings log
    INSERT INTO referral_earnings (
      referrer_telegram_id, referred_telegram_id,
      source, amount_skz, base_amount_skz, pct_applied, code
    ) VALUES (
      v_parent_tg, p_referred_telegram_id,
      p_source, v_commission, p_amount_won_skz,
      CASE WHEN v_level = 1 THEN LEAST(v_base_pct * v_tier_mult, 50) ELSE 2.0 END,
      v_level_code
    );

    v_credited_count := v_credited_count + 1;

    -- Advance up the chain
    v_prev_amount := v_commission;
    v_cur_tg := v_parent_tg;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'levels_credited', v_credited_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_referral_commission(bigint, numeric, text) TO anon, authenticated;

-- ─── Update ref_get_my_stats to aggregate all levels ─────────────────────────

CREATE OR REPLACE FUNCTION ref_get_my_stats(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg           bigint;
  v_total_invites int;
  v_active_refs   int;
  v_total_earned  numeric;
  v_ref_balance   numeric;
  v_l1_earned     numeric;
  v_indirect_earned numeric;
  v_this_week     numeric;
  v_tier_name     text;
  v_tier_color    text;
  v_tier_mult     numeric;
  v_next_tier_at  int;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_invalid');
  END IF;

  SELECT COUNT(*) INTO v_total_invites
  FROM user_referrals WHERE referrer_tg = v_tg;

  SELECT COUNT(DISTINCT ur.referred_tg) INTO v_active_refs
  FROM user_referrals ur
  JOIN user_balances ub ON ub.telegram_id = ur.referred_tg
  WHERE ur.referrer_tg = v_tg
    AND ub.updated_at > now() - interval '30 days';

  -- L1 earnings (direct referrals)
  SELECT COALESCE(SUM(amount_skz), 0) INTO v_l1_earned
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg AND code = 'L1';

  -- Indirect earnings (L2, L3, L4 ... all other levels)
  SELECT COALESCE(SUM(amount_skz), 0) INTO v_indirect_earned
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg AND code <> 'L1' AND code <> 'SIGNUP';

  v_total_earned := COALESCE(v_l1_earned, 0) + COALESCE(v_indirect_earned, 0);

  SELECT COALESCE(SUM(amount_skz), 0) INTO v_this_week
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg
    AND created_at >= date_trunc('week', now());

  SELECT COALESCE(referral_balance, 0) INTO v_ref_balance
  FROM user_balances WHERE telegram_id = v_tg;

  SELECT name, color, commission_multiplier INTO v_tier_name, v_tier_color, v_tier_mult
  FROM affiliate_tiers
  WHERE min_referrals <= COALESCE(v_total_invites, 0)
  ORDER BY min_referrals DESC
  LIMIT 1;

  SELECT min_referrals INTO v_next_tier_at
  FROM affiliate_tiers
  WHERE min_referrals > COALESCE(v_total_invites, 0)
  ORDER BY min_referrals ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'total_invites',     COALESCE(v_total_invites, 0),
    'active_refs',       COALESCE(v_active_refs, 0),
    'total_earned',      COALESCE(v_total_earned, 0),
    'l1_earned',         COALESCE(v_l1_earned, 0),
    'l2_earned',         COALESCE(v_indirect_earned, 0),
    'this_week',         COALESCE(v_this_week, 0),
    'referral_balance',  COALESCE(v_ref_balance, 0),
    'tier_name',         COALESCE(v_tier_name, 'Starter'),
    'tier_color',        COALESCE(v_tier_color, '#94a3b8'),
    'tier_mult',         COALESCE(v_tier_mult, 1.0),
    'next_tier_at',      v_next_tier_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ref_get_my_stats(uuid) TO anon, authenticated;
