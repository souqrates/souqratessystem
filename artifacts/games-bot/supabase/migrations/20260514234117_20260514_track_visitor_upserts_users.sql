/*
  # Ensure track_visitor creates a row in the users table

  1. Problem
    - The `track_visitor` RPC only inserts into `manager_visitors`
    - The `user_update_profile` RPC updates the `users` table
    - Since no row exists in `users`, profile edits fail with "user not found"

  2. Fix
    - Update `track_visitor` to also upsert a row into `public.users`
      so that profile editing, leaderboard lookups, and other RPCs
      that query the `users` table can find the user

  3. Tables modified
    - No schema changes; only the `track_visitor` function body is updated
*/

CREATE OR REPLACE FUNCTION track_visitor(
  p_telegram_id bigint,
  p_first_name  text DEFAULT '',
  p_username    text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_telegram_id IS NULL THEN
    RETURN;
  END IF;

  -- Upsert into manager_visitors (analytics)
  INSERT INTO manager_visitors (telegram_id, first_name, username, last_seen, session_count)
  VALUES (p_telegram_id, coalesce(p_first_name,''), coalesce(p_username,''), now(), 1)
  ON CONFLICT (telegram_id) DO UPDATE
    SET first_name    = EXCLUDED.first_name,
        username      = EXCLUDED.username,
        last_seen     = now(),
        session_count = coalesce(manager_visitors.session_count,0) + 1;

  -- Upsert into users (profile, leaderboard, game data)
  INSERT INTO public.users (telegram_id, first_name, username, created_at, updated_at)
  VALUES (p_telegram_id, coalesce(p_first_name,''), coalesce(p_username,''), now(), now())
  ON CONFLICT (telegram_id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        username   = EXCLUDED.username,
        updated_at = now();
END;
$$;
