/*
  # Critical Security Fixes v3

  ## 1. Fix match_rooms RLS
  Replace USING(true) SELECT policy with participant-only + waiting rooms access.

  ## 2. Add advisory lock to cron_freeze_expired_rooms
  Prevents double-execution when cron fires while previous run still active.

  ## 3. Score ceilings for all games
  Inserts default max_score=1,000,000 for games without an explicit limit.

  ## 4. Performance indexes
  Adds missing indexes on tournament_rooms and match_rooms.
*/

-- ─── 1. Fix match_rooms RLS ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Players can view rooms they participate in" ON match_rooms;
DROP POLICY IF EXISTS "Participants can view their rooms" ON match_rooms;
DROP POLICY IF EXISTS "Authenticated can read waiting rooms" ON match_rooms;

-- Participants can always see their rooms
CREATE POLICY "Participants can view their rooms"
  ON match_rooms FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = player1_id::text
    OR auth.uid()::text = player2_id::text
    OR auth.uid()::text = player3_id::text
    OR auth.uid()::text = player4_id::text
  );

-- Any authenticated user can see waiting rooms (needed to join by code)
CREATE POLICY "Authenticated can read waiting rooms"
  ON match_rooms FOR SELECT
  TO authenticated
  USING (status = 'waiting');


-- ─── 2. Patch cron_freeze_expired_rooms with advisory lock ───────────────────

CREATE OR REPLACE FUNCTION cron_freeze_expired_rooms()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room    record;
  v_result  json;
  v_frozen  integer := 0;
  v_skipped integer := 0;
  v_failed  integer := 0;
  v_checked integer := 0;
  v_deadline timestamptz;
BEGIN
  -- Advisory lock: skip if another instance is already running.
  IF NOT pg_try_advisory_xact_lock(hashtext('cron_freeze_expired_rooms')) THEN
    RETURN json_build_object(
      'skipped_reason', 'lock_held',
      'checked', 0, 'frozen', 0, 'skipped', 0, 'failed', 0
    );
  END IF;

  FOR v_room IN
    SELECT id, started_at, match_duration_seconds, max_players
      FROM match_rooms
     WHERE status = 'playing'
       AND started_at IS NOT NULL
     LIMIT 50
  LOOP
    v_checked := v_checked + 1;
    v_deadline := v_room.started_at
      + (COALESCE(v_room.match_duration_seconds, 60) || ' seconds')::interval;

    IF now() >= v_deadline - interval '2 seconds' THEN
      BEGIN
        v_result := match_freeze_scores(v_room.id);
        IF v_result->>'ok' = 'true' THEN
          IF (v_result->>'skipped')::boolean IS TRUE THEN
            v_skipped := v_skipped + 1;
          ELSE
            v_frozen := v_frozen + 1;
          END IF;
        ELSE
          v_failed := v_failed + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
        RAISE WARNING 'cron_freeze room % failed: %', v_room.id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'checked', v_checked,
    'frozen',  v_frozen,
    'skipped', v_skipped,
    'failed',  v_failed
  );
END;
$$;


-- ─── 3. Score ceilings for all games ─────────────────────────────────────────

INSERT INTO game_score_limits (game_id, max_score, description)
SELECT
  gs.id,
  1000000,
  'Default ceiling'
FROM (SELECT generate_series(1, 200) AS id) gs
WHERE NOT EXISTS (
  SELECT 1 FROM game_score_limits WHERE game_id = gs.id
)
ON CONFLICT DO NOTHING;


-- ─── 4. Performance indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tournament_rooms_host_id
  ON tournament_rooms (host_id);

CREATE INDEX IF NOT EXISTS idx_tournament_rooms_status
  ON tournament_rooms (status);

CREATE INDEX IF NOT EXISTS idx_tournament_rooms_ends_at
  ON tournament_rooms (ends_at)
  WHERE status = 'playing';

CREATE INDEX IF NOT EXISTS idx_match_rooms_status_started
  ON match_rooms (status, started_at)
  WHERE status = 'playing';

CREATE INDEX IF NOT EXISTS idx_match_rooms_winnings_null
  ON match_rooms (id)
  WHERE winnings_credited_at IS NULL AND status = 'playing';
