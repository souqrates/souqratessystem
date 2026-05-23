/*
  # Restore Required Function Grants

  ## Context
  The Supabase client uses the anon key, so ALL RPC calls go through
  as the anon role. Previous migration revoked too broadly.

  ## Strategy
  - Manager functions: re-grant to anon (all have internal admin checks)
  - Gamification functions actively used by player app: re-grant
  - Keep revoked: award_xp, unlock_achievement, set_admin_id,
    invoke_edge_function, match_credit_winner_if_due, pay_credit_winnings
*/

-- =====================================================================
-- RE-GRANT MANAGER FUNCTIONS TO ANON
-- =====================================================================

DO $grant_mgr$
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
    'manager_validate_admin_session','manager_visitor_stats',
    'manager_web_login'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO anon', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $grant_mgr$;

-- =====================================================================
-- RE-GRANT GAMIFICATION FUNCTIONS (with explicit signatures)
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.record_game_end(bigint, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.record_game_end(bigint, boolean, text) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak TO anon;
GRANT EXECUTE ON FUNCTION public.check_is_admin TO anon;

-- =====================================================================
-- ENSURE SOLO ENTRY/REWARD STAY GRANTED
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.pay_charge_solo_entry TO anon;
GRANT EXECUTE ON FUNCTION public.pay_credit_solo_reward TO anon;

-- =====================================================================
-- CONFIRM THESE STAY REVOKED (dangerous without proper session auth):
-- award_xp: can grant arbitrary XP to any user -- exploitable
-- unlock_achievement: can unlock any achievement for any user
-- set_admin_id: can set admin session config
-- invoke_edge_function: SSRF vector to any edge function
-- match_credit_winner_if_due: only called internally by other functions
-- pay_credit_winnings: only called internally by match_credit_winner_if_due
-- match_cleanup_stale: only called by pg_cron
-- =====================================================================
