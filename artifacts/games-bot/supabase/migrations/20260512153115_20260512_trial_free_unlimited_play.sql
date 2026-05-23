/*
  # Free trial: unlimited play across all modes (8 hours)

  ## Summary
  During the 8-hour free trial window, players can enter any game mode
  (Solo, 2-Player, 4-Player, Tournament) unlimited times without being
  charged SKZ. Once the trial expires OR the player has paid status,
  multiplayer modes require a real `sc_balance` (no use of `sc_free`).

  ## Changes
  1. `pay_debit_bet(bigint, numeric)` — if the player is still in their
     trial window (`trial_expires_at > now()` and `is_paid = false`),
     the bet debit is bypassed entirely (no balance change, no
     `insufficient_balance` error). Outside the trial, the function
     requires the bet amount in `sc_balance` (paid funds only) just as
     before — `sc_free` is no longer used for bets.

  ## Security
  - Function remains SECURITY DEFINER with locked search_path.
  - No new tables; no RLS changes.
*/

CREATE OR REPLACE FUNCTION public.pay_debit_bet(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_real          numeric;
  v_trial_exp     timestamptz;
  v_is_paid       boolean;
  v_trial_active  boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  SELECT sc_balance, trial_expires_at, is_paid
  INTO v_real, v_trial_exp, v_is_paid
  FROM user_balances WHERE telegram_id = p_tg FOR UPDATE;

  v_trial_active := (NOT COALESCE(v_is_paid, false)
                     AND v_trial_exp IS NOT NULL
                     AND v_trial_exp > now());

  -- Free trial: unlimited play, no debit.
  IF v_trial_active THEN
    RETURN;
  END IF;

  IF COALESCE(v_real, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '53100';
  END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance - p_amount,
      updated_at = now()
  WHERE telegram_id = p_tg;
END;
$function$;
