/*
  # Solo Fee Tiers System

  ## Summary
  Adds a flexible fee/prize tier system for solo games, fully controlled by the manager.
  Players can choose their entry fee tier before playing — higher entry = higher prize.

  ## New Tables
  - `solo_fee_tiers` — global tier definitions (entry_fee, prize_multiplier, label)
    - Managed exclusively by admins via manager dashboard
    - Applied to all solo games unless a game has its own override

  ## Changes
  - No existing tables modified
  - RLS: authenticated read for all tiers; write restricted to service role / RPC

  ## Notes
  1. `multiplier` stored as numeric (e.g. 2.5 = win 2.5x entry)
  2. `is_default` marks which tier is pre-selected in the UI
  3. `sort_order` controls display order
  4. Initial seed: 3 tiers (Low / Standard / High)
*/

CREATE TABLE IF NOT EXISTS solo_fee_tiers (
  id              serial PRIMARY KEY,
  label           text    NOT NULL DEFAULT '',
  entry_fee       numeric NOT NULL DEFAULT 0,
  prize_multiplier numeric NOT NULL DEFAULT 2,
  is_default      boolean NOT NULL DEFAULT false,
  sort_order      int     NOT NULL DEFAULT 0,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE solo_fee_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (or anon) can read tiers — needed by the frontend
CREATE POLICY "Anyone can read fee tiers"
  ON solo_fee_tiers FOR SELECT
  USING (true);

-- Only admins via RPC can write
CREATE POLICY "Service role can write fee tiers"
  ON solo_fee_tiers FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update fee tiers"
  ON solo_fee_tiers FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed default tiers
INSERT INTO solo_fee_tiers (label, entry_fee, prize_multiplier, is_default, sort_order, enabled)
VALUES
  ('Starter',  5,  2.0, false, 1, true),
  ('Standard', 10, 2.0, true,  2, true),
  ('Pro',      25, 2.0, false, 3, true),
  ('Elite',    50, 2.0, false, 4, true)
ON CONFLICT DO NOTHING;

-- RPC: admin upsert a tier
CREATE OR REPLACE FUNCTION admin_upsert_fee_tier(
  p_admin_id  bigint,
  p_id        int,        -- NULL = insert new
  p_label     text,
  p_entry_fee numeric,
  p_multiplier numeric,
  p_is_default boolean,
  p_sort_order int,
  p_enabled   boolean
) RETURNS solo_fee_tiers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tier solo_fee_tiers;
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_entry_fee < 0 THEN RAISE EXCEPTION 'invalid_entry_fee'; END IF;
  IF p_multiplier <= 0 THEN RAISE EXCEPTION 'invalid_multiplier'; END IF;

  -- If new default, clear existing default first
  IF p_is_default THEN
    UPDATE solo_fee_tiers SET is_default = false;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO solo_fee_tiers (label, entry_fee, prize_multiplier, is_default, sort_order, enabled, updated_at)
    VALUES (p_label, p_entry_fee, p_multiplier, p_is_default, p_sort_order, p_enabled, now())
    RETURNING * INTO v_tier;
  ELSE
    UPDATE solo_fee_tiers
    SET label = p_label, entry_fee = p_entry_fee, prize_multiplier = p_multiplier,
        is_default = p_is_default, sort_order = p_sort_order, enabled = p_enabled, updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_tier;
    IF NOT FOUND THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  END IF;

  RETURN v_tier;
END;
$$;

-- RPC: admin delete a tier
CREATE OR REPLACE FUNCTION admin_delete_fee_tier(
  p_admin_id bigint,
  p_id       int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE id = p_admin_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  DELETE FROM solo_fee_tiers WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- RPC: public read of enabled tiers ordered by sort_order
CREATE OR REPLACE FUNCTION get_solo_fee_tiers()
RETURNS SETOF solo_fee_tiers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM solo_fee_tiers WHERE enabled = true ORDER BY sort_order, id;
$$;

GRANT EXECUTE ON FUNCTION get_solo_fee_tiers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_fee_tier(bigint,int,text,numeric,numeric,boolean,int,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_fee_tier(bigint,int) TO authenticated;
