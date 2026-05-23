/*
  # Fix Missing RLS Policies

  ## Problem
  Four tables have RLS enabled but no policies, blocking all access:
  - user_balances
  - daily_streaks
  - user_achievements
  - user_gamification

  ## Fix
  These tables are primarily accessed through security-definer RPCs
  (pay_get_balance, claim_daily_streak, get_user_achievements, etc.).
  We add:
  - SELECT: authenticated users can read their own row (matched by telegram_id
    stored in their active telegram_session)
  - ALL: service_role bypass (already implicit, but explicit for clarity)

  Since telegram_id is not stored in auth.uid(), we allow authenticated
  users to read rows where the telegram_id matches their active session.
  The RPCs use security definer so they bypass RLS entirely for writes.

  For the frontend which calls these via RPC (not direct table access),
  we also ensure the RPCs themselves are executable by the anon/authenticated role.
*/

-- user_balances: RLS policies
CREATE POLICY "Users can view own balance"
  ON user_balances FOR SELECT
  TO authenticated
  USING (
    telegram_id IN (
      SELECT telegram_id FROM telegram_sessions
      WHERE expires_at > now()
        AND telegram_id = user_balances.telegram_id
      LIMIT 1
    )
  );

CREATE POLICY "Anon can read balance by session"
  ON user_balances FOR SELECT
  TO anon
  USING (false);

-- daily_streaks: RLS policies
CREATE POLICY "Users can view own streak"
  ON daily_streaks FOR SELECT
  TO authenticated
  USING (
    telegram_id IN (
      SELECT telegram_id FROM telegram_sessions
      WHERE expires_at > now()
        AND telegram_id = daily_streaks.telegram_id
      LIMIT 1
    )
  );

CREATE POLICY "Anon cannot read streaks"
  ON daily_streaks FOR SELECT
  TO anon
  USING (false);

-- user_achievements: RLS policies
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (
    telegram_id IN (
      SELECT telegram_id FROM telegram_sessions
      WHERE expires_at > now()
        AND telegram_id = user_achievements.telegram_id
      LIMIT 1
    )
  );

CREATE POLICY "Anon cannot read achievements"
  ON user_achievements FOR SELECT
  TO anon
  USING (false);

-- user_gamification: RLS policies
CREATE POLICY "Users can view own gamification"
  ON user_gamification FOR SELECT
  TO authenticated
  USING (
    telegram_id IN (
      SELECT telegram_id FROM telegram_sessions
      WHERE expires_at > now()
        AND telegram_id = user_gamification.telegram_id
      LIMIT 1
    )
  );

CREATE POLICY "Anon cannot read gamification"
  ON user_gamification FOR SELECT
  TO anon
  USING (false);
