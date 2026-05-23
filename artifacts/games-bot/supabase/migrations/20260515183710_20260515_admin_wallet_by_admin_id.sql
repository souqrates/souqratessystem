/*
  # Admin Wallet RPCs by admin_id

  Adds alternative admin wallet functions that accept p_admin_id (telegram_id)
  instead of p_session_id, matching the manager dashboard's auth pattern.
  
  1. New Functions
    - `admin_wallet_deposit_by_admin(p_admin_id, p_amount)` — admin deposits via telegram_id
    - `admin_wallet_get_balance_by_admin(p_admin_id)` — get balance via telegram_id
    - `admin_wallet_get_transactions_by_admin(p_admin_id, p_limit, p_offset)` — txn history
    - `admin_wallet_withdraw_by_admin(p_admin_id, p_amount)` — admin withdraws from wallet
*/

CREATE OR REPLACE FUNCTION admin_wallet_deposit_by_admin(p_admin_id bigint, p_amount numeric)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_new_bal numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  UPDATE admin_wallet SET balance = balance + p_amount, updated_at = now()
  WHERE id = 1 RETURNING balance INTO v_new_bal;

  INSERT INTO admin_wallet_transactions (direction, amount, category, user_telegram_id, description, balance_after)
  VALUES ('credit', p_amount, 'manual_deposit', p_admin_id,
          'Manual deposit by admin: +' || p_amount || ' SKZ', COALESCE(v_new_bal, 0));

  RETURN json_build_object('ok', true, 'balance', v_new_bal);
END; $$;

GRANT EXECUTE ON FUNCTION admin_wallet_deposit_by_admin(bigint, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_wallet_withdraw_by_admin(p_admin_id bigint, p_amount numeric)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_bal numeric; v_new_bal numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT balance INTO v_bal FROM admin_wallet WHERE id = 1 FOR UPDATE;
  IF COALESCE(v_bal, 0) < p_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE admin_wallet SET balance = balance - p_amount, updated_at = now()
  WHERE id = 1 RETURNING balance INTO v_new_bal;

  INSERT INTO admin_wallet_transactions (direction, amount, category, user_telegram_id, description, balance_after)
  VALUES ('debit', p_amount, 'manual_withdrawal', p_admin_id,
          'Manual withdrawal by admin: -' || p_amount || ' SKZ', COALESCE(v_new_bal, 0));

  RETURN json_build_object('ok', true, 'balance', v_new_bal);
END; $$;

GRANT EXECUTE ON FUNCTION admin_wallet_withdraw_by_admin(bigint, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_wallet_get_balance_by_admin(p_admin_id bigint)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_bal numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT balance INTO v_bal FROM admin_wallet WHERE id = 1;
  RETURN json_build_object('ok', true, 'balance', COALESCE(v_bal, 0));
END; $$;

GRANT EXECUTE ON FUNCTION admin_wallet_get_balance_by_admin(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_wallet_get_transactions_by_admin(
  p_admin_id bigint, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_rows json; v_total bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT count(*) INTO v_total FROM admin_wallet_transactions;
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT id, direction, amount, category, user_telegram_id, reference_id, description, balance_after, created_at
    FROM admin_wallet_transactions ORDER BY created_at DESC
    LIMIT LEAST(p_limit, 200) OFFSET p_offset
  ) t;
  RETURN json_build_object('ok', true, 'transactions', v_rows, 'total', v_total);
END; $$;

GRANT EXECUTE ON FUNCTION admin_wallet_get_transactions_by_admin(bigint, integer, integer) TO anon, authenticated;
