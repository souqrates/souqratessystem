/*
  # Schedule recurring jobs for TON watcher and Bot Fill

  1. Extensions
    - Enables `pg_cron` (job scheduler) and `pg_net` (async HTTP) so the database
      can periodically invoke our Supabase Edge Functions.

  2. Helper function
    - `public.invoke_edge_function(name)` posts to the project edge function
      endpoint using values from a private config table to avoid hard-coding
      credentials inside pg_cron job commands.

  3. Config table
    - `private_cron_config(key, value)` holds the supabase URL and anon key used
      by the helper. Only the postgres role can read it (RLS denies everyone).

  4. Scheduled jobs
    - `ton-watcher-every-minute`: calls `ton_watcher` once per minute.
    - `bot-fill-every-minute`: calls `bot_fill` once per minute.

  5. Notes
    - Idempotent: existing jobs with the same names are unscheduled first.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS private_cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE private_cron_config ENABLE ROW LEVEL SECURITY;

-- no policies = no access for anon/authenticated; only postgres role can read

INSERT INTO private_cron_config (key, value) VALUES
  ('supabase_url', 'https://gldgmwubjkkcbqemlvzu.supabase.co'),
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZGdtd3ViamtrY2JxZW1sdnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDc3NDcsImV4cCI6MjA5MzkyMzc0N30.oPOKL4ZTYmzk_si8WShta2ikKKm3cYnYl9V-1A3lld8')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  base_url text;
  bearer text;
BEGIN
  SELECT value INTO base_url FROM private_cron_config WHERE key='supabase_url';
  SELECT value INTO bearer   FROM private_cron_config WHERE key='supabase_anon_key';

  SELECT net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || bearer
    ),
    body := '{}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_edge_function(text) FROM PUBLIC;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('ton-watcher-every-minute','bot-fill-every-minute') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'ton-watcher-every-minute',
  '* * * * *',
  $$SELECT public.invoke_edge_function('ton_watcher');$$
);

SELECT cron.schedule(
  'bot-fill-every-minute',
  '* * * * *',
  $$SELECT public.invoke_edge_function('bot_fill');$$
);
