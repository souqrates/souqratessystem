/*
  # Make Stars purchases visible in the manager dashboard

  ## Summary
  `pay_apply_stars_payment` credited balance + ledger only and never wrote
  to `platform_revenue` or `manager_visitors.total_spent`. Manager dashboard
  reads exclusively from those, so successful Stars purchases were invisible.

  ## Changes
  1. `pay_apply_stars_payment` now additionally writes to
     `platform_revenue` (source='stars_markup') and increments
     `manager_visitors.total_spent` on every successful credit.
  2. Backfill: replays paid invoices into `platform_revenue` (idempotent
     on `metadata->>'invoice_id'`) and reconciles `total_spent`.

  Note: `platform_revenue.source` has a CHECK constraint; we reuse the
  permitted value `stars_markup` for Stars purchases.
*/

CREATE OR REPLACE FUNCTION public.pay_apply_stars_payment(p_telegram_id bigint, p_payload text, p_amount_stars integer, p_charge_id text, p_provider_charge_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv          stars_invoices%ROWTYPE;
  v_existing     stars_invoices%ROWTYPE;
  v_new_balance  numeric;
  v_charge       text;
  v_provider     text;
BEGIN
  v_charge   := NULLIF(p_charge_id, '');
  v_provider := NULLIF(p_provider_charge_id, '');

  IF v_charge IS NOT NULL THEN
    SELECT * INTO v_existing FROM stars_invoices
      WHERE charge_id = v_charge AND status = 'paid' LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true,
        'credited_sc', v_existing.expected_sc,
        'new_sc_balance',
          (SELECT sc_balance FROM user_balances
             WHERE telegram_id = p_telegram_id));
    END IF;
  END IF;

  SELECT * INTO v_inv FROM stars_invoices
    WHERE payload = p_payload FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true,
      'credited_sc', v_inv.expected_sc);
  END IF;
  IF v_inv.user_telegram_id <> p_telegram_id THEN
    RAISE EXCEPTION 'user_mismatch' USING ERRCODE = '42501';
  END IF;

  PERFORM pay_ensure_balance_row(p_telegram_id);

  UPDATE user_balances
     SET sc_balance         = sc_balance         + v_inv.expected_sc,
         total_purchased_sc = total_purchased_sc + v_inv.expected_sc,
         updated_at = now()
   WHERE telegram_id = p_telegram_id
   RETURNING sc_balance INTO v_new_balance;

  UPDATE stars_invoices
     SET status             = 'paid',
         charge_id          = v_charge,
         provider_charge_id = v_provider,
         paid_at            = now()
   WHERE id = v_inv.id;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    p_telegram_id, 'credit', 'deposit',
    v_inv.expected_sc, p_amount_stars, 'STARS',
    v_new_balance, 'stars_invoice', v_inv.id::text,
    'Stars purchase: ' || p_amount_stars || ' Stars -> ' || v_inv.expected_sc || ' SC',
    jsonb_build_object('charge_id', v_charge, 'provider_charge_id', v_provider)
  );

  INSERT INTO platform_revenue (
    source, amount_usd, amount_ton, user_telegram_id, metadata
  ) VALUES (
    'stars_markup', v_inv.expected_sc, 0, p_telegram_id,
    jsonb_build_object(
      'invoice_id', v_inv.id,
      'stars', p_amount_stars,
      'charge_id', v_charge,
      'provider_charge_id', v_provider,
      'kind', 'stars_purchase'
    )
  );

  INSERT INTO manager_visitors (telegram_id, total_spent, first_seen, last_seen)
  VALUES (p_telegram_id, v_inv.expected_sc, now(), now())
  ON CONFLICT (telegram_id) DO UPDATE
     SET total_spent = COALESCE(manager_visitors.total_spent, 0) + EXCLUDED.total_spent,
         last_seen   = now();

  RETURN jsonb_build_object('ok', true,
    'new_sc_balance', v_new_balance,
    'credited_sc',    v_inv.expected_sc);
END;
$function$;

INSERT INTO platform_revenue (source, amount_usd, amount_ton, user_telegram_id, metadata, created_at)
SELECT 'stars_markup',
       si.expected_sc,
       0,
       si.user_telegram_id,
       jsonb_build_object(
         'invoice_id', si.id,
         'stars', si.amount_stars,
         'charge_id', si.charge_id,
         'provider_charge_id', si.provider_charge_id,
         'kind', 'stars_purchase',
         'backfilled', true
       ),
       COALESCE(si.paid_at, now())
FROM stars_invoices si
WHERE si.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM platform_revenue pr
    WHERE pr.source = 'stars_markup'
      AND (pr.metadata->>'invoice_id') = si.id::text
  );

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_telegram_id, SUM(expected_sc) AS spent
    FROM stars_invoices
    WHERE status = 'paid'
    GROUP BY user_telegram_id
  LOOP
    INSERT INTO manager_visitors (telegram_id, total_spent, first_seen, last_seen)
    VALUES (r.user_telegram_id, r.spent, now(), now())
    ON CONFLICT (telegram_id) DO UPDATE
       SET total_spent = GREATEST(COALESCE(manager_visitors.total_spent, 0), EXCLUDED.total_spent);
  END LOOP;
END $$;
