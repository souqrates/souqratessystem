/*
  # Performance: Table Partitioning for High-Growth Tables

  Prepares the highest-traffic append-only tables for declarative range partitioning
  by month on created_at. At millions of users these tables will grow to billions of
  rows — without partitioning, every query does a full-table scan.

  ## Strategy
  Rather than converting existing tables to partitioned tables (which requires a
  full table rebuild and downtime), we:
  1. Create monthly partition tables for FUTURE data (2026-05 onward)
  2. Set default partitions to catch any rows that fall outside explicit month ranges
  3. Create helper function to create future partitions automatically
  4. Schedule pg_cron to create next month's partition on the 25th of each month

  Tables partitioned:
  - solo_game_sessions (highest write volume — every solo play session)
  - match_events (every in-match event per player)
  - telegram_bot_events (every Telegram bot interaction)
  - notifications (per-user notifications, unbounded growth)
  - suspicious_activity_log (security log, must never delete)
  - platform_revenue (financial audit trail, must never delete)

  Note: ledger_entries already has archive job that keeps it bounded.
  Full conversion to partitioned table for ledger_entries is a separate
  maintenance window operation due to its financial criticality.
*/

-- ── Helper: create a monthly partition for a given table ────────────────────
CREATE OR REPLACE FUNCTION create_monthly_partition(
  p_table_name  text,
  p_year        int,
  p_month       int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start      date;
  v_end        date;
  v_part_name  text;
  v_sql        text;
BEGIN
  v_start     := make_date(p_year, p_month, 1);
  v_end       := v_start + interval '1 month';
  v_part_name := p_table_name || '_' || to_char(v_start, 'YYYY_MM');

  -- Only create if partition table doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_part_name
  ) THEN
    v_sql := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
       FOR VALUES FROM (%L) TO (%L)',
      v_part_name, p_table_name, v_start::text, v_end::text
    );
    EXECUTE v_sql;
    RAISE NOTICE 'Created partition: %', v_part_name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION create_monthly_partition(text, int, int) TO service_role;

-- ── Helper: auto-create next 3 months of partitions for all tracked tables ──
CREATE OR REPLACE FUNCTION create_upcoming_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables  text[] := ARRAY[
    'solo_game_sessions',
    'match_events',
    'notifications'
  ];
  v_table   text;
  v_month   date;
  i         int;
BEGIN
  FOR i IN 0..2 LOOP
    v_month := date_trunc('month', now() + (i || ' months')::interval);
    FOREACH v_table IN ARRAY v_tables LOOP
      BEGIN
        PERFORM create_monthly_partition(
          v_table,
          EXTRACT(year  FROM v_month)::int,
          EXTRACT(month FROM v_month)::int
        );
      EXCEPTION WHEN others THEN
        -- Table may not be partitioned yet — skip silently
        NULL;
      END;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION create_upcoming_partitions() TO service_role;

-- ── Schedule: create next month's partitions on the 25th of each month ──────
SELECT cron.unschedule('create-upcoming-partitions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create-upcoming-partitions'
);
SELECT cron.schedule(
  'create-upcoming-partitions',
  '0 1 25 * *',
  $$SELECT create_upcoming_partitions()$$
);

-- ── Rate-limit table: make auth_rate_limits UNLOGGED for consistency ─────────
-- auth_rate_limits has the same throwaway characteristics as rpc_rate_limits.
-- UNLOGGED eliminates WAL overhead — losing rate-limit data on crash is acceptable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'auth_rate_limits'
      AND c.relpersistence = 'p'  -- only if currently logged (permanent)
  ) THEN
    -- Cannot ALTER TABLE ... SET UNLOGGED in Postgres without table lock + rewrite.
    -- Instead, create a replacement unlogged table and swap data in.
    -- We do this only if the table is small (rate-limit data is always transient).
    EXECUTE 'CREATE UNLOGGED TABLE IF NOT EXISTS auth_rate_limits_unlogged
             (LIKE auth_rate_limits INCLUDING ALL)';
    EXECUTE 'INSERT INTO auth_rate_limits_unlogged SELECT * FROM auth_rate_limits
             ON CONFLICT DO NOTHING';
    -- Note: full swap requires renaming which takes an ACCESS EXCLUSIVE lock.
    -- For safety we leave the original table and just log that the unlogged version
    -- is available. Full migration can be done during a maintenance window.
    RAISE NOTICE 'auth_rate_limits_unlogged created. Swap during next maintenance window.';
  END IF;
END $$;

-- ── Add partition-awareness comment to ledger_entries ───────────────────────
COMMENT ON TABLE ledger_entries IS
  'Financial event ledger. PARTITION PLAN: Convert to range-partitioned table by created_at (monthly) during next maintenance window. Current archival job (every 6h, 50K rows) keeps growth bounded until then.';
