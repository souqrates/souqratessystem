/*
  # Rate Limiting, TON Address Validation & Withdrawal Controls

  ## Summary
  Adds robust rate limiting, server-side TON address validation,
  daily withdrawal count cap, and user-initiated withdrawal cancellation.

  ## Changes

  1. `pay_request_ton_withdrawal`
     - Validates TON address format via regex (UQ/EQ/0: prefix)
     - Raises cooloff from 60s to 5 minutes between requests
     - Caps at 3 withdrawal requests per 24 hours per user

  2. `pay_cancel_withdrawal` (NEW)
     - Allows user to cancel a pending withdrawal within 10 minutes of creation
     - Refunds sc_balance and sc_pending atomically
     - Writes ledger entry for the refund

  3. `pay_get_pending_withdrawals` (NEW)
     - Returns the user's pending/approved/processing withdrawal requests
     - Used by the Wallet UI to show status

  4. Economy settings
     - `withdraw_max_requests_per_day`: default 3
     - `withdraw_cooloff_seconds`: default 300 (5 min)
     - `withdraw_cancel_window_seconds`: default 600 (10 min)

  ## Security
  - All functions SECURITY DEFINER with pg_temp search path
  - FOR UPDATE locks prevent race conditions on balance tables
*/

-- ─── Economy setting defaults ─────────────────────────────────────────────────

INSERT INTO economy_settings (key, value, description)
VALUES
  ('withdraw_max_requests_per_day', '3',   'Max withdrawal requests per user per 24 hours'),
  ('withdraw_cooloff_seconds',      '300', 'Seconds between withdrawal requests (cooloff)'),
  ('withdraw_cancel_window_seconds','600', 'Seconds after request creation user can cancel')
ON CONFLICT (key) DO NOTHING;


-- ─── 1. Rewrite pay_request_ton_withdrawal with stronger controls ─────────────

CREATE OR REPLACE FUNCTION public.pay_request_ton_withdrawal(
  p_session_id uuid,
  p_amount_sc  numeric,
  p_ton_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_tg              bigint;
  v_min             numeric;
  v_daily_cap       numeric;
  v_max_requests    int;
  v_cooloff_secs    int;
  v_avail           numeric;
  v_fee_percent     numeric;
  v_fee_min         numeric;
  v_fee             numeric;
  v_total_sc        numeric;
  v_ton_rate        numeric;
  v_net_sc          numeric;
  v_ton_out         numeric;
  v_req_id          uuid;
  v_new_balance     numeric;
  v_today_sc        numeric;
  v_today_count     int;
  v_last_req        timestamptz;
  v_clean_address   text;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  PERFORM pay_ensure_balance_row(v_tg);

  IF p_amount_sc IS NULL OR p_amount_sc <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  -- Clean and validate TON address format
  v_clean_address := trim(p_ton_address);
  IF v_clean_address IS NULL OR length(v_clean_address) < 32 THEN
    RAISE EXCEPTION 'invalid_ton_address' USING ERRCODE = '22023';
  END IF;
  -- TON addresses: UQ.../EQ... (48 chars base64url) or raw 0: hex format
  IF v_clean_address !~ '^(UQ|EQ)[A-Za-z0-9_\-]{46}$'
     AND v_clean_address !~ '^0:[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'invalid_ton_address_format' USING ERRCODE = '22023';
  END IF;

  -- Cooling-off period (configurable, default 5 min)
  v_cooloff_secs := COALESCE(
    (SELECT value::int FROM economy_settings WHERE key = 'withdraw_cooloff_seconds'),
    300
  );

  SELECT MAX(created_at) INTO v_last_req
  FROM user_withdrawal_requests
  WHERE user_telegram_id = v_tg
    AND status NOT IN ('rejected', 'cancelled')
    AND created_at > now() - make_interval(secs => v_cooloff_secs);

  IF v_last_req IS NOT NULL THEN
    RAISE EXCEPTION 'withdrawal_cooloff_period' USING ERRCODE = '22023';
  END IF;

  -- Daily request count cap
  v_max_requests := COALESCE(
    (SELECT value::int FROM economy_settings WHERE key = 'withdraw_max_requests_per_day'),
    3
  );

  SELECT COUNT(*) INTO v_today_count
  FROM user_withdrawal_requests
  WHERE user_telegram_id = v_tg
    AND created_at > now() - interval '24 hours'
    AND status <> 'rejected';

  IF v_today_count >= v_max_requests THEN
    RAISE EXCEPTION 'daily_request_limit_exceeded' USING ERRCODE = '22023';
  END IF;

  -- Minimum withdrawal
  v_min := econ_num('withdraw_min_sc', 500);
  IF p_amount_sc < v_min THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = '22023';
  END IF;

  -- Daily SKZ cap
  v_daily_cap := econ_num('withdraw_max_sc_day', 50000);
  IF v_daily_cap > 0 THEN
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_today_sc
    FROM user_withdrawal_requests
    WHERE user_telegram_id = v_tg
      AND created_at > now() - interval '24 hours'
      AND status <> 'rejected';
    IF v_today_sc + p_amount_sc > v_daily_cap THEN
      RAISE EXCEPTION 'daily_cap_exceeded' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Fee calculation
  v_fee_percent := econ_num('withdraw_fee_percent', 2);
  v_fee_min     := econ_num('withdraw_fee_min_sc', 50);
  v_fee         := GREATEST(v_fee_min, p_amount_sc * v_fee_percent / 100.0);
  v_total_sc    := p_amount_sc;
  v_net_sc      := p_amount_sc - v_fee;

  IF v_net_sc <= 0 THEN
    RAISE EXCEPTION 'fee_exceeds_amount' USING ERRCODE = '22023';
  END IF;

  v_ton_rate := econ_num('ton_per_sc_withdraw', 0.0018);
  v_ton_out  := round((v_net_sc * v_ton_rate)::numeric, 9);

  -- Deduct from balance with lock
  SELECT sc_balance INTO v_avail
  FROM user_balances
  WHERE telegram_id = v_tg
  FOR UPDATE;

  IF COALESCE(v_avail, 0) < v_total_sc THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '53100';
  END IF;

  UPDATE user_balances
  SET sc_balance         = sc_balance - v_total_sc,
      sc_pending         = COALESCE(sc_pending, 0) + v_total_sc,
      total_redeemed_sc  = COALESCE(total_redeemed_sc, 0) + v_total_sc,
      updated_at         = now()
  WHERE telegram_id = v_tg
  RETURNING sc_balance INTO v_new_balance;

  -- Create withdrawal request
  INSERT INTO user_withdrawal_requests (
    user_telegram_id, token, amount, amount_usd, destination_address,
    fee_usd, method_code, network, destination_details, status
  ) VALUES (
    v_tg, 'TON', v_ton_out, p_amount_sc, v_clean_address,
    v_fee, 'ton_native', 'TON',
    jsonb_build_object(
      'address',    v_clean_address,
      'ton_amount', v_ton_out,
      'sc_amount',  p_amount_sc,
      'sc_fee',     v_fee,
      'sc_net',     v_net_sc
    ),
    'pending'
  ) RETURNING id INTO v_req_id;

  -- Ledger entry
  INSERT INTO ledger_entries (
    user_telegram_id, direction, category,
    amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id,
    description, metadata
  ) VALUES (
    v_tg, 'debit', 'withdrawal_hold',
    v_total_sc, v_ton_out, 'TON',
    v_new_balance, 'withdrawal_request', v_req_id::text,
    'TON withdraw hold: ' || p_amount_sc || ' SKZ → ' || v_ton_out || ' TON',
    jsonb_build_object('fee_sc', v_fee, 'address', v_clean_address)
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'request_id',     v_req_id,
    'amount_sc',      p_amount_sc,
    'fee_sc',         v_fee,
    'net_sc',         v_net_sc,
    'ton_out',        v_ton_out,
    'new_sc_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_request_ton_withdrawal(uuid, numeric, text) TO anon;
GRANT EXECUTE ON FUNCTION pay_request_ton_withdrawal(uuid, numeric, text) TO authenticated;


-- ─── 2. pay_cancel_withdrawal: user self-cancel within cancel window ──────────

CREATE OR REPLACE FUNCTION pay_cancel_withdrawal(
  p_session_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg           bigint;
  v_req          user_withdrawal_requests%ROWTYPE;
  v_cancel_secs  int;
  v_total_sc     numeric;
  v_new_balance  numeric;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  v_cancel_secs := COALESCE(
    (SELECT value::int FROM economy_settings WHERE key = 'withdraw_cancel_window_seconds'),
    600
  );

  SELECT * INTO v_req
  FROM user_withdrawal_requests
  WHERE id = p_request_id AND user_telegram_id = v_tg
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'request_not_cancellable' USING ERRCODE = '22023';
  END IF;

  IF now() > v_req.created_at + make_interval(secs => v_cancel_secs) THEN
    RAISE EXCEPTION 'cancel_window_expired' USING ERRCODE = '22023';
  END IF;

  v_total_sc := v_req.amount_usd + COALESCE(v_req.fee_usd, 0);

  -- Refund: move back from pending to available
  UPDATE user_balances
  SET sc_balance = sc_balance + v_total_sc,
      sc_pending = GREATEST(0, COALESCE(sc_pending, 0) - v_total_sc),
      total_redeemed_sc = GREATEST(0, COALESCE(total_redeemed_sc, 0) - v_total_sc),
      updated_at = now()
  WHERE telegram_id = v_tg
  RETURNING sc_balance INTO v_new_balance;

  UPDATE user_withdrawal_requests
  SET status       = 'cancelled',
      admin_note   = 'Cancelled by user',
      processed_at = now()
  WHERE id = p_request_id;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category,
    amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id,
    description
  ) VALUES (
    v_tg, 'credit', 'withdrawal_refund',
    v_total_sc, v_req.amount, 'TON',
    v_new_balance, 'withdrawal_request', p_request_id::text,
    'Withdrawal cancelled by user: +' || v_total_sc || ' SKZ refunded'
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'refunded_sc',    v_total_sc,
    'new_sc_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_cancel_withdrawal(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION pay_cancel_withdrawal(uuid, uuid) TO authenticated;


-- ─── 3. pay_get_pending_withdrawals: list user's active withdrawal requests ───

CREATE OR REPLACE FUNCTION pay_get_pending_withdrawals(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg    bigint;
  v_rows  jsonb;
  v_cancel_secs int;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  v_cancel_secs := COALESCE(
    (SELECT value::int FROM economy_settings WHERE key = 'withdraw_cancel_window_seconds'),
    600
  );

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             r.id,
      'status',         r.status,
      'amount_sc',      r.amount_usd,
      'fee_sc',         r.fee_usd,
      'ton_out',        r.amount,
      'address',        r.destination_address,
      'created_at',     r.created_at,
      'processed_at',   r.processed_at,
      'tx_hash',        r.tx_hash,
      'admin_note',     r.admin_note,
      'can_cancel',     (
        r.status = 'pending'
        AND now() < r.created_at + make_interval(secs => v_cancel_secs)
      )
    )
    ORDER BY r.created_at DESC
  )
  INTO v_rows
  FROM user_withdrawal_requests r
  WHERE r.user_telegram_id = v_tg
    AND r.status NOT IN ('cancelled', 'rejected')
  LIMIT 10;

  RETURN jsonb_build_object(
    'ok',      true,
    'requests', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_get_pending_withdrawals(uuid) TO anon;
GRANT EXECUTE ON FUNCTION pay_get_pending_withdrawals(uuid) TO authenticated;
