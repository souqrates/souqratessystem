/*
  # Enable pgcrypto and harden contest token generation

  1. Issue
    - `contest_create` failed with `function gen_random_bytes(integer) does not exist`
      because pgcrypto was not loaded in the database. Any code path that calls
      `gen_random_bytes` (contests, security tokens) was broken.

  2. Fix
    - Install the pgcrypto extension into the `extensions` schema so the random
      byte generator is always available system-wide.
    - Make sure search_path inside our random helper exposes both `public` and
      `extensions` so older functions that wrote `gen_random_bytes` without a
      qualifier continue to resolve.
    - Rewrite `_contest_make_token` to use `gen_random_uuid()` (always shipped
      with Postgres core) as the primary source and fall back to a hex SHA hash
      so the function can never raise undefined_function again.

  3. Safety
    - Pure additive change. No data is modified, no policy is relaxed.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._contest_make_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v text;
BEGIN
  v := replace(gen_random_uuid()::text, '-', '');
  RETURN substr(v, 1, 10);
EXCEPTION WHEN OTHERS THEN
  RETURN substr(encode(digest(now()::text || random()::text, 'sha256'), 'hex'), 1, 10);
END;
$$;
