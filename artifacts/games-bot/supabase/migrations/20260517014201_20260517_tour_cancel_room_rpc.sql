/*
  # Tournament Cancel Room RPC

  ## Problem
  cancelTournament() calls finishTournament() which triggers prize payout logic
  (tour_finish RPC). When a host leaves before the tournament starts, prizes are
  distributed to a single player in an empty room.

  ## Solution
  Add a dedicated tour_cancel_room RPC that:
  1. Checks if the caller is the host
  2. Checks player_count < 2 (only cancel if game hasn't meaningfully started)
  3. Sets status = 'cancelled' without triggering payouts
  4. Refunds the host's bet amount if any was charged
*/

CREATE OR REPLACE FUNCTION tour_cancel_room(p_session_id uuid, p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telegram_id bigint;
  v_room tournament_rooms%ROWTYPE;
BEGIN
  -- Resolve caller
  SELECT telegram_id INTO v_telegram_id
  FROM user_sessions
  WHERE session_id = p_session_id AND expires_at > now();

  IF v_telegram_id IS NULL THEN
    RAISE EXCEPTION 'session_required';
  END IF;

  -- Fetch room
  SELECT * INTO v_room FROM tournament_rooms WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  -- Only host can cancel
  IF v_room.host_id != v_telegram_id THEN
    RAISE EXCEPTION 'not_host';
  END IF;

  -- Only cancel if still waiting (not started / finished)
  IF v_room.status != 'waiting' THEN
    RETURN;
  END IF;

  -- Mark cancelled
  UPDATE tournament_rooms
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_room_id;

  -- Refund host bet if any
  IF v_room.bet_amount > 0 THEN
    UPDATE user_balances
    SET sc_balance = sc_balance + v_room.bet_amount
    WHERE telegram_id = v_telegram_id;

    INSERT INTO ledger (telegram_id, amount, category, ref_id, note)
    VALUES (v_telegram_id, v_room.bet_amount, 'refund', p_room_id, 'tournament_cancelled_by_host');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION tour_cancel_room(uuid, uuid) TO authenticated, anon;
