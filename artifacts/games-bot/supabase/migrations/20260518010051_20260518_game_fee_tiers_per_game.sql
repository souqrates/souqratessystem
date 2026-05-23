/*
  # Per-Game Fee Tiers System

  Allows each game to have its own set of up to 5 entry fee + prize tiers,
  independent from the global solo_fee_tiers table.

  1. New Table: `game_fee_tiers`
     - `id` (serial PK)
     - `game_id` (integer, references which game this tier belongs to)
     - `label` (text) — e.g. "Starter", "Pro"
     - `entry_fee` (numeric) — SKZ entry cost
     - `prize_multiplier` (numeric) — prize = entry_fee × prize_multiplier
     - `is_default` (boolean) — pre-selected tier for this game
     - `sort_order` (int) — display order
     - `enabled` (boolean)

  2. RPCs:
     - `admin_upsert_game_fee_tier` — create or update a tier for a game
     - `admin_delete_game_fee_tier` — delete a tier
     - `get_game_fee_tiers(p_game_id)` — public read of enabled tiers for a game

  3. Security
     - RLS enabled
     - Public SELECT on enabled rows only (via RPC)
     - Writes only via admin RPCs (SECURITY DEFINER)
*/

CREATE TABLE IF NOT EXISTS game_fee_tiers (
  id               serial PRIMARY KEY,
  game_id          integer NOT NULL,
  label            text    NOT NULL DEFAULT '',
  entry_fee        numeric NOT NULL DEFAULT 0,
  prize_multiplier numeric NOT NULL DEFAULT 2,
  is_default       boolean NOT NULL DEFAULT false,
  sort_order       int     NOT NULL DEFAULT 0,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE game_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled game fee tiers"
  ON game_fee_tiers FOR SELECT
  USING (enabled = true);

CREATE POLICY "Service role can manage game fee tiers"
  ON game_fee_tiers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_game_fee_tiers_game_id ON game_fee_tiers(game_id);

-- RPC: admin upsert a game fee tier (up to 5 per game enforced in app logic)
CREATE OR REPLACE FUNCTION admin_upsert_game_fee_tier(
  p_admin_id      integer,
  p_id            integer DEFAULT NULL,
  p_game_id       integer DEFAULT NULL,
  p_label         text    DEFAULT '',
  p_entry_fee     numeric DEFAULT 0,
  p_multiplier    numeric DEFAULT 2,
  p_is_default    boolean DEFAULT false,
  p_sort_order    int     DEFAULT 0,
  p_enabled       boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ok boolean;
  v_row game_fee_tiers;
BEGIN
  SELECT EXISTS(SELECT 1 FROM manager_admins WHERE id = p_admin_id AND is_active = true)
  INTO v_ok;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- If setting as default, unset other defaults for this game
  IF p_is_default THEN
    UPDATE game_fee_tiers SET is_default = false
    WHERE game_id = p_game_id AND (p_id IS NULL OR id != p_id);
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE game_fee_tiers SET
      label            = p_label,
      entry_fee        = p_entry_fee,
      prize_multiplier = p_multiplier,
      is_default       = p_is_default,
      sort_order       = p_sort_order,
      enabled          = p_enabled,
      updated_at       = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO game_fee_tiers (game_id, label, entry_fee, prize_multiplier, is_default, sort_order, enabled)
    VALUES (p_game_id, p_label, p_entry_fee, p_multiplier, p_is_default, p_sort_order, p_enabled)
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_row.id);
END;
$$;

-- RPC: admin delete a game fee tier
CREATE OR REPLACE FUNCTION admin_delete_game_fee_tier(
  p_admin_id integer,
  p_id       integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM manager_admins WHERE id = p_admin_id AND is_active = true)
  INTO v_ok;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM game_fee_tiers WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: public read of enabled tiers for a specific game
CREATE OR REPLACE FUNCTION get_game_fee_tiers(p_game_id integer)
RETURNS TABLE (
  id               integer,
  label            text,
  entry_fee        numeric,
  prize_multiplier numeric,
  is_default       boolean,
  sort_order       int
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, label, entry_fee, prize_multiplier, is_default, sort_order
  FROM game_fee_tiers
  WHERE game_id = p_game_id AND enabled = true
  ORDER BY sort_order, id;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_game_fee_tier TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_delete_game_fee_tier TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_game_fee_tiers TO authenticated, anon, service_role;
