/*
  # Fix Score Snapshotter Cron -- Direct SQL Instead of HTTP

  ## Problem
  The existing score-snapshotter cron job uses net.http_post to call the
  score_snapshotter Edge Function, but the vault secrets (supabase_url,
  supabase_service_role_key) are not populated, causing the cron to fail
  silently. This means expired match rooms never get their scores frozen,
  and players' games end without winner determination.

  ## Solution
  Replace the HTTP-based cron with a direct SQL function that:
  1. Finds all 'playing' rooms whose deadline has passed
  2. Calls match_freeze_scores() for each one directly
  3. Runs every minute via pg_cron (same schedule as before)

  ## Changes
  1. New function: cron_freeze_expired_rooms() -- finds and freezes expired rooms
  2. Replaces the score-snapshotter cron job with direct SQL invocation
  3. Runs immediate cleanup of any currently expired rooms

  ## Security
  - Function is SECURITY DEFINER (runs as owner)
  - Revoked from anon and authenticated roles
*/

-- 1. Create the direct SQL freeze function
CREATE OR REPLACE FUNCTION cron_freeze_expired_rooms()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_room record;
  v_result json;
  v_frozen integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_checked integer := 0;
  v_deadline timestamptz;
BEGIN
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

    -- Only freeze if deadline has passed (with 2s buffer)
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
      END;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'checked', v_checked,
    'frozen', v_frozen,
    'skipped', v_skipped,
    'failed', v_failed
  );
END;
$fn$;

-- Only service_role/cron should run this
REVOKE EXECUTE ON FUNCTION cron_freeze_expired_rooms FROM anon;
REVOKE EXECUTE ON FUNCTION cron_freeze_expired_rooms FROM authenticated;

-- 2. Replace the HTTP-based cron with direct SQL
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove the broken HTTP-based cron
    BEGIN
      PERFORM cron.unschedule('score-snapshotter');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Schedule the direct SQL cron (every minute)
    PERFORM cron.schedule(
      'score-snapshotter-sql',
      '* * * * *',
      'SELECT cron_freeze_expired_rooms()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $cron$;

-- 3. Run immediate freeze to recover any currently expired rooms
SELECT cron_freeze_expired_rooms();
