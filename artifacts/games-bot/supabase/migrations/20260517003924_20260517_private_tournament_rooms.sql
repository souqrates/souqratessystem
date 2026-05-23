/*
  # Add Private Room Support to Tournament Rooms

  ## Summary
  Extends the group/tournament system to support private rooms, matching
  the existing private room capability that match_rooms already has.

  ## Changes

  ### tournament_rooms table
  - New column `is_private boolean DEFAULT false` — when true, quick-join
    scanning skips this room and bots are not auto-injected.

  ### tour_create_room RPC
  - Extended with `p_is_private boolean DEFAULT false` parameter.
  - Backward-compatible: existing callers that don't pass the param continue
    to create public tournaments.

  ### Index
  - Partial index on tournament_rooms for fast public-only waiting room scans.

  ## Security
  - No RLS changes. Existing policies remain intact.
*/

-- 1. Add is_private column to tournament_rooms
ALTER TABLE tournament_rooms
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- 2. Fast scan index: quick-join only looks at public waiting rooms
CREATE INDEX IF NOT EXISTS idx_tournament_rooms_public_waiting
  ON tournament_rooms (game_id, status, created_at)
  WHERE status = 'waiting' AND is_private = false;

-- 3. Recreate tour_create_room with is_private support
CREATE OR REPLACE FUNCTION public.tour_create_room(
  p_session_id      uuid,
  p_game_id         integer,
  p_game_name       text,
  p_duration_seconds integer DEFAULT 60,
  p_bet_amount      numeric  DEFAULT 0,
  p_host_name       text     DEFAULT '',
  p_is_private      boolean  DEFAULT false
)
RETURNS tournament_rooms
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg   bigint;
  v_room tournament_rooms;
BEGIN
  -- resolve caller
  SELECT telegram_id INTO v_tg
    FROM telegram_sessions
   WHERE id = p_session_id
     AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RAISE EXCEPTION 'session_required'; END IF;

  INSERT INTO tournament_rooms (
    game_id, game_name, host_id, host_name,
    duration_seconds, bet_amount,
    is_private, status
  ) VALUES (
    p_game_id, p_game_name, v_tg, p_host_name,
    p_duration_seconds, p_bet_amount,
    p_is_private, 'waiting'
  ) RETURNING * INTO v_room;

  -- auto-join host
  INSERT INTO tournament_players (room_id, player_id, player_name)
  VALUES (v_room.id, v_tg, p_host_name)
  ON CONFLICT (room_id, player_id) DO NOTHING;

  UPDATE tournament_rooms SET player_count = 1 WHERE id = v_room.id;
  v_room.player_count := 1;

  RETURN v_room;
END;
$$;
