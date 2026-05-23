/*
  # Mark account as paid on Stars purchase + backfill existing buyers

  ## Summary
  When a user successfully completes a Telegram Stars purchase, their
  account should be recognized as a paying customer (`is_paid = true`).
  Previously `pay_apply_stars_payment` only credited the balance and ledger
  but never updated `is_paid`, leaving real payers stuck on free-plan
  status with no trial credit either (if they were created before the
  trial migration). This corrects that.

  ## Changes
  1. `pay_apply_stars_payment` — after crediting balance, also sets
     `is_paid = true` and ends any remaining trial window (the user is
     now a paid customer).
  2. Backfill: every user who has at least one PAID Stars invoice gets
     `is_paid = true` immediately.

  ## Security
  Function remains SECURITY DEFINER with locked search_path. No RLS or
  permission changes; no destructive operations.

  ## Notes
  1. Solo/PvP/4P/Tournament gating is unchanged — entry still requires
     `sc_balance >= bet`. This migration just corrects the paid-status
     flag so dashboards and downstream logic reflect reality.
  2. Backfill is idempotent: re-running has no effect on already-paid rows.
*/

CREATE OR REPLACE FUNCTION public.pay_apply_stars_payment(
  p_telegram_id bigint, p_payload text, p_amount_stars integer,
  p_charge_id text, p_provider_charge_id text)
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
         is_paid            = true,
         trial_expires_at   = LEAST(COALESCE(trial_expires_at, now()), now()),
         updated_at         = now()
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
    'Stars purchase: ' || p_amount_stars || ' Stars -> ' || v_inv.expected_sc || ' SKZ',
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

UPDATE user_balances ub
   SET is_paid = true,
       updated_at = now()
 WHERE is_paid = false
   AND EXISTS (
     SELECT 1 FROM stars_invoices si
     WHERE si.user_telegram_id = ub.telegram_id AND si.status = 'paid'
   );
