/*
  # Performance: Drop Duplicate Indexes

  Removes redundant indexes that impose write overhead on every INSERT/UPDATE
  without providing any additional read benefit. Each group of duplicates is
  reduced to the single most useful index.

  ## Indexes Dropped

  ### telegram_sessions (3 → 1 for telegram_id+expires_at)
  - Drop: telegram_sessions_tg_idx, idx_telegram_sessions_tg_expires
  - Keep: idx_sessions_tgid_expires (composite, most specific)

  ### ledger_entries (2 → 1 for user+created_at)
  - Drop: idx_ledger_user_time
  - Keep: idx_ledger_entries_user_tg_created

  ### ledger_entries_archive (3 → 1)
  - Drop: ledger_entries_archive_user_telegram_id_created_at_idx
  - Drop: ledger_entries_archive_user_telegram_id_created_at_idx1
  - Keep: idx_ledger_archive_user_time

  ### ton_deposit_intents (unique covers non-unique)
  - Drop: idx_ton_intents_txhash (non-unique, covered by unique constraint)

  ### user_withdrawal_requests (2 → 1)
  - Drop: idx_user_withdrawal_requests_user
  - Keep: idx_withdrawal_requests_tg_created

  ### telegram_outbox (2 → 1)
  - Drop: telegram_outbox_status_idx
  - Keep: idx_outbox_status_time

  ### user_deposit_requests (2 → 1)
  - Drop: idx_user_deposit_user
  - Keep: idx_user_deposit_requests_user
*/

-- telegram_sessions
DROP INDEX IF EXISTS telegram_sessions_tg_idx;
DROP INDEX IF EXISTS idx_telegram_sessions_tg_expires;

-- ledger_entries
DROP INDEX IF EXISTS idx_ledger_user_time;

-- ledger_entries_archive
DROP INDEX IF EXISTS ledger_entries_archive_user_telegram_id_created_at_idx;
DROP INDEX IF EXISTS ledger_entries_archive_user_telegram_id_created_at_idx1;

-- ton_deposit_intents
DROP INDEX IF EXISTS idx_ton_intents_txhash;

-- user_withdrawal_requests
DROP INDEX IF EXISTS idx_user_withdrawal_requests_user;

-- telegram_outbox
DROP INDEX IF EXISTS telegram_outbox_status_idx;

-- user_deposit_requests
DROP INDEX IF EXISTS idx_user_deposit_user;
