/*
  # Performance: Fix Cron Jobs

  1. Remove pg_sleep() ton-watcher jobs — holds DB connections open for up to 45s/min
  2. Fix session cleanup to batch-delete with LIMIT (avoids locking millions of rows)
  3. Slow warm-up jobs: every minute → every 3 minutes (67% fewer DB connections)
  4. Increase ledger archival: 10K rows daily → 50K rows every 6 hours
*/

-- ── 1. Remove pg_sleep ton-watcher jobs ──────────────────────────────────────
SELECT cron.unschedule('ton-watcher-15s');
SELECT cron.unschedule('ton-watcher-30s');
SELECT cron.unschedule('ton-watcher-45s');

-- ── 2. Fix session cleanup: replace both duplicates with one batched job ──────
SELECT cron.unschedule('cleanup_expired_sessions_hourly');
SELECT cron.unschedule('cleanup-expired-sessions');

-- Batch delete function to avoid single huge transaction
CREATE OR REPLACE FUNCTION cleanup_expired_sessions_batched()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  LOOP
    DELETE FROM telegram_sessions
    WHERE id IN (
      SELECT id FROM telegram_sessions
      WHERE expires_at < now() - interval '2 hours'
      LIMIT 5000
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted < 5000;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '5 * * * *',
  $$SELECT cleanup_expired_sessions_batched()$$
);

-- ── 3. Slow warm-up jobs to every 3 minutes ──────────────────────────────────
SELECT cron.unschedule('warm-bot-fill');
SELECT cron.unschedule('warm-buy-ton-link');
SELECT cron.unschedule('warm-manager-broadcast');
SELECT cron.unschedule('warm-score-snapshotter');
SELECT cron.unschedule('warm-stars-invoice');
SELECT cron.unschedule('warm-telegram-webhook');
SELECT cron.unschedule('warm-ton-watcher');
SELECT cron.unschedule('warm-verify-init-data');

SELECT cron.schedule('warm-bot-fill',          '*/3 * * * *', $$SELECT public.ping_edge_function('bot_fill')$$);
SELECT cron.schedule('warm-buy-ton-link',      '*/3 * * * *', $$SELECT public.ping_edge_function('buy_ton_link')$$);
SELECT cron.schedule('warm-manager-broadcast', '*/3 * * * *', $$SELECT public.ping_edge_function('manager_broadcast')$$);
SELECT cron.schedule('warm-score-snapshotter', '*/3 * * * *', $$SELECT public.ping_edge_function('score_snapshotter')$$);
SELECT cron.schedule('warm-stars-invoice',     '*/3 * * * *', $$SELECT public.ping_edge_function('stars_invoice')$$);
SELECT cron.schedule('warm-telegram-webhook',  '*/3 * * * *', $$SELECT public.ping_edge_function('telegram_webhook')$$);
SELECT cron.schedule('warm-ton-watcher',       '*/3 * * * *', $$SELECT public.ping_edge_function('ton_watcher')$$);
SELECT cron.schedule('warm-verify-init-data',  '*/3 * * * *', $$SELECT public.ping_edge_function('verify_init_data')$$);

-- ── 4. Increase ledger archival batch size and frequency ─────────────────────
SELECT cron.unschedule('archive-old-ledger-entries');

SELECT cron.schedule(
  'archive-old-ledger-entries',
  '0 */6 * * *',
  $$SELECT archive_old_ledger_entries(90, 50000)$$
);
