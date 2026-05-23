/*
  # TON Watcher — Run Every 15 Seconds

  pg_cron minimum is 1 minute. We approximate 15-second polling by
  scheduling 4 jobs offset by 15s each using pg_sleep inside the command.
  This gives us scans at T+0s, T+15s, T+30s, T+45s every minute.
*/

-- Remove old single-run job
SELECT cron.unschedule('ton-watcher-every-minute');

-- Job at T+0s
SELECT cron.schedule(
  'ton-watcher-0s',
  '* * * * *',
  $$SELECT public.invoke_edge_function('ton_watcher');$$
);

-- Job at T+15s
SELECT cron.schedule(
  'ton-watcher-15s',
  '* * * * *',
  $$SELECT pg_sleep(15); SELECT public.invoke_edge_function('ton_watcher');$$
);

-- Job at T+30s
SELECT cron.schedule(
  'ton-watcher-30s',
  '* * * * *',
  $$SELECT pg_sleep(30); SELECT public.invoke_edge_function('ton_watcher');$$
);

-- Job at T+45s
SELECT cron.schedule(
  'ton-watcher-45s',
  '* * * * *',
  $$SELECT pg_sleep(45); SELECT public.invoke_edge_function('ton_watcher');$$
);
