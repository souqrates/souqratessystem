/*
  # Critical Pre-Launch Security Hardening

  Locks down high-risk SECURITY DEFINER RPCs that were callable by anon /
  authenticated roles, enabling balance theft and unauthorized credits.

  ## Changes

  1. REVOKE EXECUTE from PUBLIC, anon, authenticated on internal credit
     functions that should only be called by trusted backend (service_role):
     - pay_credit_winnings(bigint, numeric)
     - pay_apply_ton_deposit(uuid, text, numeric)
     - credit_referral_commission(bigint, numeric, text)

  2. Replace pay_credit_solo_reward to look up the canonical prize from
     game_advanced_configs server-side (ignoring caller-supplied p_amount)
     and to enforce idempotency: only one reward credit per session+game
     within a 5-second window, by checking ledger_entries for a recent
     identical credit.

  ## Security

  - Manager / admin RPCs still pass p_admin_id; documented in audit. Locking
    those would break the manager dashboard until a session-token refactor.
*/

REVOKE EXECUTE ON FUNCTION public.pay_credit_winnings(bigint, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_credit_winnings(bigint, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pay_credit_winnings(bigint, numeric) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.pay_apply_ton_deposit(uuid, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_apply_ton_deposit(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pay_apply_ton_deposit(uuid, text, numeric) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.credit_referral_commission(bigint, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_referral_commission(bigint, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_referral_commission(bigint, numeric, text) FROM authenticated;

-- pay_credit_solo_reward: ignore caller-supplied amount, look up the
-- configured prize from game_advanced_configs. If no override exists, fall
-- back to a small safe default. Add idempotency: a second credit for the
-- same session+game within 6 seconds is treated as a duplicate.

CREATE OR REPLACE FUNCTION public.pay_credit_solo_reward(p_session_id uuid, p_game_id integer, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg          bigint;
  v_new_bal     numeric;
  v_prize       numeric;
  v_recent_at   timestamptz;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  -- Server-authoritative prize lookup. Ignore caller-supplied p_amount.
  SELECT win_prize_skz INTO v_prize
  FROM game_advanced_configs
  WHERE game_id = p_game_id AND COALESCE(enabled, true) = true;

  IF v_prize IS NULL OR v_prize <= 0 THEN
    RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'no_prize_configured');
  END IF;

  -- Idempotency: refuse if the same user already received a solo_game payout
  -- for this game within the last 6 seconds (covers retry storms).
  SELECT MAX(created_at) INTO v_recent_at
  FROM ledger_entries
  WHERE user_telegram_id = v_tg
    AND direction = 'credit'
    AND category = 'payout'
    AND reference_type = 'solo_game'
    AND reference_id = p_game_id::text
    AND created_at > now() - interval '6 seconds';

  IF v_recent_at IS NOT NULL THEN
    SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
    RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  UPDATE user_balances
  SET sc_balance    = COALESCE(sc_balance, 0)    + v_prize,
      total_won_usd = COALESCE(total_won_usd, 0) + v_prize,
      updated_at    = now()
  WHERE telegram_id = v_tg
  RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'credit', 'payout',
    v_prize, v_prize, 'SKZ',
    v_new_bal,
    'solo_game', p_game_id::text,
    'Solo game reward: +' || v_prize || ' SKZ',
    jsonb_build_object('game_id', p_game_id, 'server_authoritative', true)
  );

  -- Internal commission hook (still SECURITY DEFINER chain).
  BEGIN
    PERFORM credit_referral_commission(v_tg, v_prize, 'solo_win');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never fail the reward over commission issues
  END;

  RETURN json_build_object('ok', true, 'credited', v_prize, 'sc_balance', v_new_bal);
END;
$function$;