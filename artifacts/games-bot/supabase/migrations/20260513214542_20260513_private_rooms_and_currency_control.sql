/*
  # Private Rooms, Custom Entry Fees, House Cut, and Currency Control

  ## Summary
  Adds support for "Private Rooms" — closed competitions a player creates
  for friends only. Private rooms must never receive auto-bot fill. The
  creator can pick the entry fee from a list of preset values; every
  joining player pays the same fee, and the room finishes with a single
  winner who takes the pot minus a fixed 30% house cut (configurable).

  ## Tables modified
  - `match_rooms`:
      - new column `is_private boolean default false` — when true the
        bot_fill edge function and client-side bot-injection logic must
        skip this room.
      - new column `house_cut_percent numeric default 0` — taken off the
        winner's gross payout in `match_credit_winner_if_due`. For public
        rooms this stays 0; for private rooms it defaults to 30.

  ## RPCs replaced (signatures extended, defaults preserve old behaviour)
  - `match_create_room(...)` — added `p_is_private boolean default false`
    and `p_house_cut_percent numeric default 0`. Existing callers that
    do not pass these arguments continue to create public rooms.
  - `match_credit_winner_if_due(p_room_id text)` — applies the room's
    `house_cut_percent` to the pot before crediting the winner.

  ## Economy settings (new keys, all public/safe to expose)
  - `private_room_default_house_cut_percent` (default 30) — used by client
    when creating a private room without an explicit cut.
  - `private_room_min_entry_sc` (default 50)
  - `private_room_max_entry_sc` (default 100000)

  ## Security
  - All new columns default to safe values (is_private=false, cut=0) so
    pre-existing rooms keep behaving exactly as before.
  - RPC signature changes use default values so older clients remain
    compatible.
  - No RLS changes; insert path still goes through SECURITY DEFINER RPCs.

  ## Notes
  - `match_credit_winner_if_due` is the canonical credit path used by
    both the bot_fill edge function and the human-vs-human submit path.
    Applying the cut here guarantees one consistent payout rule.
*/

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS house_cut_percent numeric DEFAULT 0;

-- Economy settings (public, safe to expose to client)
INSERT INTO economy_settings (key, value, value_type, category, label, is_public)
VALUES
  ('private_room_default_house_cut_percent','30','number','fees','Private Room House Cut %', true),
  ('private_room_min_entry_sc','50','number','limits','Private Room Min Entry (SKZ)', true),
  ('private_room_max_entry_sc','100000','number','limits','Private Room Max Entry (SKZ)', true)
ON CONFLICT (key) DO NOTHING;

-- Drop+recreate create_room to widen signature (old signature is removed
-- safely; new defaults preserve the previous 2P/public behaviour).
DROP FUNCTION IF EXISTS public.match_create_room(uuid, integer, numeric, integer, integer, text);

CREATE OR REPLACE FUNCTION public.match_create_room(
  p_session_id uuid,
  p_game_id integer,
  p_bet_amount numeric DEFAULT 0,
  p_max_players integer DEFAULT 2,
  p_duration_seconds integer DEFAULT 60,
  p_player_name text DEFAULT '',
  p_is_private boolean DEFAULT false,
  p_house_cut_percent numeric DEFAULT 0
) RETURNS match_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tg bigint;
  v_room match_rooms;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF p_max_players NOT IN (2,4) THEN RAISE EXCEPTION 'invalid_max_players'; END IF;
  IF p_duration_seconds < 15 OR p_duration_seconds > 600 THEN RAISE EXCEPTION 'invalid_duration'; END IF;
  IF p_bet_amount < 0 THEN RAISE EXCEPTION 'invalid_bet'; END IF;
  IF p_house_cut_percent < 0 OR p_house_cut_percent > 90 THEN RAISE EXCEPTION 'invalid_house_cut'; END IF;

  IF p_bet_amount > 0 THEN
    PERFORM pay_debit_bet(v_tg, p_bet_amount);
  END IF;

  INSERT INTO match_rooms(
    game_id, player1_id, player1_name, bet_amount, status,
    max_players, match_duration_seconds, is_private, house_cut_percent
  )
  VALUES (
    p_game_id, v_tg, COALESCE(NULLIF(p_player_name,''),'Player'),
    p_bet_amount, 'waiting',
    p_max_players, p_duration_seconds,
    COALESCE(p_is_private, false),
    COALESCE(p_house_cut_percent, 0)
  )
  RETURNING * INTO v_room;
  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_create_room(uuid, integer, numeric, integer, integer, text, boolean, numeric)
  TO anon, authenticated, service_role;

-- Replace credit-winner RPC: apply per-room house cut on private rooms.
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
  v_cut        numeric;
  v_net_pot    numeric;
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
  v_pot     := v_room.bet_amount * v_filled;
  v_cut     := ROUND(v_pot * COALESCE(v_room.house_cut_percent, 0) / 100.0, 2);
  v_net_pot := GREATEST(0, v_pot - v_cut);

  UPDATE match_rooms SET winnings_credited_at = now() WHERE id = p_room_id;

  IF v_winner_bot THEN
    RETURN jsonb_build_object('ok', true, 'bot_winner', true, 'pot', v_pot, 'house_cut', v_cut);
  END IF;

  PERFORM pay_credit_winnings(v_winner, v_net_pot);

  SELECT sc_balance INTO v_balance_after
    FROM user_balances WHERE telegram_id = v_winner;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_winner, 'credit', 'payout',
    v_net_pot, v_net_pot, 'SKZ',
    v_balance_after, 'match_room', p_room_id,
    'Match winnings: +' || v_net_pot || ' SKZ' ||
      CASE WHEN v_cut > 0 THEN ' (after ' || v_cut || ' SKZ house cut)' ELSE '' END,
    jsonb_build_object(
      'room_id', p_room_id,
      'bet', v_room.bet_amount,
      'players', v_filled,
      'pot_gross', v_pot,
      'house_cut', v_cut,
      'is_private', v_room.is_private
    )
  );

  RETURN jsonb_build_object('ok', true, 'credited', v_net_pot, 'gross', v_pot, 'house_cut', v_cut, 'winner', v_winner);
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_credit_winner_if_due(text)
  TO anon, authenticated, service_role;
