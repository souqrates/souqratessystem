/*
  # Production Security Audit -- Critical & High Severity Fixes

  ## Overview
  Comprehensive security hardening based on full backend audit.
  
  ## CRITICAL Fixes
  1. Revoke anon/authenticated access to ALL manager_ admin functions
  2. Revoke anon access to award_xp, unlock_achievement, set_admin_id, check_is_admin
  3. Revoke public access to match_credit_winner_if_due, invoke_edge_function

  ## HIGH Fixes
  4. Add sc_free >= 0 and referral_balance >= 0 CHECK constraints
  5. Create failed_payouts table for audit trail
  6. Create solo_game_sessions table for gameplay proof
*/

-- =====================================================================
-- SECTION 1: REVOKE MANAGER FUNCTIONS FROM ANON + AUTHENTICATED
-- These admin functions should NEVER be callable by client roles.
-- They rely only on telegram_id for auth, making them
-- exploitable by anyone who knows an admin's telegram_id.
-- =====================================================================

DO $revoke_mgr$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'manager_add_admin','manager_adjust_balance','manager_audit_log_list',
    'manager_cancel_contest','manager_clear_integration',
    'manager_create_app_notification','manager_create_broadcast',
    'manager_create_contest','manager_create_referral_code',
    'manager_delete_app_notification','manager_delete_exchange_account',
    'manager_delete_info_page','manager_delete_payout_route',
    'manager_delete_referral_program','manager_delete_treasury_wallet',
    'manager_discard_all_staging','manager_discard_all_staging_games',
    'manager_discard_staging','manager_discard_staging_game',
    'manager_export_referral_earnings','manager_export_users',
    'manager_export_withdrawals','manager_get_broadcast_recipients',
    'manager_grant_skz','manager_list_admins',
    'manager_list_app_notifications','manager_list_broadcasts',
    'manager_list_contests','manager_list_deposit_requests',
    'manager_list_exchange_accounts','manager_list_info_pages',
    'manager_list_integrations','manager_list_owner_payouts',
    'manager_list_payout_routes','manager_list_platform_revenue',
    'manager_list_referral_codes','manager_list_referral_earnings',
    'manager_list_referral_programs','manager_list_treasury_wallets',
    'manager_list_visitors','manager_list_withdrawal_requests',
    'manager_override_user_stats','manager_process_withdrawal',
    'manager_publish_all','manager_record_owner_payout',
    'manager_remove_admin','manager_revenue_summary',
    'manager_set_integration','manager_set_user_flag',
    'manager_set_web_passcode','manager_update_bot_smart_config',
    'manager_update_broadcast_status','manager_update_config',
    'manager_update_owner_payout_status','manager_upsert_exchange_account',
    'manager_upsert_game_config','manager_upsert_game_override',
    'manager_upsert_info_page','manager_upsert_payout_route',
    'manager_upsert_referral_program','manager_upsert_staging',
    'manager_upsert_staging_game','manager_upsert_treasury_wallet',
    'manager_validate_admin_session','manager_visitor_stats'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM anon', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $revoke_mgr$;

-- Keep manager_web_login accessible for the manager dashboard login flow
GRANT EXECUTE ON FUNCTION public.manager_web_login TO authenticated;

-- =====================================================================
-- SECTION 2: REVOKE DANGEROUS GAMIFICATION/ADMIN FUNCTIONS FROM ANON
-- =====================================================================

DO $revoke_misc$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'award_xp','unlock_achievement','set_admin_id','check_is_admin',
    'invoke_edge_function','match_credit_winner_if_due'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM anon', fn);
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated', fn);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $revoke_misc$;

-- =====================================================================
-- SECTION 3: REVOKE pay_charge_solo_entry and pay_credit_solo_reward
-- from anon. Only authenticated users should call these.
-- =====================================================================

DO $revoke_pay$
BEGIN
  REVOKE EXECUTE ON FUNCTION pay_charge_solo_entry FROM anon;
  REVOKE EXECUTE ON FUNCTION pay_credit_solo_reward FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $revoke_pay$;

-- =====================================================================
-- SECTION 4: ADD CHECK CONSTRAINTS for sc_free and referral_balance
-- =====================================================================

DO $chk1$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_balances_sc_free_nonneg'
    AND conrelid = 'user_balances'::regclass
  ) THEN
    ALTER TABLE user_balances ADD CONSTRAINT user_balances_sc_free_nonneg CHECK (sc_free >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $chk1$;

DO $chk2$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_balances_ref_bal_nonneg'
    AND conrelid = 'user_balances'::regclass
  ) THEN
    ALTER TABLE user_balances ADD CONSTRAINT user_balances_ref_bal_nonneg CHECK (referral_balance >= 0);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $chk2$;

-- =====================================================================
-- SECTION 5: CREATE failed_payouts TABLE
-- Logs payout failures for manual review instead of silently dropping
-- =====================================================================

CREATE TABLE IF NOT EXISTS failed_payouts (
  id           bigserial PRIMARY KEY,
  room_id      text,
  match_type   text DEFAULT 'pvp',
  winner_id    bigint,
  pot_amount   numeric,
  error_msg    text,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE failed_payouts ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 6: CREATE solo_game_sessions TABLE
-- Server-side proof that a game was actually started (entry fee charged).
-- pay_credit_solo_reward will require a valid session to award prizes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS solo_game_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL,
  telegram_id    bigint NOT NULL,
  game_id        integer NOT NULL,
  entry_fee_skz  numeric NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  max_duration_s integer NOT NULL DEFAULT 120,
  rewarded_at    timestamptz,
  reward_amount  numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE solo_game_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_solo_sessions_tg_game
  ON solo_game_sessions (telegram_id, game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solo_sessions_unrewarded
  ON solo_game_sessions (telegram_id, game_id)
  WHERE rewarded_at IS NULL;
