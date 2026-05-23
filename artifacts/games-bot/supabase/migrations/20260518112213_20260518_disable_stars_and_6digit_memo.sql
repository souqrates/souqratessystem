/*
  # TON Deposit System — Disable Stars + 6-digit Memo

  1. Disables Telegram Stars payments
  2. Rewrites pay_buy_with_ton to generate a unique 6-digit numeric memo
     (easier for users to type into Binance/@wallet comment field)
*/

-- Disable Telegram Stars
UPDATE economy_settings SET value = 'false' WHERE key = 'stars_enabled';

-- Rewrite pay_buy_with_ton to use 6-digit numeric memo
CREATE OR REPLACE FUNCTION public.pay_buy_with_ton(
  p_session_id uuid,
  p_amount_ton numeric,
  p_source     text DEFAULT 'wallet'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_tg           bigint;
  v_min_ton      numeric;
  v_max_ton      numeric;
  v_sc_rate      numeric;
  v_sc_amt       numeric;
  v_address      text;
  v_memo         text;
  v_intent_id    uuid;
  v_active_count int;
  v_attempts     int := 0;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  v_min_ton := COALESCE(
    (SELECT value::numeric FROM economy_settings WHERE key = 'ton_deposit_min'), 0.1);
  v_max_ton := COALESCE(
    (SELECT value::numeric FROM economy_settings WHERE key = 'ton_deposit_max'), 10000);

  IF p_amount_ton < v_min_ton THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = '22023';
  END IF;
  IF p_amount_ton > v_max_ton THEN
    RAISE EXCEPTION 'above_maximum' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM ton_deposit_intents
  WHERE user_telegram_id = v_tg
    AND status = 'awaiting'
    AND expires_at > now();

  IF v_active_count >= 5 THEN
    RAISE EXCEPTION 'too_many_active_intents' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(value, '') INTO v_address
  FROM economy_settings WHERE key = 'ton_deposit_address';

  IF v_address = '' OR v_address IS NULL THEN
    RAISE EXCEPTION 'deposit_not_configured' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(value::numeric, 500) INTO v_sc_rate
  FROM economy_settings WHERE key = 'sc_per_ton';

  v_sc_amt := ROUND(p_amount_ton * v_sc_rate, 2);

  -- Generate unique 6-digit numeric memo (100000–999999), retry up to 10 times on collision
  LOOP
    v_memo := LPAD((100000 + (random() * 899999)::int)::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM ton_deposit_intents
      WHERE memo = v_memo AND status = 'awaiting' AND expires_at > now()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts >= 10 THEN
      v_memo := LPAD((10000000 + (random() * 89999999)::int)::text, 8, '0');
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO ton_deposit_intents (
    user_telegram_id, memo, amount_ton, expected_amount_ton,
    expected_sc, status, source, expires_at
  ) VALUES (
    v_tg, v_memo, p_amount_ton, p_amount_ton,
    v_sc_amt, 'awaiting', p_source, now() + interval '30 minutes'
  ) RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'intent_id',        v_intent_id,
    'amount_ton',       p_amount_ton,
    'expected_sc',      v_sc_amt,
    'expected_address', v_address,
    'memo',             v_memo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_buy_with_ton(uuid, numeric, text) TO authenticated, service_role;
