/*
  # Fix Solo Entry/Reward Ledger Categories

  Previous solo RPC inserts used categories 'bet' and 'win', which are not
  in the `ledger_entries_category_check` constraint (allowed: deposit,
  withdrawal, withdrawal_hold, withdrawal_refund, stake, payout, rake,
  referral_bonus, bonus, adjustment). The constraint violation aborted
  the entire transaction, so neither the debit nor the credit was applied.

  This migration replaces the category names with the valid equivalents:
    - 'bet'  -> 'stake'
    - 'win'  -> 'payout'

  Also fills in `balance_after_usd` so the audit trail shows the post-tx
  balance correctly.
*/

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id    int,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg        bigint;
  v_free      numeric;
  v_bal       numeric;
  v_take_free numeric;
  v_take_bal  numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  SELECT sc_free, sc_balance INTO v_free, v_bal
    FROM user_balances WHERE telegram_id = v_tg FOR UPDATE;

  IF COALESCE(v_free,0) + COALESCE(v_bal,0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_take_free := LEAST(COALESCE(v_free,0), p_amount);
  v_take_bal  := p_amount - v_take_free;

  UPDATE user_balances
    SET sc_free    = COALESCE(sc_free,0)    - v_take_free,
        sc_balance = COALESCE(sc_balance,0) - v_take_bal,
        updated_at = now()
    WHERE telegram_id = v_tg;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'debit', 'stake',
    p_amount, p_amount, 'SKZ',
    COALESCE(v_bal,0) - v_take_bal,
    'solo_game', p_game_id::text,
    'Solo game entry: -' || p_amount || ' SKZ',
    jsonb_build_object('from_free', v_take_free, 'from_balance', v_take_bal, 'game_id', p_game_id)
  );

  RETURN json_build_object(
    'ok',           true,
    'charged',      p_amount,
    'from_free',    v_take_free,
    'from_balance', v_take_bal,
    'sc_free',      COALESCE(v_free,0) - v_take_free,
    'sc_balance',   COALESCE(v_bal,0)  - v_take_bal
  );
END $$;

CREATE OR REPLACE FUNCTION public.pay_credit_solo_reward(
  p_session_id uuid,
  p_game_id    int,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg      bigint;
  v_new_bal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'credited', 0);
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  UPDATE user_balances
    SET sc_balance    = COALESCE(sc_balance,0)    + p_amount,
        total_won_usd = COALESCE(total_won_usd,0) + p_amount,
        updated_at    = now()
    WHERE telegram_id = v_tg
    RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'credit', 'payout',
    p_amount, p_amount, 'SKZ',
    v_new_bal,
    'solo_game', p_game_id::text,
    'Solo game reward: +' || p_amount || ' SKZ',
    jsonb_build_object('game_id', p_game_id)
  );

  RETURN json_build_object('ok', true, 'credited', p_amount, 'sc_balance', v_new_bal);
END $$;