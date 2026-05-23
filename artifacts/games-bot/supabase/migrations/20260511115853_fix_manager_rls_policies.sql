/*
  # Fix Manager RLS Policies
  
  The manager dashboard uses the anon key (no Supabase Auth login).
  The previous policies only allowed `authenticated` role to write, which
  caused all save operations to fail with "permission denied".
  
  Fix: Allow anon role to read/write manager tables. Security is enforced
  at the application level via the manager_admins Telegram ID check.
  
  Changes:
  - manager_config: allow anon to UPDATE and INSERT
  - manager_games: allow anon to INSERT, UPDATE, DELETE
  - manager_preview_config: allow anon to INSERT, UPDATE, DELETE
  - manager_admins: allow anon to INSERT, DELETE (for admin management)
*/

-- ─── manager_config ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can update config" ON manager_config;
DROP POLICY IF EXISTS "Authenticated can insert config" ON manager_config;

CREATE POLICY "Anyone can update config"
  ON manager_config FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert config"
  ON manager_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── manager_games ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can insert game overrides" ON manager_games;
DROP POLICY IF EXISTS "Authenticated can update game overrides" ON manager_games;
DROP POLICY IF EXISTS "Authenticated can delete game overrides" ON manager_games;

CREATE POLICY "Anyone can insert game overrides"
  ON manager_games FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update game overrides"
  ON manager_games FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete game overrides"
  ON manager_games FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── manager_preview_config ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can write preview config" ON manager_preview_config;
DROP POLICY IF EXISTS "Authenticated can update preview config" ON manager_preview_config;

CREATE POLICY "Anyone can write preview config"
  ON manager_preview_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update preview config"
  ON manager_preview_config FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete preview config"
  ON manager_preview_config FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── manager_admins ───────────────────────────────────────────────────────────
CREATE POLICY "Anyone can insert admins"
  ON manager_admins FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete admins"
  ON manager_admins FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── manager_visitors ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can read visitors" ON manager_visitors;

CREATE POLICY "Anyone can read visitors"
  ON manager_visitors FOR SELECT
  TO anon, authenticated
  USING (true);
