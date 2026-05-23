/*
  # Performance: Add Missing Critical Indexes

  Adds indexes absent on high-traffic tables to prevent full-table scans under load.

  1. notifications — composite (user_id, is_read, created_at DESC)
  2. failed_deposits — (user_telegram_id, expired_at DESC)
  3. failed_payouts — (created_at DESC)
  4. match_events — composite (room_id, created_at DESC)
  5. manager_audit_log — (admin_telegram_id, created_at DESC) if column exists
  6. economy_settings_history — (key, changed_at DESC) if table/column exist
*/

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time
  ON notifications(user_id, is_read, created_at DESC);

-- failed_deposits: uses expired_at not created_at
CREATE INDEX IF NOT EXISTS idx_failed_deposits_user_time
  ON failed_deposits(user_telegram_id, expired_at DESC);

-- failed_payouts
CREATE INDEX IF NOT EXISTS idx_failed_payouts_time
  ON failed_payouts(created_at DESC);

-- match_events: composite for ordered event fetches per room
CREATE INDEX IF NOT EXISTS idx_match_events_room_time
  ON match_events(room_id, created_at DESC);

-- manager_audit_log
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'manager_audit_log'
      AND column_name  = 'admin_telegram_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'manager_audit_log'
        AND indexname = 'idx_audit_log_admin_time'
    ) THEN
      EXECUTE 'CREATE INDEX idx_audit_log_admin_time
               ON manager_audit_log(admin_telegram_id, created_at DESC)';
    END IF;
  END IF;
END $$;

-- economy_settings_history
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'economy_settings_history'
      AND column_name  = 'changed_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'economy_settings_history'
        AND indexname = 'idx_econ_history_key_time'
    ) THEN
      EXECUTE 'CREATE INDEX idx_econ_history_key_time
               ON economy_settings_history(key, changed_at DESC)';
    END IF;
  END IF;
END $$;
