/*
  # Fix pay_credit_winnings hall_of_fame FK crash

  ## Problem
  pay_credit_winnings inserts into hall_of_fame with user_id from public.users,
  but hall_of_fame.user_id has a FK to auth.users(id). Telegram Mini App users
  created via guest sessions have public.users rows but NO auth.users rows.
  This FK violation crashes the entire transaction, preventing the financial
  credit from committing. This caused 14+ matches to fail crediting winnings.

  ## Fix
  1. Wrap hall_of_fame insert in a BEGIN/EXCEPTION block so FK failures
     don't prevent the financial credit
  2. Wrap referral commission in same pattern
  3. Re-run cleanup to credit the 14 failed payouts
*/

CREATE OR REPLACE FUNCTION pay_credit_winnings(
  p_tg     bigint,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  -- Hall of fame (non-blocking: FK to auth.users may fail for guest users)
  BEGIN
    SELECT id, COALESCE(username, COALESCE(first_name, 'Player'))
    INTO v_uid, v_username
    FROM users WHERE telegram_id = p_tg LIMIT 1;

    IF v_uid IS NOT NULL THEN
      INSERT INTO hall_of_fame (user_id, username, game_id, score, earnings_usd)
      VALUES (v_uid, v_username, 0, 0, p_amount);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Referral commission (non-blocking)
  BEGIN
    PERFORM credit_referral_commission(p_tg, p_amount, 'match_win');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$fn$;

-- Revoke from anon (should only be called internally)
REVOKE EXECUTE ON FUNCTION pay_credit_winnings FROM anon;

-- =====================================================================
-- Re-run cleanup to credit the previously failed payouts
-- =====================================================================

SELECT match_cleanup_stale();
