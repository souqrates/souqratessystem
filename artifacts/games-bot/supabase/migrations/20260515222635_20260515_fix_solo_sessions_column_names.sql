/*
  # Fix solo_game_sessions NOT NULL constraint on session_id

  1. Root Cause
    - solo_game_sessions.session_id is NOT NULL
    - pay_charge_solo_entry inserts rows WITHOUT session_id
    - This causes: "null value in column session_id violates not-null constraint"
    - This is why every solo game entry fails with "session expired" on the frontend

  2. Fix
    - Rewrite pay_charge_solo_entry to include session_id in every INSERT
    - Use the correct column name (entry_fee_skz vs entry_fee) -- table has both,
      use entry_fee_skz as the primary and also populate entry_fee for compat
    - Use max_duration_s as primary and also populate duration_seconds for compat
*/

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id integer,
  p_amount numeric
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
  v_cfg record;
  v_fee numeric;
  v_bal numeric;
  v_new_bal numeric;
  v_is_paid boolean;
  v_trial_exp timestamptz;
  v_trial_active boolean;
  v_is_tester boolean;
  v_duration integer;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  PERFORM pay_ensure_balance_row(v_tg);

  SELECT entry_fee_skz, time_limit_sec INTO v_cfg
  FROM game_advanced_configs WHERE game_id = p_game_id AND enabled = true;
  v_fee := COALESCE(v_cfg.entry_fee_skz, 0);
  v_duration := COALESCE(v_cfg.time_limit_sec, 60);

  IF v_fee <= 0 THEN
    INSERT INTO solo_game_sessions (session_id, telegram_id, game_id, entry_fee_skz, entry_fee, max_duration_s, duration_seconds)
    VALUES (p_session_id, v_tg, p_game_id, 0, 0, v_duration, v_duration);
    RETURN json_build_object('ok', true, 'charged', 0);
  END IF;

  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg) INTO v_is_tester;
  IF v_is_tester THEN
    INSERT INTO solo_game_sessions (session_id, telegram_id, game_id, entry_fee_skz, entry_fee, max_duration_s, duration_seconds)
    VALUES (p_session_id, v_tg, p_game_id, 0, 0, v_duration, v_duration);
    RETURN json_build_object('ok', true, 'charged', 0, 'tester', true);
  END IF;

  SELECT is_paid, trial_expires_at INTO v_is_paid, v_trial_exp
  FROM user_balances WHERE telegram_id = v_tg;
  v_trial_active := (COALESCE(v_is_paid, false) = false)
    AND v_trial_exp IS NOT NULL AND v_trial_exp > now();
  IF v_trial_active THEN
    INSERT INTO solo_game_sessions (session_id, telegram_id, game_id, entry_fee_skz, entry_fee, max_duration_s, duration_seconds)
    VALUES (p_session_id, v_tg, p_game_id, 0, 0, v_duration, v_duration);
    RETURN json_build_object('ok', true, 'charged', 0, 'trial', true);
  END IF;

  SELECT sc_balance INTO v_bal FROM user_balances WHERE telegram_id = v_tg FOR UPDATE;
  IF COALESCE(v_bal, 0) < v_fee THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE user_balances SET sc_balance = sc_balance - v_fee, updated_at = now()
  WHERE telegram_id = v_tg RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, description, metadata
  ) VALUES (
    v_tg, 'debit', 'stake', v_fee, v_fee, 'SKZ',
    COALESCE(v_new_bal, 0), 'solo_entry',
    'Solo game entry: -' || v_fee || ' SKZ',
    json_build_object('game_id', p_game_id, 'fee', v_fee)
  );

  INSERT INTO solo_game_sessions (session_id, telegram_id, game_id, entry_fee_skz, entry_fee, max_duration_s, duration_seconds)
  VALUES (p_session_id, v_tg, p_game_id, v_fee, v_fee, v_duration, v_duration);

  PERFORM admin_wallet_credit_entry_fee(v_tg, v_fee, 'solo_' || p_game_id);
  RETURN json_build_object('ok', true, 'charged', v_fee, 'balance', v_new_bal);
END;
$function$;
