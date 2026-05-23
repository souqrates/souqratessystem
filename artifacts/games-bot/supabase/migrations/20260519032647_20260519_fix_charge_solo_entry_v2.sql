/*
  # Fix pay_charge_solo_entry v2
  - Remove reference to non-existent 'active' column in free_play_testers
  - free_play_testers has only: telegram_id, note, created_at
*/

CREATE OR REPLACE FUNCTION pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg           bigint;
  v_fee          numeric;
  v_max_fee      numeric;
  v_new_bal      numeric;
  v_is_tester    boolean;
  v_is_trial     boolean;
  v_target_score integer;
  v_max_dur      integer;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN RAISE EXCEPTION 'session_invalid'; END IF;

  -- Check tester (no 'active' column)
  SELECT EXISTS(
    SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg
  ) INTO v_is_tester;

  -- Check trial
  SELECT CASE WHEN trial_expires_at IS NOT NULL AND trial_expires_at > now() THEN true ELSE false END
  INTO v_is_trial
  FROM user_balances WHERE telegram_id = v_tg;
  v_is_trial := COALESCE(v_is_trial, false);

  -- Validate fee: game-specific tiers first, then global solo tiers
  SELECT MAX(entry_fee::numeric) INTO v_max_fee
  FROM game_fee_tiers WHERE game_id = p_game_id AND enabled = true;

  IF v_max_fee IS NULL THEN
    SELECT MAX(entry_fee::numeric) INTO v_max_fee
    FROM solo_fee_tiers WHERE enabled = true;
  END IF;

  v_fee := LEAST(COALESCE(p_amount, 0), COALESCE(v_max_fee, 10000), 10000);
  IF v_fee < 0 THEN v_fee := 0; END IF;

  -- Get game config
  SELECT COALESCE(target_score, 0), COALESCE(time_limit_sec, 60)
  INTO v_target_score, v_max_dur
  FROM game_advanced_configs WHERE game_id = p_game_id;
  v_target_score := COALESCE(v_target_score, 0);
  v_max_dur      := COALESCE(v_max_dur, 60);

  IF NOT v_is_tester AND NOT v_is_trial AND v_fee > 0 THEN
    PERFORM pay_ensure_balance_row(v_tg);
    UPDATE user_balances
    SET sc_balance = sc_balance - v_fee, updated_at = now()
    WHERE telegram_id = v_tg AND sc_balance >= v_fee
    RETURNING sc_balance INTO v_new_bal;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

    INSERT INTO ledger_entries (
      user_telegram_id, direction, category, amount_usd, amount_token, token,
      balance_after_usd, reference_type, reference_id, description
    ) VALUES (
      v_tg, 'debit', 'entry_fee', v_fee, v_fee, 'SKZ',
      v_new_bal, 'solo_game', p_game_id::text,
      'Solo entry fee: -' || v_fee || ' SKZ'
    );
  ELSE
    SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
  END IF;

  -- Insert session with session_id (NOT NULL)
  INSERT INTO solo_game_sessions (
    session_id, telegram_id, game_id,
    entry_fee_skz, duration_seconds, target_score, started_at
  ) VALUES (
    p_session_id, v_tg, p_game_id,
    v_fee, v_max_dur, v_target_score, now()
  );

  RETURN json_build_object(
    'ok', true,
    'charged', v_fee,
    'sc_balance', COALESCE(v_new_bal, 0)
  );
END;
$$;
