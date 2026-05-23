/*
  # Performance Indexes for Scale

  Adds composite indexes on the highest-traffic columns.
  These dramatically reduce query time under high concurrent load.

  1. ledger_entries(user_telegram_id, created_at DESC) — wallet history
  2. ton_deposit_intents(status, expires_at) — TON watcher scan
  3. ton_deposit_intents(tx_hash) — idempotency check
  4. telegram_sessions(telegram_id, expires_at) — session lookup
  5. telegram_outbox(status, created_at) — outbox worker scan
  6. match_rooms(status, created_at) — matchmaking queue
*/

CREATE INDEX IF NOT EXISTS idx_ledger_user_time
  ON ledger_entries(user_telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ton_intents_status_expires
  ON ton_deposit_intents(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ton_intents_txhash
  ON ton_deposit_intents(tx_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_tgid_expires
  ON telegram_sessions(telegram_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_outbox_status_time
  ON telegram_outbox(status, created_at);

CREATE INDEX IF NOT EXISTS idx_match_rooms_status_time
  ON match_rooms(status, created_at);
