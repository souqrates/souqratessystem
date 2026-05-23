/*
  # Fix match_resolve_room_id to search both match_rooms and tournament_rooms

  ## Problem
  The resolve function only searched match_rooms for short-code prefix lookups.
  Tournament/group rooms exist in tournament_rooms, so short codes for those
  always returned room_not_found.

  Additionally, match_join_room and tour_join_room accept p_room_id as text
  but do WHERE id = p_room_id which implicitly casts to uuid — causing
  "invalid input syntax for type uuid" when receiving a short code.

  ## Solution
  1. Update match_resolve_room_id to search BOTH tables for short codes
  2. Update match_join_room to call match_resolve_room_id internally
  3. Update tour_join_room to call match_resolve_room_id internally
  
  This makes all join paths resilient to short codes, full UUIDs, and
  UUIDs without dashes.
*/

-- 1. Update resolve to search both tables
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
  -- Try direct UUID cast first
  BEGIN
    v_room_id := p_code::uuid;
    RETURN v_room_id;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL;
  END;

  -- Strip non-hex chars and uppercase
  v_stripped := upper(regexp_replace(trim(p_code), '[^0-9a-fA-F]', '', 'g'));

  -- 32 hex chars = reassemble as UUID
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

  -- Short code: prefix search in match_rooms first
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

    -- Then search tournament_rooms
    SELECT id INTO v_room_id
    FROM tournament_rooms
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

-- 2. Update match_join_room to resolve codes internally
CREATE OR REPLACE FUNCTION match_join_room(
  p_session_id uuid,
  p_room_id text,
  p_player_name text DEFAULT ''
)
RETURNS match_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
  v_room match_rooms;
  v_name text;
  v_resolved_id uuid;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  v_name := COALESCE(NULLIF(p_player_name,''),'Player');

  -- Resolve short code / stripped UUID to proper UUID
  v_resolved_id := match_resolve_room_id(p_room_id);

  SELECT * INTO v_room FROM match_rooms WHERE id = v_resolved_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status <> 'waiting' THEN RAISE EXCEPTION 'room_not_available'; END IF;
  IF v_room.player1_id = v_tg
  OR v_room.player2_id = v_tg
  OR v_room.player3_id = v_tg
  OR v_room.player4_id = v_tg THEN
    RAISE EXCEPTION 'already_in_room';
  END IF;

  PERFORM match_check_active_limit(v_tg);

  IF COALESCE(v_room.bet_amount, 0) > 0 THEN
    PERFORM pay_debit_bet(v_tg, v_room.bet_amount);
  END IF;

  IF COALESCE(v_room.max_players, 2) = 2 THEN
    UPDATE match_rooms
    SET player2_id = v_tg,
        player2_name = v_name,
        status = 'playing',
        started_at = now()
    WHERE id = v_resolved_id AND status = 'waiting'
    RETURNING * INTO v_room;
  ELSE
    IF v_room.player2_id IS NULL THEN
      UPDATE match_rooms SET player2_id = v_tg, player2_name = v_name WHERE id = v_resolved_id RETURNING * INTO v_room;
    ELSIF v_room.player3_id IS NULL THEN
      UPDATE match_rooms SET player3_id = v_tg, player3_name = v_name WHERE id = v_resolved_id RETURNING * INTO v_room;
    ELSIF v_room.player4_id IS NULL THEN
      UPDATE match_rooms SET player4_id = v_tg, player4_name = v_name, status = 'playing', started_at = now() WHERE id = v_resolved_id RETURNING * INTO v_room;
    ELSE
      RAISE EXCEPTION 'room_full';
    END IF;
  END IF;

  RETURN v_room;
END;
$$;

-- 3. Update tour_join_room to resolve codes internally
CREATE OR REPLACE FUNCTION tour_join_room(
  p_session_id uuid,
  p_room_id text,
  p_player_name text DEFAULT ''
)
RETURNS tournament_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg bigint;
  v_room tournament_rooms;
  v_inserted boolean := false;
  v_resolved_id uuid;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  -- Resolve short code / stripped UUID to proper UUID
  v_resolved_id := match_resolve_room_id(p_room_id);

  SELECT * INTO v_room FROM tournament_rooms WHERE id = v_resolved_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status = 'finished' THEN RAISE EXCEPTION 'tournament_ended'; END IF;
  IF v_room.status = 'playing' THEN RAISE EXCEPTION 'tournament_started'; END IF;

  -- only debit if this is a new join
  IF NOT EXISTS (SELECT 1 FROM tournament_players WHERE room_id = v_resolved_id AND player_id = v_tg) THEN
    IF COALESCE(v_room.bet_amount, 0) > 0 THEN
      PERFORM pay_debit_bet(v_tg, v_room.bet_amount);
    END IF;
  END IF;

  INSERT INTO tournament_players(room_id, player_id, player_name)
  VALUES (v_resolved_id, v_tg, COALESCE(NULLIF(p_player_name,''),'Player'))
  ON CONFLICT (room_id, player_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    UPDATE tournament_rooms
    SET player_count = (SELECT COUNT(*) FROM tournament_players WHERE room_id = v_resolved_id)
    WHERE id = v_resolved_id
    RETURNING * INTO v_room;
  END IF;
  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION match_resolve_room_id(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION match_join_room(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION tour_join_room(uuid, text, text) TO authenticated, anon;
