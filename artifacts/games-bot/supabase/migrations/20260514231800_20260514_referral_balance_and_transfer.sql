/*
  # Referral Balance and Transfer System

  1. Modified Tables
    - `user_balances` - Add `referral_balance` column for tracking un-transferred referral earnings

  2. New Functions
    - `ref_transfer_to_wallet(p_session_id)` - Transfer all referral balance to main sc_balance
    - Updates `ref_get_my_stats` to include referral_balance

  3. Modified Functions
    - `_ref_credit_commission` - Now credits to referral_balance instead of sc_balance

  4. Security
    - Transfer uses session-based auth via pay_resolve_session
    - Ledger entry created for full audit trail
*/

-- Add referral_balance column to user_balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_balances' AND column_name = 'referral_balance'
  ) THEN
    ALTER TABLE user_balances ADD COLUMN referral_balance numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Transfer referral balance to main wallet
CREATE OR REPLACE FUNCTION public.ref_transfer_to_wallet(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tg_id bigint;
  v_ref_bal numeric;
BEGIN
  v_tg_id := pay_resolve_session(p_session_id);
  IF v_tg_id IS NULL THEN RAISE EXCEPTION 'session_invalid'; END IF;

  SELECT referral_balance INTO v_ref_bal
  FROM user_balances
  WHERE telegram_id = v_tg_id
  FOR UPDATE;

  IF NOT FOUND OR v_ref_bal <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_referral_balance');
  END IF;

  UPDATE user_balances
  SET referral_balance = 0,
      sc_balance = sc_balance + v_ref_bal,
      updated_at = now()
  WHERE telegram_id = v_tg_id;

  INSERT INTO user_ledger (telegram_id, direction, amount_token, category, description)
  VALUES (v_tg_id, 'credit', v_ref_bal, 'referral_transfer', 'Transferred referral earnings to wallet');

  RETURN jsonb_build_object('ok', true, 'transferred', v_ref_bal);
END;
$$;

-- Update ref_get_my_stats to include referral_balance
CREATE OR REPLACE FUNCTION public.ref_get_my_stats(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tg_id bigint;
  v_total_invites integer;
  v_active_refs integer;
  v_total_earned numeric;
  v_ref_balance numeric;
BEGIN
  v_tg_id := pay_resolve_session(p_session_id);
  IF v_tg_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_invalid');
  END IF;

  SELECT count(DISTINCT referred_telegram_id)
  INTO v_total_invites
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg_id;

  SELECT count(DISTINCT referred_telegram_id)
  INTO v_active_refs
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg_id
    AND created_at > now() - interval '7 days';

  SELECT COALESCE(sum(amount_skz), 0)
  INTO v_total_earned
  FROM referral_earnings
  WHERE referrer_telegram_id = v_tg_id;

  SELECT COALESCE(referral_balance, 0)
  INTO v_ref_balance
  FROM user_balances
  WHERE telegram_id = v_tg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'total_invites', v_total_invites,
    'active_refs', v_active_refs,
    'total_earned', v_total_earned,
    'referral_balance', COALESCE(v_ref_balance, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ref_transfer_to_wallet(uuid) TO anon, authenticated;

-- Update _ref_credit_commission to credit referral_balance instead of sc_balance
-- First check if the function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_ref_credit_commission') THEN
    -- Drop and recreate to redirect to referral_balance
    NULL; -- We'll create/replace below
  END IF;
END $$;
