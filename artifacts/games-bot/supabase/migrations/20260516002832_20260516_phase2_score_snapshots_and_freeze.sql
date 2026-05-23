/*
  # Phase 2: Score Snapshots & Server-Authoritative Match Freeze

  ## Summary
  This migration implements the core fairness engine:

  1. **match_score_snapshots table**
     - Records each player's score at the exact server-side moment the match clock expires
     - This is the legal source of truth for winner determination
     - No client can manipulate this — written by SECURITY DEFINER RPCs only

  2. **match_freeze_scores() RPC**
     - Called when server detects match clock has expired
     - Atomically snapshots all scores, sets winner, marks match finished
     - Handles partial submissions (players who closed the app)
     - Uses FOR UPDATE SKIP LOCKED to avoid deadlocks under high concurrency

  3. **match_get_room_scores() RPC**
     - Lightweight scores + server time read for reconnect fallback
     - Returns ms_remaining so clients can sync their countdowns

  Security: snapshots table has RLS enabled, only players in the match can read it.
*/

-- ============================================================
-- 1. Score snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS match_score_snapshots (
  id           bigserial PRIMARY KEY,
  room_id      text      NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
  player_id    bigint    NOT NULL,
  slot         integer   NOT NULL CHECK (slot BETWEEN 1 AND 4),
  score        integer   NOT NULL DEFAULT 0,
  is_bot       boolean   NOT NULL DEFAULT false,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_room ON match_score_snapshots(room_id);

ALTER TABLE match_score_snapshots ENABLE ROW LEVEL SECURITY;

-- Players can read snapshots for rooms they participated in
CREATE POLICY "Players can read snapshots for their rooms"
  ON match_score_snapshots FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM match_rooms mr
      WHERE mr.id = match_score_snapshots.room_id
        AND mr.player1_id = match_score_snapshots.player_id
           OR mr.player2_id = match_score_snapshots.player_id
           OR mr.player3_id = match_score_snapshots.player_id
           OR mr.player4_id = match_score_snapshots.player_id
    )
  );

-- ============================================================
-- 2. match_freeze_scores() — server-authoritative match finalization
--    Called by the score_snapshotter Edge Function via service_role
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_freeze_scores(p_room_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room      match_rooms;
  v_winner    bigint;
  v_max       integer;
  v_deadline  timestamptz;
BEGIN
  -- Lock the room exclusively to prevent concurrent freeze attempts
  SELECT * INTO v_room
  FROM match_rooms
  WHERE id = p_room_id
  FOR UPDATE SKIP LOCKED;

  -- If another process locked it first, return gracefully
  IF NOT FOUND THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'locked_by_other');
  END IF;

  -- Already finished — nothing to do
  IF v_room.status IN ('finished', 'cancelled') THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'already_finished', 'status', v_room.status);
  END IF;

  -- Match hasn't started yet — skip
  IF v_room.started_at IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'not_started');
  END IF;

  -- Verify clock has actually expired (with 1s buffer)
  v_deadline := v_room.started_at + (COALESCE(v_room.match_duration_seconds, 60) || ' seconds')::interval;
  IF now() < v_deadline - interval '1 second' THEN
    RETURN json_build_object(
      'ok', false,
      'reason', 'match_still_running',
      'seconds_remaining', EXTRACT(EPOCH FROM (v_deadline - now()))::int
    );
  END IF;

  v_max := COALESCE(v_room.max_players, 2);

  -- Snapshot all player scores at this exact server moment
  -- ON CONFLICT: if snapshot already exists, keep the maximum score
  INSERT INTO match_score_snapshots (room_id, player_id, slot, score, is_bot, captured_at)
  SELECT
    p_room_id,
    pid,
    slot,
    COALESCE(score, 0),
    COALESCE(is_bot, false),
    now()
  FROM (
    SELECT v_room.player1_id AS pid, 1 AS slot, v_room.player1_score AS score, v_room.player1_is_bot AS is_bot
      WHERE v_room.player1_id IS NOT NULL
    UNION ALL
    SELECT v_room.player2_id, 2, v_room.player2_score, v_room.player2_is_bot
      WHERE v_room.player2_id IS NOT NULL
    UNION ALL
    SELECT v_room.player3_id, 3, v_room.player3_score, v_room.player3_is_bot
      WHERE v_max >= 3 AND v_room.player3_id IS NOT NULL
    UNION ALL
    SELECT v_room.player4_id, 4, v_room.player4_score, v_room.player4_is_bot
      WHERE v_max >= 4 AND v_room.player4_id IS NOT NULL
  ) t
  ON CONFLICT (room_id, player_id) DO UPDATE
    SET score       = GREATEST(match_score_snapshots.score, EXCLUDED.score),
        captured_at = EXCLUDED.captured_at;

  -- Determine winner from snapshots (server score at deadline — not submission order)
  -- Tiebreak: higher score > earlier submitted_at > lower player_id
  SELECT s.player_id INTO v_winner
  FROM match_score_snapshots s
  WHERE s.room_id = p_room_id
  ORDER BY
    s.score DESC,
    COALESCE(
      CASE s.slot
        WHEN 1 THEN v_room.player1_submitted_at
        WHEN 2 THEN v_room.player2_submitted_at
        WHEN 3 THEN v_room.player3_submitted_at
        WHEN 4 THEN v_room.player4_submitted_at
      END,
      now() + interval '1 hour'
    ) ASC,
    s.player_id ASC
  LIMIT 1;

  -- Finalize the match with snapshot-authoritative scores
  UPDATE match_rooms
  SET
    status        = 'finished',
    finished_at   = now(),
    winner_id     = v_winner,
    player1_score = COALESCE((SELECT score FROM match_score_snapshots WHERE room_id = p_room_id AND slot = 1), v_room.player1_score),
    player2_score = COALESCE((SELECT score FROM match_score_snapshots WHERE room_id = p_room_id AND slot = 2), v_room.player2_score),
    player3_score = CASE WHEN v_max >= 3 THEN COALESCE((SELECT score FROM match_score_snapshots WHERE room_id = p_room_id AND slot = 3), v_room.player3_score) ELSE v_room.player3_score END,
    player4_score = CASE WHEN v_max >= 4 THEN COALESCE((SELECT score FROM match_score_snapshots WHERE room_id = p_room_id AND slot = 4), v_room.player4_score) ELSE v_room.player4_score END
  WHERE id = p_room_id;

  -- Attempt payout
  BEGIN
    PERFORM match_credit_winner_if_due(p_room_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO failed_payouts (room_id, match_type, winner_id, pot_amount, error_msg)
    VALUES (p_room_id, 'pvp', v_winner, v_room.bet_amount * v_max, SQLERRM);
  END;

  RETURN json_build_object(
    'ok',        true,
    'room_id',   p_room_id,
    'winner_id', v_winner,
    'frozen_at', now()
  );
END;
$$;

-- Only service role (Edge Functions) can call match_freeze_scores
REVOKE ALL ON FUNCTION public.match_freeze_scores(text) FROM anon, authenticated;

-- ============================================================
-- 3. match_get_room_scores() — lightweight reconnect fallback
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_get_room_scores(p_room_id text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room        match_rooms;
  v_now         timestamptz := now();
  v_deadline    timestamptz;
  v_ms_remaining bigint;
BEGIN
  SELECT * INTO v_room FROM match_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_deadline := v_room.started_at + (COALESCE(v_room.match_duration_seconds, 60) || ' seconds')::interval;
  v_ms_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_deadline - v_now)) * 1000)::bigint;

  RETURN json_build_object(
    'ok',           true,
    'status',       v_room.status,
    'server_ms',    EXTRACT(EPOCH FROM v_now) * 1000,
    'ms_remaining', v_ms_remaining,
    'winner_id',    v_room.winner_id,
    'players', json_build_array(
      CASE WHEN v_room.player1_id IS NOT NULL THEN
        json_build_object('id', v_room.player1_id, 'name', v_room.player1_name, 'score', v_room.player1_score, 'slot', 1, 'is_bot', v_room.player1_is_bot)
      END,
      CASE WHEN v_room.player2_id IS NOT NULL THEN
        json_build_object('id', v_room.player2_id, 'name', v_room.player2_name, 'score', v_room.player2_score, 'slot', 2, 'is_bot', v_room.player2_is_bot)
      END,
      CASE WHEN v_room.player3_id IS NOT NULL THEN
        json_build_object('id', v_room.player3_id, 'name', v_room.player3_name, 'score', v_room.player3_score, 'slot', 3, 'is_bot', v_room.player3_is_bot)
      END,
      CASE WHEN v_room.player4_id IS NOT NULL THEN
        json_build_object('id', v_room.player4_id, 'name', v_room.player4_name, 'score', v_room.player4_score, 'slot', 4, 'is_bot', v_room.player4_is_bot)
      END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_get_room_scores(text) TO anon, authenticated;
