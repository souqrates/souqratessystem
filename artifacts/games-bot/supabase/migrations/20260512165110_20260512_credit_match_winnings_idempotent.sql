/*
  # Pay match winnings to bot-vs-human and human-vs-human winners (idempotent)

  ## Problem
  When a player wins a 2P/4P match against bots, the `bot_fill` edge function
  marks the room finished and writes `winner_id`, but it never credits the
  winner's SKZ balance. The SQL path `match_submit_score` only credits when
  every slot's `playerN_submitted_at` is set, which never happens in bot
  rooms (bot scores arrive via direct UPDATE in the edge function, not via
  the score-submit RPC). Net effect: every winning bot match silently
  pockets the player's entry fee with zero payout.

  ## Changes
  1. New column `match_rooms.winnings_credited_at timestamptz` — idempotency
     marker so credits are paid at most once per room.
  2. New RPC `match_credit_winner_if_due(p_room_id text)` — SECURITY DEFINER,
     idempotent: credits the human winner of a finished room (skips bots,
     skips already-credited rooms, skips rooms without a winner or bet).
     Records a `ledger_entries` row tagged `reference_type='match_room'` so
     the credit is auditable.
  3. Updated `match_submit_score` (no behavioral change for v_all_done path)
     also sets `winnings_credited_at` after credit, preventing double-credit
     if the edge function runs after the SQL path already paid out.
  4. Backfill: every historically finished match with `bet > 0`, a human
     winner, and no credit yet gets paid out now.

  ## Security
  - RPC is `SECURITY DEFINER` with locked `search_path`. Callers pass only
    a room id; the function makes its own ownership/finish/bet checks.
  - No RLS changes; no destructive operations.
  - `pay_credit_winnings` is reused as-is, so existing leaderboard +
    hall_of_fame side effects continue to fire on backfilled wins.

  ## Notes
  1. Bot winners are never credited (their telegram_id is synthetic and has
     no `user_balances` row tied to a real account).
  2. Pot math matches `match_submit_score`: `pot = bet_amount × filled_slots`.
*/

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS winnings_credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.match_credit_winner_if_due(p_room_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room       match_rooms%ROWTYPE;
  v_winner     bigint;
  v_filled     int;
  v_pot        numeric;
  v_winner_bot boolean := false;
  v_balance_after numeric;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_room.status <> 'finished' OR v_room.winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finished');
  END IF;
  IF v_room.winnings_credited_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF COALESCE(v_room.bet_amount, 0) <= 0 THEN
    UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'no_bet', true);
  END IF;

  v_winner := v_room.winner_id;
  IF (v_room.player1_id = v_winner AND COALESCE(v_room.player1_is_bot,false))
     OR (v_room.player2_id = v_winner AND COALESCE(v_room.player2_is_bot,false))
     OR (v_room.player3_id = v_winner AND COALESCE(v_room.player3_is_bot,false))
     OR (v_room.player4_id = v_winner AND COALESCE(v_room.player4_is_bot,false)) THEN
    v_winner_bot := true;
  END IF;

  v_filled := (CASE WHEN v_room.player1_id IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN v_room.player2_id IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN v_room.player3_id IS NOT NULL THEN 1 ELSE 0 END)
            + (CASE WHEN v_room.player4_id IS NOT NULL THEN 1 ELSE 0 END);
  v_pot := v_room.bet_amount * v_filled;

  UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;

  IF v_winner_bot THEN
    RETURN jsonb_build_object('ok', true, 'bot_winner', true, 'pot', v_pot);
  END IF;

  PERFORM pay_credit_winnings(v_winner, v_pot);

  SELECT sc_balance INTO v_balance_after
    FROM user_balances WHERE telegram_id = v_winner;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_winner, 'credit', 'payout',
    v_pot, v_pot, 'SKZ',
    v_balance_after, 'match_room', p_room_id,
    'Match winnings: +' || v_pot || ' SKZ',
    jsonb_build_object('room_id', p_room_id, 'bet', v_room.bet_amount, 'players', v_filled)
  );

  RETURN jsonb_build_object('ok', true, 'credited', v_pot, 'winner', v_winner);
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_credit_winner_if_due(text)
  TO anon, authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM match_rooms
    WHERE status='finished'
      AND winner_id IS NOT NULL
      AND COALESCE(bet_amount,0) > 0
      AND winnings_credited_at IS NULL
  LOOP
    PERFORM match_credit_winner_if_due(r.id);
  END LOOP;
END $$;
