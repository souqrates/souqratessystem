/*
  # Referral commission hook

  Wires `credit_referral_commission` into the existing payout functions so that
  whenever a player wins SKZ (solo or multiplayer), the referrer of that player
  automatically receives the configured commission percentage to their balance.

  No new tables; just function body amendments.
*/

CREATE OR REPLACE FUNCTION public.pay_credit_winnings(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid      uuid;
  v_username text;
BEGIN
  IF p_tg IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  PERFORM pay_ensure_balance_row(p_tg);
  UPDATE user_balances
    SET sc_balance    = sc_balance + p_amount,
        total_won_usd = COALESCE(total_won_usd, 0) + p_amount,
        updated_at    = now()
    WHERE telegram_id = p_tg;

  SELECT id, COALESCE(username, COALESCE(first_name,'Player'))
    INTO v_uid, v_username
    FROM users WHERE telegram_id = p_tg LIMIT 1;

  IF v_uid IS NOT NULL THEN
    INSERT INTO hall_of_fame (user_id, username, game_id, score, earnings_usd)
      VALUES (v_uid, v_username, 0, 0, p_amount);
  END IF;

  PERFORM credit_referral_commission(p_tg, p_amount, 'match_win');
END $function$;

CREATE OR REPLACE FUNCTION public.pay_credit_solo_reward(p_session_id uuid, p_game_id integer, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  PERFORM credit_referral_commission(v_tg, p_amount, 'solo_win');

  RETURN json_build_object('ok', true, 'credited', p_amount, 'sc_balance', v_new_bal);
END $function$;
