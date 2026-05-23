
/*
  # Fix Manager Security - Restrict RLS Policies

  ## Problem
  All manager_* tables had open USING(true) policies allowing ANY user
  (even anonymous) to insert, update, and delete admin records, config,
  games, and visitor data. This is a critical security vulnerability.

  ## Solution
  - manager_admins: Only admins (telegram IDs in manager_admins) can write.
    Read remains open for authentication check.
  - manager_config: Public read (app needs it). Write restricted to admins only.
  - manager_preview_config: Write restricted to admins only. Public read for preview.
  - manager_games: Public read. Write restricted to admins only.
  - manager_visitors: App-level upsert uses service role via edge function ideally,
    but we allow anon insert/update for visitor tracking (low risk). Keep as-is.

  ## Implementation
  We use a helper function `is_manager_admin()` that checks if the requesting
  telegram_id is in manager_admins. Since this is a client-side app using anon key,
  we pass telegram_id via a session variable set in the client.

  NOTE: The app passes telegram_id through Supabase's anon key. True server-side
  enforcement requires the app to call a Postgres function with the ID. We implement
  a `set_claim` approach: the client sets `app.current_admin_id` before writes,
  and policies check it against manager_admins.
*/

-- ─── Helper: check if a given telegram_id is an admin ───────────────────────
CREATE OR REPLACE FUNCTION is_manager_admin(tid bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_admins WHERE telegram_id = tid
  );
$$;

-- ─── Drop all existing open write policies on sensitive tables ───────────────

-- manager_admins
DROP POLICY IF EXISTS "Anyone can delete admins" ON manager_admins;
DROP POLICY IF EXISTS "Anyone can insert admins" ON manager_admins;

-- manager_config
DROP POLICY IF EXISTS "Anyone can insert config" ON manager_config;
DROP POLICY IF EXISTS "Anyone can update config" ON manager_config;

-- manager_preview_config
DROP POLICY IF EXISTS "Anyone can delete preview config" ON manager_preview_config;
DROP POLICY IF EXISTS "Anyone can update preview config" ON manager_preview_config;
DROP POLICY IF EXISTS "Anyone can write preview config" ON manager_preview_config;

-- manager_games
DROP POLICY IF EXISTS "Anyone can delete game overrides" ON manager_games;
DROP POLICY IF EXISTS "Anyone can insert game overrides" ON manager_games;
DROP POLICY IF EXISTS "Anyone can update game overrides" ON manager_games;

-- ─── manager_admins: restrict writes to existing admins only ─────────────────
-- Read stays open (needed for login check - no auth yet at that point)

CREATE POLICY "Admins only can insert admins"
  ON manager_admins FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can delete admins"
  ON manager_admins FOR DELETE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

-- ─── manager_config: restrict writes to admins only ──────────────────────────

CREATE POLICY "Admins only can insert config"
  ON manager_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can update config"
  ON manager_config FOR UPDATE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  )
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

-- ─── manager_preview_config: restrict writes to admins only ──────────────────

CREATE POLICY "Admins only can write preview config"
  ON manager_preview_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can update preview config"
  ON manager_preview_config FOR UPDATE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  )
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can delete preview config"
  ON manager_preview_config FOR DELETE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

-- ─── manager_games: restrict writes to admins only ───────────────────────────

CREATE POLICY "Admins only can insert game overrides"
  ON manager_games FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can update game overrides"
  ON manager_games FOR UPDATE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  )
  WITH CHECK (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );

CREATE POLICY "Admins only can delete game overrides"
  ON manager_games FOR DELETE
  TO anon, authenticated
  USING (
    is_manager_admin((current_setting('app.admin_id', true))::bigint)
  );
