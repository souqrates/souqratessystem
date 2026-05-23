/*
  # Security Hardening Phase 3 — Function Permissions

  1. SECURITY DEFINER function permissions
    - Revoke EXECUTE from PUBLIC on every SECURITY DEFINER function in the
      `public` schema, then grant EXECUTE explicitly to `anon` and
      `authenticated`. The client only uses the anon key, so PUBLIC grants
      are unnecessary and trip the `public_can_execute_security_definer_function`
      advisor warning.

  2. Internal-only helpers
    - `invoke_edge_function`, `require_manager_admin` and the pay_internal_*
      helpers must NOT be callable from the API. Revoke from anon and
      authenticated entirely; they are only invoked from inside other
      SECDEF functions or cron.

  3. Notes
    - Permission tightening only; no data is altered.
    - Functions remain SECURITY DEFINER so RPC callers continue to work.
*/

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.schema_name, r.func_name, r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated',
      r.schema_name, r.func_name, r.args
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'invoke_edge_function',
        'require_manager_admin',
        'pay_internal_credit',
        'pay_internal_debit',
        'pay_ensure_balance_row'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, PUBLIC',
      r.schema_name, r.func_name, r.args
    );
  END LOOP;
END $$;
