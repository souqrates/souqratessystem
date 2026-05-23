/*
  # Fix session resolution in all functions that bypass pay_resolve_session

  1. Problem
    - pay_charge_solo_entry does its own strict session lookup:
      SELECT ... FROM telegram_sessions WHERE id = p_session_id AND expires_at > now()
    - This fails when the session_id is technically expired but the user has a newer
      valid session (which pay_resolve_session handles via fallback)
    - Same issue affects admin_wallet_get_balance, admin_wallet_deposit,
      admin_wallet_get_transactions
    - Result: users see "session expired" even when they have a valid session

  2. Fix
    - pay_charge_solo_entry: replace direct lookup with pay_resolve_session()
    - admin wallet functions: use pay_resolve_session() + separate admin check
    - All functions now benefit from the resilient session fallback

  3. Security
    - No change in authorization logic -- same checks, just more resilient session lookup
    - Admin functions still verify manager_admins membership
*/

-- Fix pay_charge_solo_entry
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
    INSERT INTO solo_game_sessions (telegram_id, game_id, entry_fee, duration_seconds)
    VALUES (v_tg, p_game_id, 0, v_duration);
    RETURN json_build_object('ok', true, 'charged', 0);
  END IF;

  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg) INTO v_is_tester;
  IF v_is_tester THEN
    INSERT INTO solo_game_sessions (telegram_id, game_id, entry_fee, duration_seconds)
    VALUES (v_tg, p_game_id, 0, v_duration);
    RETURN json_build_object('ok', true, 'charged', 0, 'tester', true);
  END IF;

  SELECT is_paid, trial_expires_at INTO v_is_paid, v_trial_exp
  FROM user_balances WHERE telegram_id = v_tg;
  v_trial_active := (COALESCE(v_is_paid, false) = false)
    AND v_trial_exp IS NOT NULL AND v_trial_exp > now();
  IF v_trial_active THEN
    INSERT INTO solo_game_sessions (telegram_id, game_id, entry_fee, duration_seconds)
    VALUES (v_tg, p_game_id, 0, v_duration);
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

  INSERT INTO solo_game_sessions (telegram_id, game_id, entry_fee, duration_seconds)
  VALUES (v_tg, p_game_id, v_fee, v_duration);

  PERFORM admin_wallet_credit_entry_fee(v_tg, v_fee, 'solo_' || p_game_id);
  RETURN json_build_object('ok', true, 'charged', v_fee, 'balance', v_new_bal);
END;
$function$;

-- Fix admin_wallet_get_balance
CREATE OR REPLACE FUNCTION public.admin_wallet_get_balance(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
  v_bal numeric;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = v_tg) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT balance INTO v_bal FROM admin_wallet WHERE id = 1;
  RETURN json_build_object('ok', true, 'balance', COALESCE(v_bal, 0));
END;
$function$;

-- Fix admin_wallet_deposit
CREATE OR REPLACE FUNCTION public.admin_wallet_deposit(p_session_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
  v_new_bal numeric;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = v_tg) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  UPDATE admin_wallet SET balance = balance + p_amount, updated_at = now()
  WHERE id = 1 RETURNING balance INTO v_new_bal;
  INSERT INTO admin_wallet_transactions (direction, amount, category, user_telegram_id, reference_id, description, balance_after)
  VALUES ('credit', p_amount, 'manual_deposit', v_tg, NULL,
    'Manual deposit by admin: +' || p_amount || ' SKZ', COALESCE(v_new_bal, 0));
  RETURN json_build_object('ok', true, 'balance', v_new_bal);
END;
$function$;

-- Fix admin_wallet_get_transactions
CREATE OR REPLACE FUNCTION public.admin_wallet_get_transactions(
  p_session_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
  v_rows json;
  v_total bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = v_tg) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT count(*) INTO v_total FROM admin_wallet_transactions;
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT id, direction, amount, category, user_telegram_id, reference_id, description, balance_after, created_at
    FROM admin_wallet_transactions ORDER BY created_at DESC
    LIMIT LEAST(p_limit, 200) OFFSET p_offset
  ) t;
  RETURN json_build_object('ok', true, 'transactions', v_rows, 'total', v_total);
END;
$function$;
