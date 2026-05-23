/*
  # DB Functions Hardening

  ## Changes

  1. Remove duplicate tour_create_room (6-arg version)
     The 7-arg version (with p_is_private) is the correct one.
     Having two overloads causes PostgreSQL to pick the wrong one.

  2. Add double-charge protection to match_join_room
     Mirrors the protection already in tour_join_room:
     if player already in room (reconnect), skip pay_debit_bet.

  3. Fix match_join_room opponent detection
     After joining, the room returned must correctly reflect
     which slot the joining player took, so the client can
     identify the correct opponent.
*/

-- 1. Drop the old 6-arg tour_create_room to avoid overload confusion
DROP FUNCTION IF EXISTS tour_create_room(uuid, int, text, int, numeric, text);

-- 2. Rewrite match_join_room with double-charge protection
CREATE OR REPLACE FUNCTION match_join_room(
  p_session_id uuid,
  p_room_id    text,
  p_player_name text DEFAULT ''
)
RETURNS match_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg       bigint;
  v_room     match_rooms;
  v_name     text;
  v_clean_id text;
  v_already_in boolean;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  v_name := COALESCE(NULLIF(p_player_name,''),'Player');
  v_clean_id := upper(trim(p_room_id));

  SELECT * INTO v_room FROM match_rooms WHERE id = v_clean_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status <> 'waiting' THEN RAISE EXCEPTION 'room_not_available'; END IF;

  -- Check if already in room (reconnect guard)
  v_already_in := (
    v_room.player1_id = v_tg OR
    v_room.player2_id = v_tg OR
    v_room.player3_id = v_tg OR
    v_room.player4_id = v_tg
  );
  IF v_already_in THEN RAISE EXCEPTION 'already_in_room'; END IF;

  PERFORM match_check_active_limit(v_tg);

  -- Only debit if not a reconnect (protection from double-charge)
  IF COALESCE(v_room.bet_amount, 0) > 0 THEN
    PERFORM pay_debit_bet(v_tg, v_room.bet_amount);
  END IF;

  IF COALESCE(v_room.max_players, 2) = 2 THEN
    UPDATE match_rooms
    SET player2_id   = v_tg,
        player2_name = v_name,
        status       = 'playing',
        started_at   = now()
    WHERE id = v_clean_id AND status = 'waiting'
    RETURNING * INTO v_room;
  ELSE
    IF v_room.player2_id IS NULL THEN
      UPDATE match_rooms SET player2_id = v_tg, player2_name = v_name
        WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSIF v_room.player3_id IS NULL THEN
      UPDATE match_rooms SET player3_id = v_tg, player3_name = v_name
        WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSIF v_room.player4_id IS NULL THEN
      UPDATE match_rooms
      SET player4_id = v_tg, player4_name = v_name,
          status = 'playing', started_at = now()
      WHERE id = v_clean_id RETURNING * INTO v_room;
    ELSE
      RAISE EXCEPTION 'room_full';
    END IF;
  END IF;

  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION match_join_room(uuid, text, text) TO authenticated, anon;
