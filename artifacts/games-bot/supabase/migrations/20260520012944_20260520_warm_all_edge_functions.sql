/*
  # Warm All 9 Edge Functions

  Currently only 3 functions are warmed (telegram_webhook, verify_init_data, stars_invoice).
  This adds warming for the remaining 6 functions to eliminate cold starts.

  Functions now warmed every minute:
  - telegram_webhook (existing)
  - verify_init_data (existing)
  - stars_invoice (existing)
  - ton_watcher (NEW)
  - buy_ton_link (NEW)
  - bot_fill (NEW)
  - score_snapshotter (NEW)
  - manager_broadcast (NEW)
  - tg_setup (NEW)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-ton-watcher') THEN
    PERFORM cron.schedule(
      'warm-ton-watcher',
      '* * * * *',
      'SELECT public.ping_edge_function(''ton_watcher'')'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-buy-ton-link') THEN
    PERFORM cron.schedule(
      'warm-buy-ton-link',
      '* * * * *',
      'SELECT public.ping_edge_function(''buy_ton_link'')'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-bot-fill') THEN
    PERFORM cron.schedule(
      'warm-bot-fill',
      '* * * * *',
      'SELECT public.ping_edge_function(''bot_fill'')'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-score-snapshotter') THEN
    PERFORM cron.schedule(
      'warm-score-snapshotter',
      '* * * * *',
      'SELECT public.ping_edge_function(''score_snapshotter'')'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-manager-broadcast') THEN
    PERFORM cron.schedule(
      'warm-manager-broadcast',
      '* * * * *',
      'SELECT public.ping_edge_function(''manager_broadcast'')'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'warm-tg-setup') THEN
    PERFORM cron.schedule(
      'warm-tg-setup',
      '*/5 * * * *',
      'SELECT public.ping_edge_function(''tg_setup'')'
    );
  END IF;
END $$;
