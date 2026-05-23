/*
  # Game System: Sessions, XP, Tickets & Leaderboard

  ## Summary
  Sets up the core economy and progression infrastructure for skill-based mini-games.

  ## New Tables

  ### 1. `player_profiles`
  Stores per-player game stats, XP, level, and passive skill unlocks.
  - Links to auth.users via user_id (uuid)
  - telegram_id stored for display purposes

  ### 2. `game_sessions`
  Immutable audit log of every game attempt for anti-cheat verification.

  ### 3. `hall_of_fame`
  Top scores per game — public read, restricted write.

  ## Security
  - RLS enabled on all tables
  - Players access only their own data via auth.uid()
  - Hall of fame is public read only
*/

-- Player profiles
CREATE TABLE IF NOT EXISTS player_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id      bigint,
  username         text NOT NULL DEFAULT '',
  xp               int NOT NULL DEFAULT 0,
  level            int NOT NULL DEFAULT 1,
  tickets          int NOT NULL DEFAULT 3,
  daily_free_used  date,
  total_earnings_usd numeric(12,2) NOT NULL DEFAULT 0,
  record_score     jsonb NOT NULL DEFAULT '{}'::jsonb,
  passive_skills   jsonb NOT NULL DEFAULT '{}'::jsonb,
  legend_badge     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own profile"
  ON player_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Players can insert own profile"
  ON player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update own profile"
  ON player_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Game sessions (immutable audit log)
CREATE TABLE IF NOT EXISTS game_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id           int NOT NULL,
  move_log          jsonb NOT NULL DEFAULT '[]'::jsonb,
  score             int NOT NULL DEFAULT 0,
  result            text NOT NULL DEFAULT 'abandoned',
  earnings_usd      numeric(10,2) NOT NULL DEFAULT 0,
  xp_earned         int NOT NULL DEFAULT 0,
  reaction_times_ms jsonb NOT NULL DEFAULT '[]'::jsonb,
  flagged_cheat     boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own sessions"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Players can insert own sessions"
  ON game_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Hall of fame (public leaderboard)
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username     text NOT NULL DEFAULT '',
  game_id      int NOT NULL,
  score        int NOT NULL DEFAULT 0,
  earnings_usd numeric(10,2) NOT NULL DEFAULT 0,
  achieved_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hall of fame"
  ON hall_of_fame FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated players can insert hall of fame"
  ON hall_of_fame FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hall_of_fame_game_score ON hall_of_fame (game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions (user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_player_profiles_user ON player_profiles (user_id);
