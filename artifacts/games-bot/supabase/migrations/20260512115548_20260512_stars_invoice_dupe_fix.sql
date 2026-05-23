/*
  # Fix Stars Invoice Duplicate Key on provider_charge_id

  ## Root cause
  Telegram's `successful_payment.provider_payment_charge_id` is typically
  EMPTY for Telegram Stars (Stars don't go through an external payment
  provider). The table column defaulted to `''` (empty string) NOT NULL,
  while the partial unique index was `WHERE provider_charge_id IS NOT NULL`.
  Empty strings are NOT NULL, so the second invoice with `''` collided
  with the first — every new buy after the first pending invoice failed
  with `duplicate key value violates unique constraint
  stars_invoices_provider_charge_uniq`.

  ## Changes
  1. Allow `provider_charge_id` and `charge_id` to be NULL, with default NULL.
  2. Backfill existing rows: convert `''` to NULL so the partial unique index
     stops matching them.
  3. Patch `pay_apply_stars_payment` so it stores NULL (not '') when Telegram
     omits the provider/charge id, and short-circuits on a dedupe match by
     telegram_payment_charge_id (the field that IS always present).
  4. Add a partial unique index on `charge_id` (Telegram's reliable id) so
     even if Telegram retries the webhook, double-credit is impossible.

  ## Safety
  - All changes are non-destructive: paid invoices keep their charge ids
    (only empty strings are normalised to NULL).
  - Existing partial unique index remains; it's now correctly skipped for
    rows with NULL.
*/

-- 1) Loosen NOT NULL + change defaults to NULL
ALTER TABLE stars_invoices
  ALTER COLUMN provider_charge_id DROP NOT NULL,
  ALTER COLUMN provider_charge_id SET DEFAULT NULL,
  ALTER COLUMN charge_id          DROP NOT NULL,
  ALTER COLUMN charge_id          SET DEFAULT NULL;

-- 2) Backfill empty strings to NULL so they stop colliding
UPDATE stars_invoices SET provider_charge_id = NULL WHERE provider_charge_id = '';
UPDATE stars_invoices SET charge_id          = NULL WHERE charge_id          = '';

-- 3) Partial unique on the reliable telegram_payment_charge_id
CREATE UNIQUE INDEX IF NOT EXISTS stars_invoices_charge_id_uniq
  ON stars_invoices (charge_id)
  WHERE charge_id IS NOT NULL;

-- 4) Patch the apply RPC: NULLIF empties + dedupe by charge_id
CREATE OR REPLACE FUNCTION public.pay_apply_stars_payment(
  p_telegram_id        bigint,
  p_payload            text,
  p_amount_stars       integer,
  p_charge_id          text,
  p_provider_charge_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv          stars_invoices%ROWTYPE;
  v_existing     stars_invoices%ROWTYPE;
  v_new_balance  numeric;
  v_charge       text;
  v_provider     text;
BEGIN
  v_charge   := NULLIF(p_charge_id, '');
  v_provider := NULLIF(p_provider_charge_id, '');

  -- If we've already credited this Telegram charge before (retry),
  -- short-circuit cleanly instead of throwing.
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

  RETURN jsonb_build_object('ok', true,
                            'new_sc_balance', v_new_balance,
                            'credited_sc',    v_inv.expected_sc);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_apply_stars_payment(bigint, text, integer, text, text)
  FROM anon, authenticated;