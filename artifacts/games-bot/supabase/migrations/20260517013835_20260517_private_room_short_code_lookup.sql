/*
  # Private Room Short Code Lookup RPC

  ## Problem
  Room IDs are full UUIDs (e.g. "a1b2c3d4-..."). The app displays an 8-char
  short code (first 8 hex chars, uppercase, no dashes) via formatRoomCode().
  When a user manually types this short code, match_join_room fails because it
  expects the full UUID.

  ## Solution
  Add a helper RPC `match_resolve_room_id` that accepts either:
  - A full UUID → returns it as-is
  - An 8-char short code → finds the matching room by prefix and returns the full UUID

  The join flow calls this first, then passes the resolved UUID to match_join_room.

  ## Security
  - Function runs as SECURITY DEFINER to read match_rooms
  - Only returns the room UUID (no sensitive data)
  - Only matches rooms with status 'waiting' or 'playing' (not cancelled/finished)
  - Rate limiting handled by existing match_join_room RPC
*/

CREATE OR REPLACE FUNCTION match_resolve_room_id(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_normalized text;
BEGIN
  -- Strip dashes and spaces, uppercase
  v_normalized := upper(regexp_replace(trim(p_code), '[^0-9a-fA-F]', '', 'g'));

  -- If it looks like a full UUID (32 hex chars), parse directly
  IF length(v_normalized) = 32 THEN
    v_room_id := (
      substring(v_normalized, 1, 8) || '-' ||
      substring(v_normalized, 9, 4) || '-' ||
      substring(v_normalized, 13, 4) || '-' ||
      substring(v_normalized, 17, 4) || '-' ||
      substring(v_normalized, 21, 12)
    )::uuid;
    RETURN v_room_id;
  END IF;

  -- Short code: find room whose UUID starts with these hex chars
  IF length(v_normalized) BETWEEN 6 AND 12 THEN
    SELECT id INTO v_room_id
    FROM match_rooms
    WHERE replace(id::text, '-', '') ILIKE (v_normalized || '%')
      AND status IN ('waiting', 'playing')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
      RETURN v_room_id;
    END IF;
  END IF;

  RAISE EXCEPTION 'room_not_found';
END;
$$;

GRANT EXECUTE ON FUNCTION match_resolve_room_id(text) TO authenticated, anon;
