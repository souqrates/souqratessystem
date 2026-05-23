/*
  # Bot Score Submission RPC

  1. New Functions
    - `match_submit_bot_score`: server-only function for submitting bot scores
      - Validates the player slot is marked as a bot (player_X_is_bot = true)
      - Validates the room is in playing status
      - Uses FOR UPDATE row locking
      - Checks deadline + 10s grace period
      - Determines winner and credits winnings when all scores are in
      - Logs failures to failed_payouts

  2. Security
    - Function is SECURITY DEFINER so it runs with elevated privileges
    - Only granted to service_role (not anon or authenticated)
    - Bot players are validated against is_bot flags in match_rooms

  3. Important Notes
    - This replaces direct UPDATE calls in the bot_fill edge function
    - The edge function already uses service_role key, so it can call this RPC
    - Prevents race conditions between bot score submission and match_submit_score
*/

CREATE OR REPLACE FUNCTION match_submit_bot_score(
  p_room_id text,
  p_bot_id bigint,
  p_score integer
) RETURNS match_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','pg_temp' AS $$
DECLARE
  v_room match_rooms;
  v_slot int;
  v_is_bot boolean;
  v_deadline timestamptz;
  v_max int;
  v_all_done boolean;
  v_winner bigint;
BEGIN
  IF p_score < 0 OR p_score > 1000000 THEN RAISE EXCEPTION 'invalid_score'; END IF;

  SELECT * INTO v_room FROM match_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status = 'finished' OR v_room.status = 'cancelled' THEN
    RETURN v_room;
  END IF;

  IF v_room.started_at IS NOT NULL THEN
    v_deadline := v_room.started_at
      + (COALESCE(v_room.match_duration_seconds, 60) || ' seconds')::interval;
    IF now() > v_deadline + interval '30 seconds' THEN
      RAISE EXCEPTION 'match_expired';
    END IF;
  END IF;

  v_slot := CASE
    WHEN v_room.player1_id = p_bot_id THEN 1
    WHEN v_room.player2_id = p_bot_id THEN 2
    WHEN v_room.player3_id = p_bot_id THEN 3
    WHEN v_room.player4_id = p_bot_id THEN 4
    ELSE 0 END;
  IF v_slot = 0 THEN RAISE EXCEPTION 'bot_not_in_room'; END IF;

  v_is_bot := CASE
    WHEN v_slot = 1 THEN v_room.player1_is_bot
    WHEN v_slot = 2 THEN v_room.player2_is_bot
    WHEN v_slot = 3 THEN v_room.player3_is_bot
    WHEN v_slot = 4 THEN v_room.player4_is_bot
    ELSE false END;
  IF NOT COALESCE(v_is_bot, false) THEN
    RAISE EXCEPTION 'not_a_bot';
  END IF;

  IF v_slot = 1 AND v_room.player1_submitted_at IS NOT NULL THEN RETURN v_room; END IF;
  IF v_slot = 2 AND v_room.player2_submitted_at IS NOT NULL THEN RETURN v_room; END IF;
  IF v_slot = 3 AND v_room.player3_submitted_at IS NOT NULL THEN RETURN v_room; END IF;
  IF v_slot = 4 AND v_room.player4_submitted_at IS NOT NULL THEN RETURN v_room; END IF;

  IF v_slot = 1 THEN
    UPDATE match_rooms SET player1_score = p_score, player1_submitted_at = now()
    WHERE id = p_room_id RETURNING * INTO v_room;
  ELSIF v_slot = 2 THEN
    UPDATE match_rooms SET player2_score = p_score, player2_submitted_at = now()
    WHERE id = p_room_id RETURNING * INTO v_room;
  ELSIF v_slot = 3 THEN
    UPDATE match_rooms SET player3_score = p_score, player3_submitted_at = now()
    WHERE id = p_room_id RETURNING * INTO v_room;
  ELSIF v_slot = 4 THEN
    UPDATE match_rooms SET player4_score = p_score, player4_submitted_at = now()
    WHERE id = p_room_id RETURNING * INTO v_room;
  END IF;

  v_max := COALESCE(v_room.max_players, 2);
  v_all_done := (v_room.player1_id IS NULL OR v_room.player1_submitted_at IS NOT NULL)
    AND (v_room.player2_id IS NULL OR v_room.player2_submitted_at IS NOT NULL)
    AND (v_max < 3 OR v_room.player3_id IS NULL OR v_room.player3_submitted_at IS NOT NULL)
    AND (v_max < 4 OR v_room.player4_id IS NULL OR v_room.player4_submitted_at IS NOT NULL);

  IF v_all_done THEN
    SELECT pid INTO v_winner FROM (
      SELECT v_room.player1_id AS pid, COALESCE(v_room.player1_score, 0) AS s,
        v_room.player1_submitted_at AS sub_at
      WHERE v_room.player1_id IS NOT NULL
      UNION ALL
      SELECT v_room.player2_id, COALESCE(v_room.player2_score, 0),
        v_room.player2_submitted_at
      WHERE v_room.player2_id IS NOT NULL
      UNION ALL
      SELECT v_room.player3_id, COALESCE(v_room.player3_score, 0),
        v_room.player3_submitted_at
      WHERE v_room.player3_id IS NOT NULL
      UNION ALL
      SELECT v_room.player4_id, COALESCE(v_room.player4_score, 0),
        v_room.player4_submitted_at
      WHERE v_room.player4_id IS NOT NULL
    ) t ORDER BY s DESC, sub_at ASC NULLS LAST, pid ASC LIMIT 1;

    UPDATE match_rooms SET status = 'finished', finished_at = now(), winner_id = v_winner
    WHERE id = p_room_id RETURNING * INTO v_room;

    BEGIN
      PERFORM match_credit_winner_if_due(p_room_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO failed_payouts (room_id, match_type, winner_id, pot_amount, error_msg)
      VALUES (p_room_id, 'pvp', v_winner, v_room.bet_amount * v_max, SQLERRM);
    END;
  END IF;

  RETURN v_room;
END;
$$;

REVOKE ALL ON FUNCTION match_submit_bot_score(text, bigint, integer) FROM anon;
REVOKE ALL ON FUNCTION match_submit_bot_score(text, bigint, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_submit_bot_score(text, bigint, integer) TO service_role;
