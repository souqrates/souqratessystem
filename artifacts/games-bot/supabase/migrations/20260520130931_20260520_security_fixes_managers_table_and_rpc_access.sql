/*
  # Security Fixes: managers table reference + restrict public RPC access

  ## Summary
  Fixes two critical security issues identified in pre-deployment audit:

  1. All manager RPCs for tiers/exceptions used `FROM managers WHERE admin_id = ...`
     but the actual table is `manager_admins`. This caused silent auth bypass.
     Fixed by rewriting all 6 RPCs to check `manager_admins` instead.

  2. `credit_referral_commission` and `get_paid_referral_count` were granted
     EXECUTE to `anon, authenticated` which allowed any user to call them directly.
     - `credit_referral_commission` restricted to service_role only (called internally)
     - `get_paid_referral_count` restricted to service_role only (internal helper)

  ## Affected Functions
  - manager_list_tiers
  - manager_upsert_tier
  - manager_delete_tier
  - manager_list_exceptions
  - manager_upsert_exception
  - manager_delete_exception
  - credit_referral_commission (revoke from anon/authenticated)
  - get_paid_referral_count (revoke from anon/authenticated)
*/

-- ─── Revoke public access from sensitive commission functions ─────────────────

REVOKE EXECUTE ON FUNCTION credit_referral_commission(bigint, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_paid_referral_count(bigint) FROM anon, authenticated;

-- Re-grant only to service_role for internal use
GRANT EXECUTE ON FUNCTION credit_referral_commission(bigint, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_paid_referral_count(bigint) TO service_role;

-- ─── Fix manager_list_tiers: managers → manager_admins ────────────────────────

CREATE OR REPLACE FUNCTION manager_list_tiers(p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'tiers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort_order), '[]'::jsonb)
      FROM (
        SELECT id, name, min_referrals, commission_multiplier,
               l1_pct_override, chain_pct_override,
               color, icon, description, sort_order
        FROM affiliate_tiers ORDER BY sort_order
      ) t
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manager_list_tiers(text) TO anon, authenticated;

-- ─── Fix manager_upsert_tier: managers → manager_admins ──────────────────────

CREATE OR REPLACE FUNCTION manager_upsert_tier(
  p_admin_id            text,
  p_id                  int     DEFAULT NULL,
  p_name                text    DEFAULT 'Tier',
  p_min_referrals       int     DEFAULT 0,
  p_commission_mult     numeric DEFAULT 1.0,
  p_l1_pct_override     numeric DEFAULT NULL,
  p_chain_pct_override  numeric DEFAULT NULL,
  p_color               text    DEFAULT '#94a3b8',
  p_icon                text    DEFAULT 'users',
  p_description         text    DEFAULT '',
  p_sort_order          int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_id IS NOT NULL THEN
    UPDATE affiliate_tiers SET
      name = p_name, min_referrals = p_min_referrals,
      commission_multiplier = p_commission_mult,
      l1_pct_override = p_l1_pct_override,
      chain_pct_override = p_chain_pct_override,
      color = p_color, icon = p_icon,
      description = p_description, sort_order = p_sort_order
    WHERE id = p_id;
  ELSE
    INSERT INTO affiliate_tiers
      (name, min_referrals, commission_multiplier, l1_pct_override, chain_pct_override, color, icon, description, sort_order)
    VALUES
      (p_name, p_min_referrals, p_commission_mult, p_l1_pct_override, p_chain_pct_override, p_color, p_icon, p_description, p_sort_order);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_tier(text, int, text, int, numeric, numeric, numeric, text, text, text, int) TO anon, authenticated;

-- ─── Fix manager_delete_tier: managers → manager_admins ──────────────────────

CREATE OR REPLACE FUNCTION manager_delete_tier(p_admin_id text, p_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  DELETE FROM affiliate_tiers WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_delete_tier(text, int) TO anon, authenticated;

-- ─── Fix manager_list_exceptions: managers → manager_admins ──────────────────

CREATE OR REPLACE FUNCTION manager_list_exceptions(p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'exceptions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'telegram_id', e.telegram_id,
          'label', e.label,
          'l1_pct_override', e.l1_pct_override,
          'chain_pct_override', e.chain_pct_override,
          'notes', e.notes,
          'is_active', e.is_active,
          'created_at', e.created_at,
          'display_name', COALESCE(u.display_name, u.first_name, u.username, 'Unknown')
        ) ORDER BY e.created_at DESC
      ), '[]'::jsonb)
      FROM referral_exceptions e
      LEFT JOIN users u ON u.telegram_id = e.telegram_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manager_list_exceptions(text) TO anon, authenticated;

-- ─── Fix manager_upsert_exception: managers → manager_admins ─────────────────

CREATE OR REPLACE FUNCTION manager_upsert_exception(
  p_admin_id           text,
  p_telegram_id        bigint,
  p_label              text    DEFAULT '',
  p_l1_pct_override    numeric DEFAULT 10,
  p_chain_pct_override numeric DEFAULT 2,
  p_notes              text    DEFAULT '',
  p_is_active          boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_l1_pct_override < 0 OR p_l1_pct_override > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'l1_pct must be 0-100');
  END IF;
  INSERT INTO referral_exceptions
    (telegram_id, label, l1_pct_override, chain_pct_override, notes, is_active, updated_at)
  VALUES
    (p_telegram_id, p_label, p_l1_pct_override, p_chain_pct_override, p_notes, p_is_active, now())
  ON CONFLICT (telegram_id) DO UPDATE SET
    label = EXCLUDED.label,
    l1_pct_override = EXCLUDED.l1_pct_override,
    chain_pct_override = EXCLUDED.chain_pct_override,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_exception(text, bigint, text, numeric, numeric, text, boolean) TO anon, authenticated;

-- ─── Fix manager_delete_exception: managers → manager_admins ─────────────────

CREATE OR REPLACE FUNCTION manager_delete_exception(p_admin_id text, p_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  DELETE FROM referral_exceptions WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_delete_exception(text, int) TO anon, authenticated;

-- ─── Also fix manager_get_chain_settings and manager_set_chain_settings ───────
-- These were in the chain_commission_settings migration and may also reference
-- the wrong table. Re-create them with the correct manager_admins check.

CREATE OR REPLACE FUNCTION manager_get_chain_settings(p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_l1    numeric;
  v_chain numeric;
  v_min   numeric;
  v_max   int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT COALESCE(NULLIF(value,'')::numeric, 5)    INTO v_l1    FROM manager_config WHERE key = 'commission_l1_pct';
  SELECT COALESCE(NULLIF(value,'')::numeric, 2)    INTO v_chain FROM manager_config WHERE key = 'commission_chain_pct';
  SELECT COALESCE(NULLIF(value,'')::numeric, 0.01) INTO v_min   FROM manager_config WHERE key = 'commission_min_amount';
  SELECT COALESCE(NULLIF(value,'')::int, 15)       INTO v_max   FROM manager_config WHERE key = 'commission_max_levels';
  RETURN jsonb_build_object(
    'ok', true,
    'l1_pct',    COALESCE(v_l1,    5),
    'chain_pct', COALESCE(v_chain, 2),
    'min_amount',COALESCE(v_min,   0.01),
    'max_levels',COALESCE(v_max,   15)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manager_get_chain_settings(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION manager_set_chain_settings(
  p_admin_id  text,
  p_l1_pct    numeric DEFAULT 5,
  p_chain_pct numeric DEFAULT 2,
  p_min_amount numeric DEFAULT 0.01,
  p_max_levels int    DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_l1_pct < 0 OR p_l1_pct > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'l1_pct out of range 0-50');
  END IF;
  IF p_chain_pct < 0 OR p_chain_pct > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'chain_pct out of range 0-50');
  END IF;
  IF p_max_levels < 1 OR p_max_levels > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_levels out of range 1-50');
  END IF;
  INSERT INTO manager_config (key, value) VALUES
    ('commission_l1_pct',    p_l1_pct::text),
    ('commission_chain_pct', p_chain_pct::text),
    ('commission_min_amount',p_min_amount::text),
    ('commission_max_levels',p_max_levels::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN jsonb_build_object('ok', true,
    'l1_pct', p_l1_pct, 'chain_pct', p_chain_pct,
    'min_amount', p_min_amount, 'max_levels', p_max_levels
  );
END;
$$;

GRANT EXECUTE ON FUNCTION manager_set_chain_settings(text, numeric, numeric, numeric, int) TO anon, authenticated;
