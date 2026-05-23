/*
  # Multiplayer entry fees require paid balance (PvP / 4-player / Tournament)

  ## Summary
  Changes the behavior of `pay_debit_bet` so that 2-player, 4-player, and group
  (tournament) games no longer accept the free-trial credit (`sc_free`). Players
  on the free plan must hold real, paid SKZ in `sc_balance` to enter multiplayer
  matches. Solo games remain free during the trial via `pay_charge_solo_entry`.

  ## Changes
  1. `pay_debit_bet(bigint, numeric)` — debit ONLY from `sc_balance`. If the
     paid balance is below the bet, raise `insufficient_balance`. `sc_free`
     credit is reserved for solo trial play only.

  ## Security
  - Function remains SECURITY DEFINER with locked search_path. No new tables.
  - No RLS changes; existing match_rooms / tournament policies still apply.

  ## Notes
  1. Solo behavior is unchanged: `pay_charge_solo_entry` keeps the free-trial
     bypass and writes a `trial_play` ledger entry instead of a real debit.
  2. Reward credits (won prizes) still go to `sc_balance` as before.
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

  SELECT sc_balance INTO v_real
  FROM user_balances WHERE telegram_id = p_tg FOR UPDATE;

  IF COALESCE(v_real, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '53100';
  END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance - p_amount,
      updated_at = now()
  WHERE telegram_id = p_tg;
END;
$function$;
