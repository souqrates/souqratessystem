/*
  # Redirect Referral Commission to referral_balance

  1. Modified Functions
    - `credit_referral_commission` - Now credits `referral_balance` instead of `sc_balance`
      so referral earnings stay in a separate pool until the user explicitly transfers them.

  2. Important Notes
    - Existing referral earnings already in sc_balance are NOT moved retroactively
    - Future commissions will accumulate in referral_balance
    - Users transfer via ref_transfer_to_wallet RPC
*/

CREATE OR REPLACE FUNCTION public.credit_referral_commission(
  p_referred_telegram_id bigint,
  p_amount_won_skz numeric,
  p_source text DEFAULT 'win_commission'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer bigint; v_program_id uuid; v_code text; v_pct numeric; v_amt numeric;
BEGIN
  IF p_amount_won_skz IS NULL OR p_amount_won_skz <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_amount');
  END IF;

  SELECT c.referrer_telegram_id, c.program_id, c.code, COALESCE(p.commission_pct, 0)
  INTO v_referrer, v_program_id, v_code, v_pct
  FROM referral_codes c
  LEFT JOIN referral_programs p ON p.id = c.program_id
  WHERE c.referrer_telegram_id <> p_referred_telegram_id
    AND c.is_active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND EXISTS (
      SELECT 1 FROM referrals r
      JOIN users u_ref ON u_ref.telegram_id = c.referrer_telegram_id
      JOIN users u_inv ON u_inv.telegram_id = p_referred_telegram_id
      WHERE r.referrer_id = u_ref.id AND r.referred_id = u_inv.id
    )
  ORDER BY c.created_at DESC LIMIT 1;

  IF v_referrer IS NULL OR v_pct IS NULL OR v_pct <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_referrer');
  END IF;

  v_amt := ROUND(p_amount_won_skz * v_pct / 100.0, 2);
  IF v_amt <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_small');
  END IF;

  INSERT INTO user_balances (telegram_id, sc_balance, referral_balance)
  VALUES (v_referrer, 0, 0)
  ON CONFLICT (telegram_id) DO NOTHING;

  UPDATE user_balances
  SET referral_balance = COALESCE(referral_balance, 0) + v_amt,
      updated_at = now()
  WHERE telegram_id = v_referrer;

  INSERT INTO referral_earnings (
    referrer_telegram_id, referred_telegram_id, program_id, code,
    source, amount_skz, base_amount_skz, pct_applied
  ) VALUES (
    v_referrer, p_referred_telegram_id, v_program_id, COALESCE(v_code, ''),
    p_source, v_amt, p_amount_won_skz, v_pct
  );

  RETURN jsonb_build_object('ok', true, 'referrer', v_referrer, 'amount', v_amt, 'pct', v_pct);
END;
$$;
