/*
  # Force entry-fee deduction always (remove trial/tester bypasses)

  ## What this does
  Two payment functions had silent "free play" bypasses that prevented any
  balance deduction when joining a game:
    - `pay_debit_bet`            -> used by 2P / 4P / Group room create+join
    - `pay_charge_solo_entry`    -> used by Solo game entry

  Both checked `free_play_testers` and `trial_expires_at` and returned
  successfully WITHOUT charging the wallet. Result: entry fee never reduced
  the player's balance.

  This migration replaces both functions so that:
    1. The bet/entry amount is ALWAYS deducted from the player's wallet.
    2. Solo entries still spend `sc_free` first then `sc_balance` (existing rule).
    3. Insufficient balance raises `insufficient_balance` so the lobby surfaces
       a clear error.
    4. Ledger entries are still written for each charge.

  ## Tables touched
    - `user_balances` (read/write of `sc_free`, `sc_balance`)
    - `ledger_entries` (insert of `debit/stake` rows for solo)

  ## Security
    - Both functions remain SECURITY DEFINER with locked search_path.
    - No RLS policy changes.
*/

CREATE OR REPLACE FUNCTION public.pay_debit_bet(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_real numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  SELECT sc_balance
    INTO v_real
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
  v_tg         bigint;
  v_free       numeric;
  v_bal        numeric;
  v_take_free  numeric;
  v_take_bal   numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  SELECT sc_free, sc_balance
    INTO v_free, v_bal
    FROM user_balances
   WHERE telegram_id = v_tg
   FOR UPDATE;

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
    'from_free',    v_take_free,
    'from_balance', v_take_bal,
    'sc_free',      COALESCE(v_free, 0) - v_take_free,
    'sc_balance',   COALESCE(v_bal,  0) - v_take_bal
  );
END;
$function$;
