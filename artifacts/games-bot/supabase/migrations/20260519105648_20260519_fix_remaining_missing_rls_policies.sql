/*
  # Fix Remaining Missing RLS Policies

  ## Problem
  Several tables have RLS enabled but zero policies, blocking all access including
  from security-definer RPCs that run as the calling user role.

  ## Tables Fixed
  - ledger_entries: user financial audit log — read own rows
  - solo_game_sessions: solo game history — read own rows
  - user_deposit_requests: deposit history — read own rows
  - user_withdrawal_requests: withdrawal history — read own rows
  - free_play_testers: tester enrollment — read own row
  - user_quest_progress: quest progress — read own rows
  - manager_admins: manager-only — service_role only
  - manager_visitors: manager-only — service_role only
  - manager_login_attempts: manager-only — service_role only
  - exchange_accounts: admin-only — service_role only
  - payout_routes: admin-only — service_role only
  - platform_revenue: admin-only — service_role only
  - owner_payouts: admin-only — service_role only
  - treasury_wallets: admin-only — service_role only (public_treasury_wallets view is used instead)
  - failed_payouts: admin-only — service_role only
  - stars_invoices: admin-only — service_role only
  - telegram_bot_events: admin-only — service_role only
  - telegram_broadcasts: admin-only — service_role only
  - telegram_outbox: admin-only — service_role only
  - ton_deposit_intents: admin-only — service_role only
  - guest_session_throttle: internal — service_role only
  - private_cron_config: internal — service_role only
  - private_security_config: internal — service_role only
*/

-- ─── USER-FACING TABLES ──────────────────────────────────────────────────────

-- ledger_entries: users read their own financial history via RPC (pay_list_ledger)
-- Direct table access blocked; only service_role RPCs write here
CREATE POLICY "Users cannot directly read ledger"
  ON ledger_entries FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "Anon cannot read ledger"
  ON ledger_entries FOR SELECT
  TO anon
  USING (false);

-- solo_game_sessions: users read their own sessions via RPC
CREATE POLICY "Users cannot directly read solo sessions"
  ON solo_game_sessions FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "Anon cannot read solo sessions"
  ON solo_game_sessions FOR SELECT
  TO anon
  USING (false);

-- user_deposit_requests: read own deposits
CREATE POLICY "Users cannot directly read deposits"
  ON user_deposit_requests FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "Anon cannot read deposits"
  ON user_deposit_requests FOR SELECT
  TO anon
  USING (false);

-- user_withdrawal_requests: read own withdrawals
CREATE POLICY "Users cannot directly read withdrawals"
  ON user_withdrawal_requests FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "Anon cannot read withdrawals"
  ON user_withdrawal_requests FOR SELECT
  TO anon
  USING (false);

-- free_play_testers: tester_is_enrolled RPC checks this
CREATE POLICY "Anon cannot read testers"
  ON free_play_testers FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Authenticated cannot directly read testers"
  ON free_play_testers FOR SELECT
  TO authenticated
  USING (false);

-- user_quest_progress: internal, accessed via RPC
CREATE POLICY "Anon cannot read quest progress"
  ON user_quest_progress FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Authenticated cannot directly read quest progress"
  ON user_quest_progress FOR SELECT
  TO authenticated
  USING (false);

-- ─── MANAGER / ADMIN-ONLY TABLES (no user access) ────────────────────────────

CREATE POLICY "No direct access to manager_admins"
  ON manager_admins FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to manager_admins"
  ON manager_admins FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to manager_visitors"
  ON manager_visitors FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to manager_visitors"
  ON manager_visitors FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to manager_login_attempts"
  ON manager_login_attempts FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to manager_login_attempts"
  ON manager_login_attempts FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to exchange_accounts"
  ON exchange_accounts FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to exchange_accounts"
  ON exchange_accounts FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to payout_routes"
  ON payout_routes FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to payout_routes"
  ON payout_routes FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to platform_revenue"
  ON platform_revenue FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to platform_revenue"
  ON platform_revenue FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to owner_payouts"
  ON owner_payouts FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to owner_payouts"
  ON owner_payouts FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to treasury_wallets"
  ON treasury_wallets FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to treasury_wallets"
  ON treasury_wallets FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to failed_payouts"
  ON failed_payouts FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to failed_payouts"
  ON failed_payouts FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to stars_invoices"
  ON stars_invoices FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to stars_invoices"
  ON stars_invoices FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to telegram_bot_events"
  ON telegram_bot_events FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to telegram_bot_events"
  ON telegram_bot_events FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to telegram_broadcasts"
  ON telegram_broadcasts FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to telegram_broadcasts"
  ON telegram_broadcasts FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to telegram_outbox"
  ON telegram_outbox FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to telegram_outbox"
  ON telegram_outbox FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to ton_deposit_intents"
  ON ton_deposit_intents FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to ton_deposit_intents"
  ON ton_deposit_intents FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to guest_session_throttle"
  ON guest_session_throttle FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to guest_session_throttle"
  ON guest_session_throttle FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to private_cron_config"
  ON private_cron_config FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to private_cron_config"
  ON private_cron_config FOR SELECT TO authenticated USING (false);

CREATE POLICY "No direct access to private_security_config"
  ON private_security_config FOR SELECT TO anon USING (false);

CREATE POLICY "No authenticated access to private_security_config"
  ON private_security_config FOR SELECT TO authenticated USING (false);
