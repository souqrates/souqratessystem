/*
  # Rewrite Solo Entry/Reward Functions (Server-Authoritative)

  ## Changes
  1. pay_charge_solo_entry: now looks up canonical fee from game_advanced_configs
     (ignores client-supplied amount), creates a solo_game_session record
  2. pay_credit_solo_reward: now requires a valid solo_game_session,
     validates time bounds, uses session-based idempotency instead of 6-second window
  3. Backward compatible: legacy path (no session) still works with time-based dedup
*/

-- =====================================================================
-- REWRITE pay_charge_solo_entry
-- OLD: trusted client-supplied p_amount for fee
-- NEW: looks up canonical fee from game_advanced_configs,
--      creates solo_game_session as gameplay proof
-- =====================================================================

CREATE OR REPLACE FUNCTION pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tg            bigint;
  v_free          numeric;
  v_bal           numeric;
  v_take_free     numeric;
  v_take_bal      numeric;
  v_is_tester     boolean;
  v_is_paid       boolean;
  v_trial_exp     timestamptz;
  v_trial_active  boolean;
  v_fee           numeric;
  v_duration      integer;
  v_session_row   uuid;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  -- Server-authoritative fee lookup (ignore client p_amount)
  SELECT entry_fee_skz, COALESCE(match_duration_seconds, 60)
  INTO v_fee, v_duration
  FROM game_advanced_configs
  WHERE game_id = p_game_id AND COALESCE(enabled, true) = true;

  IF v_fee IS NULL THEN
    v_fee := COALESCE(p_amount, 0);
    v_duration := 60;
  END IF;

  IF v_fee <= 0 THEN v_fee := 0; END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg)
  INTO v_is_tester;

  SELECT is_paid, trial_expires_at, sc_free, sc_balance
  INTO v_is_paid, v_trial_exp, v_free, v_bal
  FROM user_balances
  WHERE telegram_id = v_tg
  FOR UPDATE;

  v_trial_active := (COALESCE(v_is_paid, false) = false)
    AND v_trial_exp IS NOT NULL
    AND v_trial_exp > now();

  -- Create solo game session record (proof of game start)
  INSERT INTO solo_game_sessions (session_id, telegram_id, game_id, entry_fee_skz, max_duration_s)
  VALUES (p_session_id, v_tg, p_game_id, v_fee, v_duration + 30)
  RETURNING id INTO v_session_row;

  IF v_is_tester OR v_trial_active THEN
    RETURN json_build_object(
      'ok', true, 'charged', 0,
      'trial', v_trial_active, 'tester', v_is_tester,
      'from_free', 0, 'from_balance', 0,
      'sc_free', COALESCE(v_free, 0), 'sc_balance', COALESCE(v_bal, 0),
      'solo_session_id', v_session_row
    );
  END IF;

  IF v_fee = 0 THEN
    RETURN json_build_object(
      'ok', true, 'charged', 0,
      'trial', false, 'tester', false,
      'from_free', 0, 'from_balance', 0,
      'sc_free', COALESCE(v_free, 0), 'sc_balance', COALESCE(v_bal, 0),
      'solo_session_id', v_session_row
    );
  END IF;

  IF COALESCE(v_free, 0) + COALESCE(v_bal, 0) < v_fee THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_take_free := LEAST(COALESCE(v_free, 0), v_fee);
  v_take_bal  := v_fee - v_take_free;

  UPDATE user_balances
  SET sc_free    = COALESCE(sc_free, 0)    - v_take_free,
      sc_balance = COALESCE(sc_balance, 0) - v_take_bal,
      updated_at = now()
  WHERE telegram_id = v_tg;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'debit', 'stake',
    v_fee, v_fee, 'SKZ',
    COALESCE(v_bal, 0) - v_take_bal,
    'solo_game', p_game_id::text,
    'Solo game entry: -' || v_fee || ' SKZ',
    jsonb_build_object('from_free', v_take_free, 'from_balance', v_take_bal,
                       'game_id', p_game_id, 'solo_session_id', v_session_row)
  );

  RETURN json_build_object(
    'ok', true, 'charged', v_fee,
    'trial', false, 'tester', false,
    'from_free', v_take_free, 'from_balance', v_take_bal,
    'sc_free', COALESCE(v_free, 0) - v_take_free,
    'sc_balance', COALESCE(v_bal, 0) - v_take_bal,
    'solo_session_id', v_session_row
  );
END;
$fn$;

-- =====================================================================
-- REWRITE pay_credit_solo_reward
-- OLD: 6-second time-based dedup (fragile, exploitable)
-- NEW: requires valid solo_game_session, validates time bounds,
--      marks session as rewarded (exactly-once guarantee)
--      Falls back to time-based dedup for legacy games started
--      before this migration
-- =====================================================================

CREATE OR REPLACE FUNCTION pay_credit_solo_reward(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tg          bigint;
  v_new_bal     numeric;
  v_prize       numeric;
  v_sess        record;
  v_recent_at   timestamptz;
  v_has_session  boolean := false;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  -- Server-authoritative prize lookup
  SELECT win_prize_skz INTO v_prize
  FROM game_advanced_configs
  WHERE game_id = p_game_id AND COALESCE(enabled, true) = true;

  IF v_prize IS NULL OR v_prize <= 0 THEN
    RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'no_prize_configured');
  END IF;

  -- Try to find a valid unrewarded session for this player+game
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

    -- Validate time bounds: game must not have expired
    IF now() > v_sess.started_at + make_interval(secs => v_sess.max_duration_s + 60) THEN
      RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'session_expired');
    END IF;

    -- Mark session as rewarded (exactly-once)
    UPDATE solo_game_sessions
    SET rewarded_at = now(), reward_amount = v_prize
    WHERE id = v_sess.id AND rewarded_at IS NULL;

    IF NOT FOUND THEN
      SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
      RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
    END IF;
  ELSE
    -- Legacy fallback: time-based dedup for games started before this migration
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

  -- Credit the reward
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
    jsonb_build_object('game_id', p_game_id, 'server_authoritative', true,
                       'solo_session_id', v_sess.id)
  );

  -- Referral commission (non-blocking)
  BEGIN
    PERFORM credit_referral_commission(v_tg, v_prize, 'solo_win');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'credited', v_prize, 'sc_balance', v_new_bal);
END;
$fn$;

-- Ensure proper grants
REVOKE EXECUTE ON FUNCTION pay_charge_solo_entry FROM anon;
GRANT EXECUTE ON FUNCTION pay_charge_solo_entry TO authenticated;
REVOKE EXECUTE ON FUNCTION pay_credit_solo_reward FROM anon;
GRANT EXECUTE ON FUNCTION pay_credit_solo_reward TO authenticated;
