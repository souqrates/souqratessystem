/*
  # Restore Trial + Admin-Only Free Play Bypass

  Restores entry-fee bypass logic in pay_debit_bet and pay_charge_solo_entry.

  Rules:
  1. Admins/testers listed in free_play_testers: never charged
  2. Users still inside their 8-hour trial (NOT is_paid AND trial_expires_at > now()): not charged
  3. Everyone else: charged normally; insufficient balance raises exception
*/

CREATE OR REPLACE FUNCTION public.pay_debit_bet(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_real numeric;
  v_is_tester boolean;
  v_trial_active boolean;
  v_is_paid boolean;
  v_trial_exp timestamptz;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = p_tg)
    INTO v_is_tester;
  IF v_is_tester THEN RETURN; END IF;

  SELECT is_paid, trial_expires_at
    INTO v_is_paid, v_trial_exp
  FROM user_balances
  WHERE telegram_id = p_tg;

  v_trial_active := (COALESCE(v_is_paid, false) = false)
                    AND v_trial_exp IS NOT NULL
                    AND v_trial_exp > now();
  IF v_trial_active THEN RETURN; END IF;

  SELECT sc_balance INTO v_real
  FROM user_balances
  WHERE telegram_id = p_tg
  FOR UPDATE;

  IF COALESCE(v_real, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '53100';
  END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance - p_amount,
      updated_at = now()
  WHERE telegram_id = p_tg;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(p_session_id uuid, p_game_id integer, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg          bigint;
  v_free        numeric;
  v_bal         numeric;
  v_take_free   numeric;
  v_take_bal    numeric;
  v_is_tester   boolean;
  v_is_paid     boolean;
  v_trial_exp   timestamptz;
  v_trial_active boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

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

  IF v_is_tester OR v_trial_active THEN
    RETURN json_build_object(
      'ok', true,
      'charged', 0,
      'trial', v_trial_active,
      'tester', v_is_tester,
      'from_free', 0,
      'from_balance', 0,
      'sc_free', COALESCE(v_free, 0),
      'sc_balance', COALESCE(v_bal, 0)
    );
  END IF;

  IF COALESCE(v_free, 0) + COALESCE(v_bal, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_take_free := LEAST(COALESCE(v_free, 0), p_amount);
  v_take_bal  := p_amount - v_take_free;

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
    p_amount, p_amount, 'SKZ',
    COALESCE(v_bal, 0) - v_take_bal,
    'solo_game', p_game_id::text,
    'Solo game entry: -' || p_amount || ' SKZ',
    jsonb_build_object('from_free', v_take_free, 'from_balance', v_take_bal, 'game_id', p_game_id)
  );

  RETURN json_build_object(
    'ok',           true,
    'charged',      p_amount,
    'trial',        false,
    'tester',       false,
    'from_free',    v_take_free,
    'from_balance', v_take_bal,
    'sc_free',      COALESCE(v_free, 0) - v_take_free,
    'sc_balance',   COALESCE(v_bal,  0) - v_take_bal
  );
END;
$function$;