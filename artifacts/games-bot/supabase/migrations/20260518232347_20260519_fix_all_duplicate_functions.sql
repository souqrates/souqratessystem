/*
  # Fix All Duplicate/Broken DB Functions

  ## Problems Fixed:
  1. pay_apply_ton_deposit — two overloads with different arg order causing ambiguity
     - Keep: (p_intent_id uuid, p_tx_hash text, p_observed_ton numeric) — the correct one
     - Drop: (p_intent_id uuid, p_observed_ton numeric, p_tx_hash text) — old/broken
  2. pay_resolve_session — only accepts uuid but session_id is sent as text
     - Add overload that accepts text and casts to uuid internally
  3. Add missing economy settings: ton_deposit_min, ton_deposit_max
*/

-- 1. Drop the old/broken pay_apply_ton_deposit (wrong arg order)
DROP FUNCTION IF EXISTS public.pay_apply_ton_deposit(uuid, numeric, text);

-- 2. Add text overload for pay_resolve_session so sessions work correctly
CREATE OR REPLACE FUNCTION public.pay_resolve_session(p_session_id text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg                bigint;
  v_tg_from_expired   bigint;
  v_uuid              uuid;
BEGIN
  BEGIN
    v_uuid := p_session_id::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'session_invalid_or_expired' USING ERRCODE = '28000';
  END;

  SELECT telegram_id INTO v_tg
  FROM telegram_sessions
  WHERE id = v_uuid AND expires_at > now()
  LIMIT 1;

  IF v_tg IS NOT NULL THEN
    RETURN v_tg;
  END IF;

  SELECT telegram_id INTO v_tg_from_expired
  FROM telegram_sessions
  WHERE id = v_uuid
  LIMIT 1;

  IF v_tg_from_expired IS NOT NULL THEN
    SELECT telegram_id INTO v_tg
    FROM telegram_sessions
    WHERE telegram_id = v_tg_from_expired AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_tg IS NOT NULL THEN
      RETURN v_tg;
    END IF;
  END IF;

  RAISE EXCEPTION 'session_invalid_or_expired' USING ERRCODE = '28000';
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_resolve_session(text) TO anon, authenticated, service_role;

-- 3. Add missing economy settings for deposit limits
INSERT INTO economy_settings (key, value) VALUES
  ('ton_deposit_min', '0.1'),
  ('ton_deposit_max', '10000')
ON CONFLICT (key) DO NOTHING;
