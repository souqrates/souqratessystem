/*
  # Fix ledger_entries CHECK constraint to include all used categories

  1. Problem
    - Several functions insert ledger entries with categories not in the CHECK constraint:
      - 'winnings' (already fixed to 'payout' in pay_credit_winnings)
      - 'solo_reward' (used by pay_credit_solo_reward and its dedup query)
      - 'trial_play' (used by free trial/tester flows)
    - These cause constraint violations that silently break payouts

  2. Fix
    - Replace the CHECK constraint to include all categories actually used in production
    - Fix pay_credit_solo_reward to use 'payout' category for consistency
    - Update the dedup query in pay_credit_solo_reward to check 'payout' instead of 'solo_reward'

  3. Safety
    - Existing ledger data is untouched
    - The constraint is relaxed (adds values), never tightened
*/

-- Widen the CHECK constraint to include all categories in use
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_category_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_category_check CHECK (
  category IN (
    'deposit', 'withdrawal', 'withdrawal_hold', 'withdrawal_refund',
    'stake', 'payout', 'rake', 'referral_bonus', 'bonus', 'adjustment',
    'solo_reward', 'trial_play', 'winnings'
  )
);

-- Fix pay_credit_solo_reward: use 'payout' category and fix dedup
CREATE OR REPLACE FUNCTION public.pay_credit_solo_reward(
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
  v_sess record;
  v_cfg record;
  v_prize numeric;
  v_new_bal numeric;
  v_is_paid boolean;
  v_trial_exp timestamptz;
  v_trial_active boolean;
  v_is_tester boolean;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  PERFORM pay_ensure_balance_row(v_tg);

  SELECT is_paid, trial_expires_at INTO v_is_paid, v_trial_exp
  FROM user_balances WHERE telegram_id = v_tg;
  v_trial_active := (COALESCE(v_is_paid, false) = false)
    AND v_trial_exp IS NOT NULL AND v_trial_exp > now();
  SELECT EXISTS (SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg) INTO v_is_tester;
  IF v_trial_active OR v_is_tester THEN
    RETURN json_build_object('ok', true, 'credited', 0, 'trial', true);
  END IF;

  SELECT win_prize_skz INTO v_cfg FROM game_advanced_configs
  WHERE game_id = p_game_id AND enabled = true;
  v_prize := COALESCE(v_cfg.win_prize_skz, 0);
  IF v_prize <= 0 THEN RETURN json_build_object('ok', true, 'credited', 0); END IF;

  SELECT * INTO v_sess FROM solo_game_sessions
  WHERE telegram_id = v_tg AND game_id = p_game_id
  ORDER BY started_at DESC LIMIT 1;

  IF v_sess IS NOT NULL THEN
    IF v_sess.rewarded_at IS NOT NULL THEN
      RETURN json_build_object('ok', true, 'credited', 0, 'reason', 'already_rewarded');
    END IF;
    IF v_sess.started_at < now() - interval '5 minutes' THEN
      RETURN json_build_object('ok', true, 'credited', 0, 'reason', 'session_too_old');
    END IF;
    UPDATE solo_game_sessions SET rewarded_at = now() WHERE id = v_sess.id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM ledger_entries
      WHERE user_telegram_id = v_tg
        AND category IN ('payout', 'solo_reward')
        AND reference_type = 'solo_win'
        AND created_at > now() - interval '10 seconds'
    ) THEN
      RETURN json_build_object('ok', true, 'credited', 0, 'reason', 'dedup');
    END IF;
  END IF;

  UPDATE user_balances
  SET sc_balance = COALESCE(sc_balance, 0) + v_prize,
      total_won_usd = COALESCE(total_won_usd, 0) + v_prize,
      updated_at = now()
  WHERE telegram_id = v_tg RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, description, metadata
  ) VALUES (
    v_tg, 'credit', 'payout', v_prize, v_prize, 'SKZ',
    COALESCE(v_new_bal, 0), 'solo_win',
    'Solo game win: +' || v_prize || ' SKZ',
    json_build_object('game_id', p_game_id, 'prize', v_prize)
  );

  PERFORM admin_wallet_debit_prize(v_tg, v_prize, 'solo_' || p_game_id);
  RETURN json_build_object('ok', true, 'credited', v_prize, 'balance', v_new_bal);
END;
$function$;
