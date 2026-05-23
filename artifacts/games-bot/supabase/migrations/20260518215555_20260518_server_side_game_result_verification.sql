/*
  # Server-side game result verification

  1. Schema Changes
    - `solo_game_sessions`: Add `final_score` column (integer) to record player's actual score
    - `solo_game_sessions`: Add `target_score` column (integer) to record the required target at session start
    - `solo_game_sessions`: Add `result` column (text: 'won','lost','abandoned') for audit trail

  2. Function Changes
    - `pay_credit_solo_reward`: Add `p_score` parameter, validate score >= target_score before crediting
    - `pay_charge_solo_entry`: Store the game's target_score when session is created

  3. Security
    - Server now validates game outcome: score must meet or exceed target
    - Score recorded in session for audit trail
    - Prevents claiming prizes without meeting score threshold

  4. Important Notes
    - Games with no target score (target_score = 0) still allow "won" from client
    - Prize still capped at max tier prize (existing protection)
    - Backward compatible: p_score defaults to 0 for safety
*/

-- 1. Add columns to solo_game_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solo_game_sessions' AND column_name = 'final_score'
  ) THEN
    ALTER TABLE solo_game_sessions ADD COLUMN final_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solo_game_sessions' AND column_name = 'target_score'
  ) THEN
    ALTER TABLE solo_game_sessions ADD COLUMN target_score integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solo_game_sessions' AND column_name = 'result'
  ) THEN
    ALTER TABLE solo_game_sessions ADD COLUMN result text DEFAULT NULL;
  END IF;
END $$;

-- 2. Update pay_charge_solo_entry to store target_score from games table
CREATE OR REPLACE FUNCTION pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg            bigint;
  v_fee           numeric;
  v_max_fee       numeric;
  v_new_bal       numeric;
  v_is_tester     boolean;
  v_is_trial      boolean;
  v_target_score  integer;
  v_max_dur       integer;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN RAISE EXCEPTION 'session_invalid'; END IF;

  -- Check tester
  SELECT EXISTS(SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg AND active = true) INTO v_is_tester;

  -- Check trial
  SELECT CASE WHEN trial_expires_at IS NOT NULL AND trial_expires_at > now() THEN true ELSE false END
    INTO v_is_trial
    FROM user_balances WHERE telegram_id = v_tg;
  v_is_trial := COALESCE(v_is_trial, false);

  -- Validate fee against tiers
  SELECT MAX(entry_fee::numeric) INTO v_max_fee
    FROM game_fee_tiers WHERE game_id = p_game_id AND enabled = true;
  IF v_max_fee IS NULL THEN
    SELECT MAX(entry_fee::numeric) INTO v_max_fee
      FROM solo_fee_tiers WHERE enabled = true;
  END IF;

  v_fee := LEAST(COALESCE(p_amount, 0), COALESCE(v_max_fee, 10000), 10000);
  IF v_fee < 0 THEN v_fee := 0; END IF;

  -- Get target score and duration from game config
  SELECT COALESCE(target_score, 0), COALESCE(max_duration_s, 60)
    INTO v_target_score, v_max_dur
    FROM game_advanced_configs
    WHERE game_id = p_game_id;
  v_target_score := COALESCE(v_target_score, 0);
  v_max_dur := COALESCE(v_max_dur, 60);

  IF NOT v_is_tester AND NOT v_is_trial AND v_fee > 0 THEN
    PERFORM pay_ensure_balance_row(v_tg);
    UPDATE user_balances
      SET sc_balance = sc_balance - v_fee, updated_at = now()
      WHERE telegram_id = v_tg AND sc_balance >= v_fee
      RETURNING sc_balance INTO v_new_bal;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

    INSERT INTO ledger_entries (
      user_telegram_id, direction, category, amount_usd, amount_token, token,
      balance_after_usd, reference_type, reference_id, description
    ) VALUES (
      v_tg, 'debit', 'entry_fee', v_fee, v_fee, 'SKZ',
      v_new_bal, 'solo_game', p_game_id::text,
      'Solo entry fee: -' || v_fee || ' SKZ'
    );
  ELSE
    SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
  END IF;

  -- Create session with target_score for server-side verification later
  INSERT INTO solo_game_sessions (telegram_id, game_id, entry_fee, max_duration_s, target_score, started_at)
  VALUES (v_tg, p_game_id, v_fee, v_max_dur, v_target_score, now());

  RETURN json_build_object('ok', true, 'charged', v_fee, 'sc_balance', COALESCE(v_new_bal, 0));
END;
$$;

-- 3. Update pay_credit_solo_reward to accept and validate score
DROP FUNCTION IF EXISTS pay_credit_solo_reward(uuid, integer, numeric);

CREATE OR REPLACE FUNCTION pay_credit_solo_reward(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric DEFAULT 0,
  p_score      integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg          bigint;
  v_new_bal     numeric;
  v_prize       numeric;
  v_max_prize   numeric;
  v_prize_cfg   numeric;
  v_sess        record;
  v_recent_at   timestamptz;
  v_has_session boolean := false;
  v_score       integer;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  v_score := COALESCE(p_score, 0);

  -- Compute maximum allowed prize from enabled fee tiers
  SELECT MAX(entry_fee::numeric * prize_multiplier::numeric)
    INTO v_max_prize
    FROM game_fee_tiers
    WHERE game_id = p_game_id AND enabled = true;

  IF v_max_prize IS NULL THEN
    SELECT MAX(entry_fee::numeric * prize_multiplier::numeric)
      INTO v_max_prize
      FROM solo_fee_tiers
      WHERE enabled = true;
  END IF;

  IF v_max_prize IS NULL OR v_max_prize <= 0 THEN
    v_max_prize := 10000;
  END IF;

  -- Prize determination
  IF p_amount IS NOT NULL AND p_amount > 0 THEN
    v_prize := LEAST(p_amount, v_max_prize, 10000);
  ELSE
    SELECT win_prize_skz INTO v_prize_cfg
      FROM game_advanced_configs
      WHERE game_id = p_game_id AND COALESCE(enabled, true) = true;

    IF v_prize_cfg IS NOT NULL AND v_prize_cfg > 0 THEN
      v_prize := v_prize_cfg;
    ELSE
      RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'no_prize_configured');
    END IF;
  END IF;

  -- Find unrewarded session for exactly-once guarantee
  SELECT * INTO v_sess
    FROM solo_game_sessions
    WHERE telegram_id = v_tg
      AND game_id = p_game_id
      AND rewarded_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

  IF v_sess IS NOT NULL THEN
    v_has_session := true;

    -- Validate session hasn't expired
    IF now() > v_sess.started_at + make_interval(secs => v_sess.max_duration_s + 60) THEN
      UPDATE solo_game_sessions
        SET result = 'abandoned', final_score = v_score
        WHERE id = v_sess.id AND rewarded_at IS NULL;
      RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'session_expired');
    END IF;

    -- SERVER-SIDE SCORE VERIFICATION:
    -- If game has a target score, player must meet it to win
    IF v_sess.target_score > 0 AND v_score < v_sess.target_score THEN
      UPDATE solo_game_sessions
        SET result = 'lost', final_score = v_score
        WHERE id = v_sess.id AND rewarded_at IS NULL;
      RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'score_below_target',
        'score', v_score, 'target', v_sess.target_score);
    END IF;

    -- Mark rewarded (exactly-once) and record score
    UPDATE solo_game_sessions
      SET rewarded_at = now(), reward_amount = v_prize, final_score = v_score, result = 'won'
      WHERE id = v_sess.id AND rewarded_at IS NULL;

    IF NOT FOUND THEN
      SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
      RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
    END IF;
  ELSE
    -- Legacy dedup: 10s window
    SELECT MAX(created_at) INTO v_recent_at
      FROM ledger_entries
      WHERE user_telegram_id = v_tg
        AND direction = 'credit'
        AND category = 'payout'
        AND reference_type = 'solo_game'
        AND reference_id = p_game_id::text
        AND created_at > now() - interval '10 seconds';

    IF v_recent_at IS NOT NULL THEN
      SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
      RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
    END IF;
  END IF;

  -- Credit the prize
  PERFORM pay_ensure_balance_row(v_tg);

  UPDATE user_balances
    SET sc_balance    = COALESCE(sc_balance, 0)    + v_prize,
        total_won_usd = COALESCE(total_won_usd, 0) + v_prize,
        updated_at    = now()
    WHERE telegram_id = v_tg
    RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'credit', 'payout',
    v_prize, v_prize, 'SKZ',
    v_new_bal,
    'solo_game', p_game_id::text,
    'Solo game reward: +' || v_prize || ' SKZ',
    jsonb_build_object(
      'game_id',            p_game_id,
      'tier_prize',         p_amount,
      'validated_prize',    v_prize,
      'max_tier_prize',     v_max_prize,
      'final_score',        v_score,
      'solo_session_id',    v_sess.id
    )
  );

  -- Referral commission (non-blocking)
  BEGIN
    PERFORM credit_referral_commission(v_tg, v_prize, 'solo_win');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN json_build_object('ok', true, 'credited', v_prize, 'sc_balance', v_new_bal);
END;
$$;

GRANT EXECUTE ON FUNCTION pay_credit_solo_reward(uuid, integer, numeric, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION pay_charge_solo_entry(uuid, integer, numeric) TO authenticated, anon, service_role;
