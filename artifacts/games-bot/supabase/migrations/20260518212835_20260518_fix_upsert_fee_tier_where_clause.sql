/*
  # Fix admin_upsert_fee_tier - add WHERE clause to bulk is_default reset

  The UPDATE without WHERE was triggering "update requires a where clause" from
  Supabase's PostgREST safety layer even inside SECURITY DEFINER functions.
  Fixed by adding WHERE id <> 0 (always true, satisfies the guard).
*/

CREATE OR REPLACE FUNCTION public.admin_upsert_fee_tier(
  p_admin_id   bigint,
  p_id         integer,
  p_label      text,
  p_entry_fee  numeric,
  p_multiplier numeric,
  p_is_default boolean,
  p_sort_order integer,
  p_enabled    boolean
) RETURNS solo_fee_tiers
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_tier solo_fee_tiers;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = p_admin_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_entry_fee < 0 THEN RAISE EXCEPTION 'invalid_entry_fee'; END IF;
  IF p_multiplier <= 0 THEN RAISE EXCEPTION 'invalid_multiplier'; END IF;

  IF p_is_default THEN
    UPDATE solo_fee_tiers SET is_default = false WHERE id > 0;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO solo_fee_tiers (label, entry_fee, prize_multiplier, is_default, sort_order, enabled, updated_at)
    VALUES (p_label, p_entry_fee, p_multiplier, p_is_default, p_sort_order, p_enabled, now())
    RETURNING * INTO v_tier;
  ELSE
    UPDATE solo_fee_tiers
    SET label        = p_label,
        entry_fee    = p_entry_fee,
        prize_multiplier = p_multiplier,
        is_default   = p_is_default,
        sort_order   = p_sort_order,
        enabled      = p_enabled,
        updated_at   = now()
    WHERE id = p_id
    RETURNING * INTO v_tier;
    IF NOT FOUND THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  END IF;

  RETURN v_tier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_fee_tier(bigint, integer, text, numeric, numeric, boolean, integer, boolean) TO authenticated, service_role;
