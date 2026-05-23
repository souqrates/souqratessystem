/*
  # Fix match_resolve_room_id: accept full UUID with dashes directly

  ## Problem
  When a full UUID like "a4d743e7-4e..." is passed after stripping dashes
  it becomes "a4d743e74e..." (32 hex chars) and the code tries to re-insert
  dashes in the right positions to cast to uuid — this works correctly.

  BUT the old client code was stripping dashes BEFORE calling the RPC,
  so the RPC received "A4D743E74E..." (10 chars, short code path) which
  it tried to match via ILIKE prefix — working fine.

  The NEW client sends the raw initialJoinCode (may include dashes) directly.
  We must handle:
  1. Full UUID with dashes: "a4d743e7-4e12-..." → cast directly
  2. 32 hex chars without dashes → re-insert dashes and cast
  3. Short code (6-12 hex chars) → prefix search

  This migration replaces the function to handle all three cases safely.
*/

CREATE OR REPLACE FUNCTION match_resolve_room_id(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_stripped text;
BEGIN
  -- Try direct UUID cast first (handles "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
  BEGIN
    v_room_id := p_code::uuid;
    RETURN v_room_id;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- not a valid UUID, fall through
  END;

  -- Strip non-hex chars and uppercase
  v_stripped := upper(regexp_replace(trim(p_code), '[^0-9a-fA-F]', '', 'g'));

  -- 32 hex chars → reassemble as UUID
  IF length(v_stripped) = 32 THEN
    v_room_id := (
      substring(v_stripped, 1, 8)  || '-' ||
      substring(v_stripped, 9, 4)  || '-' ||
      substring(v_stripped, 13, 4) || '-' ||
      substring(v_stripped, 17, 4) || '-' ||
      substring(v_stripped, 21, 12)
    )::uuid;
    RETURN v_room_id;
  END IF;

  -- Short code: prefix search among open rooms
  IF length(v_stripped) BETWEEN 6 AND 12 THEN
    SELECT id INTO v_room_id
    FROM match_rooms
    WHERE replace(id::text, '-', '') ILIKE (v_stripped || '%')
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
