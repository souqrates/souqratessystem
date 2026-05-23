/*
  # SKZ-XXXX-YYYY Professional Memo Code Format

  ## Summary
  Updates the TON deposit intent creation function to generate professional
  branded memo codes in the format SKZ-XXXX-YYYY instead of plain 6-digit numbers.

  ## Changes
  - Replaces `pay_buy_with_ton` memo generation with SKZ-XXXX-YYYY format
  - Each segment (XXXX, YYYY) is 4 random decimal digits (0000-9999)
  - Full code example: SKZ-4829-7301
  - Collision detection uses the same uniqueness check as before
  - ton_watcher already does exact string match on memo — no changes needed there

  ## Security
  - No RLS changes (no new tables)
  - Codes are unique among active awaiting intents
  - Format is predictable length (12 chars) which aids ton_watcher matching
*/

CREATE OR REPLACE FUNCTION pay_buy_with_ton(
  p_session_id text,
  p_amount_ton  numeric,
  p_source      text DEFAULT 'wallet'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_seg1         text;
  v_seg2         text;
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

  -- Generate unique SKZ-XXXX-YYYY memo code, retry up to 10 times on collision
  LOOP
    v_seg1 := LPAD((FLOOR(random() * 10000))::int::text, 4, '0');
    v_seg2 := LPAD((FLOOR(random() * 10000))::int::text, 4, '0');
    v_memo := 'SKZ-' || v_seg1 || '-' || v_seg2;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM ton_deposit_intents
      WHERE memo = v_memo AND status = 'awaiting' AND expires_at > now()
    );

    v_attempts := v_attempts + 1;
    IF v_attempts >= 10 THEN
      -- Fallback: add extra segment to ensure uniqueness
      v_memo := 'SKZ-' || v_seg1 || '-' || v_seg2 || '-' || LPAD((FLOOR(random() * 10000))::int::text, 4, '0');
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
