/*
  # 8-Hour Free Trial Replaces Free Demo Balance

  Replaces the SC-based free demo balance with a time-based 8-hour free
  trial window for new accounts. During the trial all solo entry fees are
  waived. After the trial expires (or after the user converts), every
  game costs real SKZ.

  1. Schema changes — `user_balances`
    - `trial_started_at`  (timestamptz, nullable): when the 8h trial began
    - `trial_expires_at`  (timestamptz, nullable): when the 8h trial ends
    - `is_paid`           (boolean, default false): true once the account
      has converted to paid mode (either explicitly or via first deposit)
    - `sc_free` is kept for backward-compat reads but is no longer used
      by the charge flow. New accounts get sc_free = 0.

  2. RPCs
    - `pay_ensure_balance_row` rewritten to grant an 8-hour trial on the
      first row creation (idempotent via `starter_granted`).
    - `pay_get_balance` now also returns `trial_started_at`,
      `trial_expires_at`, `trial_seconds_left`, and `is_paid` so the UI
      can render the countdown.
    - `pay_charge_solo_entry` rewritten:
        • If the trial is active AND the account is not paid → charge 0,
          record a `trial_play` ledger entry, do NOT debit any balance.
        • Otherwise → debit `sc_balance` as before. If insufficient,
          raise `insufficient_balance`.
    - New `pay_convert_to_paid(p_session_id)` lets the user end their
      trial early and switch to paid mode immediately.

  3. Notes
    - Trial duration is read from `manager_config.trial_hours` (default 8)
      so admins can adjust without code changes.
    - Existing users keep whatever sc_free they had; the charge RPC no
      longer touches sc_free, so it simply stops mattering. (No data loss
      — column kept.)
*/

INSERT INTO manager_config (key, value, type, category, label, description)
VALUES ('trial_hours', '8', 'number', 'economy', 'Free Trial Hours',
        'Hours of free solo play granted to every new account on first visit')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE user_balances
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paid          boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pay_ensure_balance_row(p_tg_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hours numeric;
  v_needs_grant boolean;
BEGIN
  INSERT INTO user_balances (telegram_id) VALUES (p_tg_id)
  ON CONFLICT (telegram_id) DO NOTHING;

  SELECT NOT starter_granted INTO v_needs_grant
    FROM user_balances WHERE telegram_id = p_tg_id;

  IF COALESCE(v_needs_grant, false) THEN
    SELECT COALESCE((SELECT value::numeric FROM manager_config WHERE key = 'trial_hours'), 8)
      INTO v_hours;

    UPDATE user_balances
      SET trial_started_at = now(),
          trial_expires_at = now() + (COALESCE(v_hours, 8) || ' hours')::interval,
          starter_granted  = true,
          sc_free          = 0
      WHERE telegram_id = p_tg_id AND starter_granted = false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_ensure_balance_row(bigint) FROM anon, authenticated, PUBLIC;

DROP FUNCTION IF EXISTS public.pay_get_balance(uuid);

CREATE OR REPLACE FUNCTION public.pay_get_balance(p_session_id uuid)
RETURNS TABLE (
  telegram_id          bigint,
  sc_balance           numeric,
  sc_pending           numeric,
  sc_free              numeric,
  trial_started_at     timestamptz,
  trial_expires_at     timestamptz,
  trial_seconds_left   integer,
  trial_active         boolean,
  is_paid              boolean,
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
    b.trial_started_at,
    b.trial_expires_at,
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (b.trial_expires_at - now()))::int, 0))::int AS trial_seconds_left,
    (NOT b.is_paid AND b.trial_expires_at IS NOT NULL AND b.trial_expires_at > now())  AS trial_active,
    b.is_paid,
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

DROP FUNCTION IF EXISTS public.pay_charge_solo_entry(uuid, int, numeric);

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(
  p_session_id uuid,
  p_game_id    int,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg            bigint;
  v_bal           numeric;
  v_trial_exp     timestamptz;
  v_is_paid       boolean;
  v_trial_active  boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'bad_arguments';
  END IF;

  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  SELECT sc_balance, trial_expires_at, is_paid
    INTO v_bal, v_trial_exp, v_is_paid
    FROM user_balances WHERE telegram_id = v_tg FOR UPDATE;

  v_trial_active := (NOT v_is_paid AND v_trial_exp IS NOT NULL AND v_trial_exp > now());

  IF v_trial_active THEN
    INSERT INTO ledger_entries (
      user_telegram_id, direction, category, amount_usd, amount_token, token,
      reference_type, reference_id, description, metadata
    ) VALUES (
      v_tg, 'debit', 'trial_play',
      0, 0, 'SKZ',
      'solo_game', p_game_id::text,
      'Free trial play (no charge)',
      jsonb_build_object('game_id', p_game_id, 'trial_expires_at', v_trial_exp)
    );

    RETURN json_build_object(
      'ok',           true,
      'charged',      0,
      'trial',        true,
      'sc_balance',   COALESCE(v_bal,0),
      'trial_expires_at', v_trial_exp
    );
  END IF;

  IF COALESCE(v_bal,0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE user_balances
    SET sc_balance = COALESCE(sc_balance,0) - p_amount,
        updated_at = now()
    WHERE telegram_id = v_tg;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'debit', 'bet',
    p_amount, p_amount, 'SKZ',
    'solo_game', p_game_id::text,
    'Solo game entry: -' || p_amount || ' SKZ',
    jsonb_build_object('game_id', p_game_id, 'from_balance', p_amount)
  );

  RETURN json_build_object(
    'ok',           true,
    'charged',      p_amount,
    'trial',        false,
    'sc_balance',   COALESCE(v_bal,0) - p_amount
  );
END $$;

GRANT EXECUTE ON FUNCTION public.pay_charge_solo_entry(uuid, int, numeric)
  TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.pay_convert_to_paid(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  PERFORM pay_ensure_balance_row(v_tg);

  UPDATE user_balances
    SET is_paid          = true,
        trial_expires_at = LEAST(COALESCE(trial_expires_at, now()), now()),
        updated_at       = now()
    WHERE telegram_id = v_tg;

  RETURN json_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.pay_convert_to_paid(uuid)
  TO authenticated, anon;