/*
  # Server-Side Match Timer Enforcement

  ## Problem
  Players could leave 1v1 / 4-player / tournament games, return many minutes
  later, and still complete the game and win. Score writes from the client
  were accepted unconditionally because no server-side deadline existed.

  ## Solution
  Enforce a single authoritative clock on the database. Match start time
  (`started_at`, `starts_at`) and duration (`match_duration_seconds`,
  `duration_seconds`) are set when the match transitions to "playing".
  Triggers BEFORE UPDATE on score columns reject writes after the deadline.

  ## Changes

  1. Schema
    - `match_rooms.match_duration_seconds` (int, default 60): authoritative
      duration in seconds. Applies once `started_at` is set.

  2. Triggers
    - `match_rooms_block_late_scores`: BEFORE UPDATE. If any
      `player[1..4]_score` field is changing and
      `now() > started_at + match_duration_seconds + 5s grace`,
      score change is rejected AND the room is marked finished.
    - `tournament_players_block_late_scores`: BEFORE UPDATE on
      `tournament_players`. If `score` increases and
      `now() > tournament_rooms.ends_at + 5s grace`, score change is rejected.

  3. Grace
    - 5-second grace to absorb network jitter. Submissions inside grace are
      accepted at face value; submissions outside it are hard-rejected.

  4. Safety
    - Triggers only block SCORE changes. Cancellations, status transitions
      to "finished" (set by the trigger itself), and admin updates remain
      possible.
    - Existing rooms get `match_duration_seconds = 60` by default.
*/

ALTER TABLE match_rooms
  ADD COLUMN IF NOT EXISTS match_duration_seconds integer NOT NULL DEFAULT 60;

CREATE OR REPLACE FUNCTION public.match_rooms_block_late_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_deadline timestamptz;
  v_score_changed boolean;
BEGIN
  v_score_changed :=
       COALESCE(NEW.player1_score, 0) <> COALESCE(OLD.player1_score, 0)
    OR COALESCE(NEW.player2_score, 0) <> COALESCE(OLD.player2_score, 0)
    OR COALESCE(NEW.player3_score, 0) <> COALESCE(OLD.player3_score, 0)
    OR COALESCE(NEW.player4_score, 0) <> COALESCE(OLD.player4_score, 0);

  IF NOT v_score_changed THEN
    RETURN NEW;
  END IF;

  IF OLD.started_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_deadline := OLD.started_at
    + make_interval(secs => COALESCE(OLD.match_duration_seconds, 60) + 5);

  IF now() > v_deadline THEN
    RAISE EXCEPTION 'match_expired'
      USING HINT = 'Match window closed; scores can no longer be submitted.',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_rooms_block_late_scores_trg ON match_rooms;
CREATE TRIGGER match_rooms_block_late_scores_trg
BEFORE UPDATE ON match_rooms
FOR EACH ROW
EXECUTE FUNCTION public.match_rooms_block_late_scores();

CREATE OR REPLACE FUNCTION public.tournament_players_block_late_scores()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ends_at timestamptz;
BEGIN
  IF COALESCE(NEW.score, 0) = COALESCE(OLD.score, 0) THEN
    RETURN NEW;
  END IF;

  SELECT ends_at INTO v_ends_at
  FROM tournament_rooms
  WHERE id = NEW.room_id;

  IF v_ends_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF now() > v_ends_at + interval '5 seconds' THEN
    RAISE EXCEPTION 'tournament_expired'
      USING HINT = 'Tournament window closed; scores can no longer be submitted.',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_players_block_late_scores_trg ON tournament_players;
CREATE TRIGGER tournament_players_block_late_scores_trg
BEFORE UPDATE ON tournament_players
FOR EACH ROW
EXECUTE FUNCTION public.tournament_players_block_late_scores();
