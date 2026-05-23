/*
  # Fix Solo Entry Function - Wrong Column Reference

  ## Problem
  `pay_charge_solo_entry` referenced `match_duration_seconds` which does not exist
  in `game_advanced_configs`. The correct column is `time_limit_sec`.
  This caused the function to crash on every call, preventing:
    - Solo game entry (users see "Could not start game")
    - Balance deduction for solo games

  ## Changes
  1. `pay_charge_solo_entry` — fix column reference from `match_duration_seconds` to `time_limit_sec`
  2. Re-grant execute permissions to anon role
*/

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
  SELECT entry_fee_skz, COALESCE(time_limit_sec, 60)
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

-- Ensure anon can call it
GRANT EXECUTE ON FUNCTION pay_charge_solo_entry(uuid, integer, numeric) TO anon;
GRANT EXECUTE ON FUNCTION pay_charge_solo_entry(uuid, integer, numeric) TO authenticated;
