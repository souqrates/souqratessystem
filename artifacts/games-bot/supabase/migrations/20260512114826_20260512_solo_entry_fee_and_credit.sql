/*
  # Solo Game Entry Fee + Free-Credit-First Spending

  1. Functions
    - `pay_charge_solo_entry(p_tg bigint, p_game_id int, p_amount numeric)`
      Charges a solo game's entry fee. Spends `sc_free` first then `sc_balance`.
      Returns the new balances. Raises `insufficient_balance` if the user
      cannot afford the fee.

    - `pay_credit_solo_reward(p_tg bigint, p_game_id int, p_amount numeric)`
      Credits a solo game's reward to `sc_balance` (withdrawable). Used when
      the player wins a solo round, optionally scaled by score.

  2. Safety
    - Both functions are SECURITY DEFINER, validate inputs (positive amount,
      non-null caller).
    - All movement is atomic; if the debit fails the row is unchanged.
    - sc_free is consumed first so the 100 free SKZ starter is fully usable.

  3. Notes
    - These are *separate* from `pay_debit_bet` / `pay_credit_winnings` which
      remain used by PvP / tournament rooms (those flows are server-validated
      via match RPCs).
    - Solo wins still get gamification XP via the existing client hook.
*/

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(
  p_tg       bigint,
  p_game_id  int,
  p_amount   numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_free  numeric;
  v_bal   numeric;
  v_take_free numeric;
  v_take_bal  numeric;
BEGIN
  IF p_tg IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  SELECT sc_free, sc_balance INTO v_free, v_bal
    FROM user_balances WHERE telegram_id = p_tg FOR UPDATE;

  IF COALESCE(v_free,0) + COALESCE(v_bal,0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  v_take_free := LEAST(COALESCE(v_free,0), p_amount);
  v_take_bal  := p_amount - v_take_free;

  UPDATE user_balances
    SET sc_free    = COALESCE(sc_free,0)    - v_take_free,
        sc_balance = COALESCE(sc_balance,0) - v_take_bal,
        updated_at = now()
    WHERE telegram_id = p_tg;

  RETURN json_build_object(
    'charged',       p_amount,
    'from_free',     v_take_free,
    'from_balance',  v_take_bal,
    'sc_free',       COALESCE(v_free,0) - v_take_free,
    'sc_balance',    COALESCE(v_bal,0)  - v_take_bal
  );
END $$;

GRANT EXECUTE ON FUNCTION public.pay_charge_solo_entry(bigint, int, numeric)
  TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.pay_credit_solo_reward(
  p_tg       bigint,
  p_game_id  int,
  p_amount   numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_bal  numeric;
BEGIN
  IF p_tg IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('credited', 0);
  END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  UPDATE user_balances
    SET sc_balance    = COALESCE(sc_balance,0)    + p_amount,
        total_won_usd = COALESCE(total_won_usd,0) + p_amount,
        updated_at    = now()
    WHERE telegram_id = p_tg
    RETURNING sc_balance INTO v_new_bal;

  RETURN json_build_object('credited', p_amount, 'sc_balance', v_new_bal);
END $$;

GRANT EXECUTE ON FUNCTION public.pay_credit_solo_reward(bigint, int, numeric)
  TO authenticated, anon;