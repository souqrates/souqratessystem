/*
  # Stars Invoice Hardening

  Adds protections against payment-replay and runaway invoice creation.

  1. Schema changes
    - `stars_invoices`: partial UNIQUE index on `provider_charge_id` (only
      enforced once a charge id is set), preventing the same Telegram
      payment from being applied to two invoices (audit H6).
    - Adds `deposit_max_stars` to manager_config (default 100000) so admins
      can cap single-purchase Star amount (audit M1).

  2. RPC changes
    - `pay_buy_with_stars`:
      - Enforces `deposit_max_stars` upper bound.
      - Rejects request if user already has > 10 pending (unpaid) invoices,
        preventing flood attacks.

  3. Safety
    - All changes are additive; existing paid invoices remain unaffected.
    - The UNIQUE index is a partial index keyed on (provider_charge_id)
      WHERE provider_charge_id IS NOT NULL, so legacy NULL rows do not
      conflict.
*/

-- 1) Partial UNIQUE on provider_charge_id
CREATE UNIQUE INDEX IF NOT EXISTS stars_invoices_provider_charge_uniq
  ON stars_invoices (provider_charge_id)
  WHERE provider_charge_id IS NOT NULL;

-- 2) Seed deposit_max_stars config
INSERT INTO manager_config (key, value, type, category, label, description)
VALUES ('deposit_max_stars', '100000', 'number', 'economy', 'Stars Deposit Maximum',
        'Maximum Stars allowed in a single invoice')
ON CONFLICT (key) DO NOTHING;

-- 3) Harden pay_buy_with_stars
CREATE OR REPLACE FUNCTION public.pay_buy_with_stars(p_session_id uuid, p_amount_stars integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tg bigint;
  v_min integer;
  v_max integer;
  v_rate numeric;
  v_expected_sc numeric;
  v_payload text;
  v_id uuid;
  v_enabled text;
  v_pending integer;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  v_enabled := econ_text('stars_enabled', 'true');
  IF v_enabled <> 'true' THEN
    RAISE EXCEPTION 'stars_disabled' USING ERRCODE = '22023';
  END IF;

  v_min := COALESCE(econ_num('deposit_min_stars', 50)::integer, 50);
  v_max := COALESCE(econ_num('deposit_max_stars', 100000)::integer, 100000);

  IF p_amount_stars < v_min THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = '22023';
  END IF;
  IF p_amount_stars > v_max THEN
    RAISE EXCEPTION 'above_maximum' USING ERRCODE = '22023';
  END IF;

  -- rate-limit: max 10 unpaid invoices per user
  SELECT COUNT(*) INTO v_pending FROM stars_invoices
   WHERE user_telegram_id = v_tg AND status <> 'paid';
  IF v_pending >= 10 THEN
    RAISE EXCEPTION 'too_many_pending_invoices' USING ERRCODE = '22023';
  END IF;

  v_rate := econ_num('sc_per_star', 1);
  v_expected_sc := p_amount_stars * v_rate;
  v_payload := 'stars_' || v_tg || '_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 8);

  INSERT INTO stars_invoices (user_telegram_id, payload, amount_stars, expected_sc)
  VALUES (v_tg, v_payload, p_amount_stars, v_expected_sc)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_id', v_id,
    'payload', v_payload,
    'amount_stars', p_amount_stars,
    'expected_sc', v_expected_sc,
    'title', 'Skill Coins',
    'description', p_amount_stars || ' Stars = ' || v_expected_sc || ' SC'
  );
END;
$function$;
