/*
  # Free Demo Balance Separated from Real Money

  1. Schema changes — `user_balances`
    - Add `sc_free` (numeric, default 0): demo balance used for free play only.
      Cannot be withdrawn, cannot be converted to real funds, never mixed
      with `sc_balance` (real, deposited SC).
    - Add `starter_granted` (boolean, default false): tracks whether the
      one-time starter grant has been issued to this user.

  2. RPC changes
    - Replace `pay_ensure_balance_row` to also grant a configurable starter
      `sc_free` amount on first row creation (read from `manager_config`
      key `starter_free_sc`, default 100).
    - Replace `pay_get_balance` to additionally return `sc_balance`,
      `sc_pending` and `sc_free`. Existing real-money columns kept for
      backward compatibility.

  3. Config seed
    - Insert manager_config entry `starter_free_sc` = '100' so admins can
      tune the starter grant from the manager panel.

  4. Safety
    - Starter grant is idempotent via the `starter_granted` flag — re-running
      ensure_balance_row never re-grants.
    - sc_free is intentionally NOT touched by withdrawal RPCs (existing
      pay_request_ton_withdrawal references sc_balance only).
*/

ALTER TABLE user_balances
  ADD COLUMN IF NOT EXISTS sc_free numeric NOT NULL DEFAULT 0;

ALTER TABLE user_balances
  ADD COLUMN IF NOT EXISTS starter_granted boolean NOT NULL DEFAULT false;

INSERT INTO manager_config (key, value, type, category, label, description)
VALUES ('starter_free_sc', '100', 'number', 'economy', 'Starter Free Balance',
        'One-time demo SC granted to every new visitor for free play (cannot be withdrawn)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pay_ensure_balance_row(p_tg_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_starter numeric;
  v_needs_grant boolean;
BEGIN
  INSERT INTO user_balances (telegram_id) VALUES (p_tg_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  SELECT NOT starter_granted INTO v_needs_grant
  FROM user_balances WHERE telegram_id = p_tg_id;

  IF COALESCE(v_needs_grant, false) THEN
    SELECT COALESCE((SELECT value::numeric FROM manager_config WHERE key = 'starter_free_sc'), 100)
      INTO v_starter;

    UPDATE user_balances
      SET sc_free = sc_free + COALESCE(v_starter, 0),
          starter_granted = true
      WHERE telegram_id = p_tg_id AND starter_granted = false;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.pay_get_balance(uuid);

CREATE OR REPLACE FUNCTION public.pay_get_balance(p_session_id uuid)
RETURNS TABLE (
  telegram_id          bigint,
  sc_balance           numeric,
  sc_pending           numeric,
  sc_free              numeric,
  available_usd        numeric,
  pending_usd          numeric,
  total_deposited_usd  numeric,
  total_withdrawn_usd  numeric,
  total_won_usd        numeric,
  total_staked_usd     numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  PERFORM pay_ensure_balance_row(v_tg);

  RETURN QUERY
  SELECT
    b.telegram_id,
    b.sc_balance,
    b.sc_pending,
    b.sc_free,
    b.available_usd,
    b.pending_usd,
    b.total_deposited_usd,
    b.total_withdrawn_usd,
    b.total_won_usd,
    b.total_staked_usd
  FROM user_balances b
  WHERE b.telegram_id = v_tg;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_get_balance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_get_balance(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.pay_ensure_balance_row(bigint) FROM anon, authenticated, PUBLIC;
