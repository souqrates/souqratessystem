
/*
  # Create RPC wrapper for setting admin session variable

  Exposes a PostgREST-callable function that sets app.admin_id
  as a local session variable. Used by the manager client to
  authorize write operations checked by RLS policies.
*/

CREATE OR REPLACE FUNCTION set_admin_id(admin_telegram_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.admin_id', admin_telegram_id::text, true);
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION set_admin_id(bigint) TO anon;
GRANT EXECUTE ON FUNCTION set_admin_id(bigint) TO authenticated;
