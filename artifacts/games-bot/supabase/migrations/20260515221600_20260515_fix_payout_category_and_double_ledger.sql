/*
  # Fix payout system: category constraint violation and double ledger entries

  1. Root Cause
    - `pay_credit_winnings` inserts ledger_entries with category='winnings'
    - But the CHECK constraint only allows: deposit, withdrawal, withdrawal_hold,
      withdrawal_refund, stake, payout, rake, referral_bonus, bonus, adjustment
    - 'winnings' is NOT in the list, so EVERY payout fails
    - `match_credit_winner_if_due` also inserts its own ledger entry with category='payout'
    - This means if both succeeded, there'd be duplicate ledger rows per payout

  2. Fix: pay_credit_winnings
    - Change category from 'winnings' to 'payout' (which is in the CHECK constraint)
    - Change reference_type from 'match_win' to 'match_room' for consistency

  3. Fix: match_credit_winner_if_due
    - Remove the duplicate ledger INSERT since pay_credit_winnings already writes one
    - Keep the balance-after query and the winnings_credited_at marker

  4. Impact
    - All stuck payouts (failed_payouts table) will succeed on next cron retry
    - Future payouts will work immediately
    - No data loss; existing ledger entries are untouched
*/

-- Fix pay_credit_winnings: use 'payout' instead of 'winnings'
CREATE OR REPLACE FUNCTION public.pay_credit_winnings(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_paid boolean;
  v_trial_exp timestamptz;
  v_trial_active boolean;
  v_is_tester boolean;
  v_new_bal numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  PERFORM pay_ensure_balance_row(p_tg);

  SELECT is_paid, trial_expires_at INTO v_is_paid, v_trial_exp
  FROM user_balances WHERE telegram_id = p_tg;
  v_trial_active := (COALESCE(v_is_paid, false) = false)
    AND v_trial_exp IS NOT NULL AND v_trial_exp > now();
  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = p_tg) INTO v_is_tester;

  IF v_trial_active OR v_is_tester THEN RETURN; END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance + p_amount,
      total_won_usd = COALESCE(total_won_usd, 0) + p_amount,
      updated_at = now()
  WHERE telegram_id = p_tg
  RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, description, metadata
  ) VALUES (
    p_tg, 'credit', 'payout', p_amount, p_amount, 'SKZ',
    COALESCE(v_new_bal, 0), 'match_room',
    'Match winnings: +' || p_amount || ' SKZ',
    json_build_object('amount', p_amount)
  );

  PERFORM admin_wallet_debit_prize(p_tg, p_amount);
END;
$function$;


-- Fix match_credit_winner_if_due: remove duplicate ledger insert
CREATE OR REPLACE FUNCTION public.match_credit_winner_if_due(p_room_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_room       match_rooms%ROWTYPE;
  v_winner     bigint;
  v_filled     int;
  v_pot        numeric;
  v_cut        numeric;
  v_net_pot    numeric;
  v_winner_bot boolean := false;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_room.status <> 'finished' OR v_room.winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finished');
  END IF;
  IF v_room.winnings_credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF COALESCE(v_room.bet_amount, 0) <= 0 THEN
    UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'no_bet', true);
  END IF;

  v_winner := v_room.winner_id;

  IF (v_room.player1_id = v_winner AND COALESCE(v_room.player1_is_bot, false))
  OR (v_room.player2_id = v_winner AND COALESCE(v_room.player2_is_bot, false))
  OR (v_room.player3_id = v_winner AND COALESCE(v_room.player3_is_bot, false))
  OR (v_room.player4_id = v_winner AND COALESCE(v_room.player4_is_bot, false)) THEN
    v_winner_bot := true;
  END IF;

  v_filled := (CASE WHEN v_room.player1_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN v_room.player2_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN v_room.player3_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN v_room.player4_id IS NOT NULL THEN 1 ELSE 0 END);
  v_pot     := v_room.bet_amount * v_filled;
  v_cut     := ROUND(v_pot * COALESCE(v_room.house_cut_percent, 0) / 100.0, 2);
  v_net_pot := GREATEST(0, v_pot - v_cut);

  IF v_net_pot > 500000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pot_exceeds_limit', 'pot', v_net_pot);
  END IF;

  IF v_winner_bot THEN
    UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'bot_winner', true, 'pot', v_pot, 'house_cut', v_cut);
  END IF;

  -- pay_credit_winnings handles: balance update + ledger entry + admin wallet debit
  PERFORM pay_credit_winnings(v_winner, v_net_pot);

  UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;

  RETURN jsonb_build_object('ok', true, 'credited', v_net_pot, 'gross', v_pot, 'house_cut', v_cut, 'winner', v_winner);
END;
$function$;
