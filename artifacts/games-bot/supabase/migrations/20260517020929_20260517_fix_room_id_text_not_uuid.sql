/*
  # Fix room ID handling: IDs are short text codes, NOT UUIDs

  ## Discovery
  - match_rooms.id = 10-char uppercase hex (e.g. "5ADBA71453")
  - tournament_rooms.id = 6-char uppercase hex (e.g. "AA352A")
  - Neither table uses UUIDs

  ## Problem
  match_resolve_room_id tried to cast codes as UUID, causing
  "invalid input syntax for type uuid" errors.
  match_join_room and tour_join_room called match_resolve_room_id
  which returned uuid, but the actual columns are text.

  ## Solution
  1. Rewrite match_resolve_room_id to accept text and return text
     (simple direct lookup in both tables, no UUID casting)
  2. Rewrite match_join_room to use the text ID directly
  3. Rewrite tour_join_room to use the text ID directly
*/

-- 1. Drop old function that returns uuid
DROP FUNCTION IF EXISTS match_resolve_room_id(text);

-- Recreate as text → text
CREATE OR REPLACE FUNCTION match_resolve_room_id(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_room_id text;
BEGIN
  v_clean := upper(trim(p_code));

  -- Direct lookup in match_rooms
  SELECT id INTO v_room_id
  FROM match_rooms
  WHERE id = v_clean AND status IN ('waiting', 'playing');

  IF v_room_id IS NOT NULL THEN RETURN v_room_id; END IF;

  -- Direct lookup in tournament_rooms
  SELECT id INTO v_room_id
  FROM tournament_rooms
  WHERE id = v_clean AND status IN ('waiting', 'playing');

  IF v_room_id IS NOT NULL THEN RETURN v_room_id; END IF;

  RAISE EXCEPTION 'room_not_found';
END;
$$;

GRANT EXECUTE ON FUNCTION match_resolve_room_id(text) TO authenticated, anon;

-- 2. Rewrite match_join_room — p_room_id is a short text code
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
  v_clean_id text;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  v_name := COALESCE(NULLIF(p_player_name,''),'Player');
  v_clean_id := upper(trim(p_room_id));

  SELECT * INTO v_room FROM match_rooms WHERE id = v_clean_id FOR UPDATE;
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
    WHERE id = v_clean_id AND status = 'waiting'
    RETURNING * INTO v_room;
  ELSE
    IF v_room.player2_id IS NULL THEN
      UPDATE match_rooms SET player2_id = v_tg, player2_name = v_name WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSIF v_room.player3_id IS NULL THEN
      UPDATE match_rooms SET player3_id = v_tg, player3_name = v_name WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSIF v_room.player4_id IS NULL THEN
      UPDATE match_rooms SET player4_id = v_tg, player4_name = v_name, status = 'playing', started_at = now() WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSE
      RAISE EXCEPTION 'room_full';
    END IF;
  END IF;

  RETURN v_room;
END;
$$;

-- 3. Rewrite tour_join_room — p_room_id is a short text code
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
  v_clean_id text;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  v_clean_id := upper(trim(p_room_id));

  SELECT * INTO v_room FROM tournament_rooms WHERE id = v_clean_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status = 'finished' THEN RAISE EXCEPTION 'tournament_ended'; END IF;
  IF v_room.status = 'playing' THEN RAISE EXCEPTION 'tournament_started'; END IF;

  -- only debit if this is a new join
  IF NOT EXISTS (SELECT 1 FROM tournament_players WHERE room_id = v_clean_id AND player_id = v_tg) THEN
    IF COALESCE(v_room.bet_amount, 0) > 0 THEN
      PERFORM pay_debit_bet(v_tg, v_room.bet_amount);
    END IF;
  END IF;

  INSERT INTO tournament_players(room_id, player_id, player_name)
  VALUES (v_clean_id, v_tg, COALESCE(NULLIF(p_player_name,''),'Player'))
  ON CONFLICT (room_id, player_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    UPDATE tournament_rooms
    SET player_count = (SELECT COUNT(*) FROM tournament_players WHERE room_id = v_clean_id)
    WHERE id = v_clean_id
    RETURNING * INTO v_room;
  END IF;
  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION match_join_room(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION tour_join_room(uuid, text, text) TO authenticated, anon;
