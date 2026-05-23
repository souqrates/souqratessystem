/*
  # Fix free_play_testers branch — use valid ledger category

  ## Summary
  The previous migration introduced `pay_charge_solo_entry` branches that
  wrote ledger rows with category `trial_play` and `bet`, neither of which
  are permitted by the `ledger_entries_category_check` constraint
  (allowed: deposit, withdrawal, withdrawal_hold, withdrawal_refund,
  stake, payout, rake, referral_bonus, bonus, adjustment). Every solo
  entry charge was therefore aborting with a constraint violation, so no
  game could open.

  This migration restores the previously-working two-pool charge logic
  (`sc_free` first, then `sc_balance`) and adds two new bypass branches
  using valid categories:

  1. `free_play_testers` whitelist — zero-charge, ledger row category
     `bonus` (description tagged "Free-play tester").
  2. Active free trial — zero-charge, ledger row category `bonus`
     (description tagged "Free trial").

  ## Security
  - SECURITY DEFINER with locked search_path
  - Tester bypass only applies to the caller's own resolved telegram_id
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
  v_tg            bigint;
  v_free          numeric;
  v_bal           numeric;
  v_trial_exp     timestamptz;
  v_is_paid       boolean;
  v_is_tester     boolean;
  v_trial_active  boolean;
  v_take_free     numeric;
  v_take_bal      numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  SELECT EXISTS(SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg) INTO v_is_tester;

  SELECT sc_free, sc_balance, trial_expires_at, is_paid
    INTO v_free, v_bal, v_trial_exp, v_is_paid
    FROM user_balances WHERE telegram_id = v_tg FOR UPDATE;

  v_trial_active := (NOT COALESCE(v_is_paid, false)
                     AND v_trial_exp IS NOT NULL
                     AND v_trial_exp > now());

  -- Free-play tester: zero-charge bypass
  IF v_is_tester THEN
    INSERT INTO ledger_entries (
      user_telegram_id, direction, category, amount_usd, amount_token, token,
      balance_after_usd, reference_type, reference_id, description, metadata
    ) VALUES (
      v_tg, 'debit', 'bonus',
      0, 0, 'SKZ',
      COALESCE(v_bal,0),
      'solo_game', p_game_id::text,
      'Free-play tester (no charge)',
      jsonb_build_object('game_id', p_game_id, 'free_play_tester', true)
    );
    RETURN json_build_object(
      'ok',         true,
      'charged',    0,
      'trial',      true,
      'free_play',  true,
      'sc_free',    COALESCE(v_free,0),
      'sc_balance', COALESCE(v_bal,0)
    );
  END IF;

  -- Active trial: zero-charge bypass
  IF v_trial_active THEN
    INSERT INTO ledger_entries (
      user_telegram_id, direction, category, amount_usd, amount_token, token,
      balance_after_usd, reference_type, reference_id, description, metadata
    ) VALUES (
      v_tg, 'debit', 'bonus',
      0, 0, 'SKZ',
      COALESCE(v_bal,0),
      'solo_game', p_game_id::text,
      'Free trial play (no charge)',
      jsonb_build_object('game_id', p_game_id, 'trial_expires_at', v_trial_exp)
    );
    RETURN json_build_object(
      'ok',                true,
      'charged',           0,
      'trial',             true,
      'sc_free',           COALESCE(v_free,0),
      'sc_balance',        COALESCE(v_bal,0),
      'trial_expires_at',  v_trial_exp
    );
  END IF;

  -- Normal charge path: spend sc_free first then sc_balance
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
    'trial',        false,
    'from_free',    v_take_free,
    'from_balance', v_take_bal,
    'sc_free',      COALESCE(v_free,0) - v_take_free,
    'sc_balance',   COALESCE(v_bal,0)  - v_take_bal
  );
END $$;
