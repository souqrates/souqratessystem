/*
  # Edge Function Warm-up Scheduler

  Prevents cold starts on the Telegram webhook and session verifier by
  pinging them every minute via pg_cron + pg_net.

  1. New helper
    - `public.ping_edge_function(fn_name text)` issues a lightweight
      OPTIONS request to the given edge function so Deno keeps the
      isolate warm without triggering business logic.

  2. Scheduled jobs
    - `warm-telegram-webhook`: pings `telegram_webhook` every minute.
    - `warm-verify-init-data`: pings `verify_init_data` every minute.
    - `warm-stars-invoice`:    pings `stars_invoice` every minute.

  3. Notes
    - Idempotent: existing jobs with the same names are unscheduled first.
    - OPTIONS is used so we never deliver fake payloads to real handlers.
*/

CREATE OR REPLACE FUNCTION public.ping_edge_function(fn_name text)
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
      'Authorization', 'Bearer ' || bearer,
      'X-Warmup', '1'
    ),
    body := '{"warmup":true}'::jsonb
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ping_edge_function(text) FROM PUBLIC;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job
    WHERE jobname IN ('warm-telegram-webhook','warm-verify-init-data','warm-stars-invoice')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'warm-telegram-webhook',
  '* * * * *',
  $$SELECT public.ping_edge_function('telegram_webhook');$$
);

SELECT cron.schedule(
  'warm-verify-init-data',
  '* * * * *',
  $$SELECT public.ping_edge_function('verify_init_data');$$
);

SELECT cron.schedule(
  'warm-stars-invoice',
  '* * * * *',
  $$SELECT public.ping_edge_function('stars_invoice');$$
);
