/*
  # Phase 4: score_snapshotter Cron Job

  ## Summary
  Registers a pg_cron job that calls the score_snapshotter Edge Function
  every 10 seconds to automatically freeze expired match rooms.

  - Rooms whose clock has expired are finalized server-side
  - Players who closed the app still get their score recorded
  - Winner is always determined by server-side snapshot, not client submission

  Note: pg_cron minimum interval is 1 minute for the cron syntax,
  so we use a pg_cron schedule with a loop inside, or use the
  net.http_post approach with a 10-second pg_cron wrapper.
  We schedule it every minute and the Edge Function processes all
  expired rooms in one sweep — this is sufficient since match_freeze_scores
  uses SKIP LOCKED and is idempotent.
*/

-- Ensure pg_cron and net extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if any (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('score-snapshotter');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule score_snapshotter to run every minute
-- The Edge Function processes all rooms expired in the last minute in one shot
SELECT cron.schedule(
  'score-snapshotter',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
           || '/functions/v1/score_snapshotter',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
