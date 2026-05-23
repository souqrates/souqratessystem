/*
  # Manager Dashboard System

  Full control panel tables for managing the bot without code changes.

  ## Tables
  - manager_config: key-value app settings
  - manager_games: per-game overrides (enable/disable, edit name/reward etc)
  - manager_visitors: user analytics tracking
  - manager_preview_config: staging area for unpublished changes
  - manager_admins: admin authentication by telegram_id
*/

-- ─── manager_config ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT 'text',
  category    text NOT NULL DEFAULT 'general',
  label       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE manager_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read config"
  ON manager_config FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can update config"
  ON manager_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert config"
  ON manager_config FOR INSERT TO authenticated WITH CHECK (true);

-- ─── manager_games ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_games (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     int UNIQUE NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  name_override text,
  emoji_override text,
  reward_override text,
  difficulty_override text,
  desc_override text,
  sort_order  int NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE manager_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read game overrides"
  ON manager_games FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can insert game overrides"
  ON manager_games FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update game overrides"
  ON manager_games FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete game overrides"
  ON manager_games FOR DELETE TO authenticated USING (true);

-- ─── manager_visitors ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_visitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id   bigint UNIQUE NOT NULL,
  first_name    text NOT NULL DEFAULT '',
  username      text NOT NULL DEFAULT '',
  last_seen     timestamptz DEFAULT now(),
  first_seen    timestamptz DEFAULT now(),
  session_count int NOT NULL DEFAULT 1,
  games_played  int NOT NULL DEFAULT 0,
  total_spent   numeric NOT NULL DEFAULT 0,
  total_earned  numeric NOT NULL DEFAULT 0,
  referrer_id   bigint
);

ALTER TABLE manager_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read visitors"
  ON manager_visitors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can upsert visitor data"
  ON manager_visitors FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update visitor data"
  ON manager_visitors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── manager_preview_config ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_preview_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT 'text',
  category    text NOT NULL DEFAULT 'general',
  label       text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE manager_preview_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read preview config"
  ON manager_preview_config FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated can write preview config"
  ON manager_preview_config FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update preview config"
  ON manager_preview_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── manager_admins ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manager_admins (
  telegram_id  bigint PRIMARY KEY,
  name         text NOT NULL DEFAULT 'Admin',
  role         text NOT NULL DEFAULT 'admin',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE manager_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admins for auth"
  ON manager_admins FOR SELECT TO anon, authenticated USING (true);

-- ─── Seed default config ──────────────────────────────────────────────────────
INSERT INTO manager_config (key, value, type, category, label, description) VALUES
  ('app_title',           'Skill Games',                    'text',    'branding', 'App Title',              'Main title shown in navbar'),
  ('app_subtitle',        'Play & Earn Real Crypto',        'text',    'branding', 'App Subtitle',           'Subtitle under the app title'),
  ('app_primary_color',   '#00d4ff',                        'color',   'branding', 'Primary Color',          'Main accent color throughout the app'),
  ('app_secondary_color', '#10b981',                        'color',   'branding', 'Secondary Color',        'Secondary accent color'),
  ('app_bg_color',        '#04030a',                        'color',   'branding', 'Background Color',       'App background color'),
  ('min_deposit',         '1',                              'number',  'payments', 'Min Deposit ($)',         'Minimum deposit amount in USD'),
  ('min_withdrawal',      '10',                             'number',  'payments', 'Min Withdrawal ($)',      'Minimum withdrawal amount in USD'),
  ('welcome_bonus',       '5',                              'number',  'payments', 'Welcome Bonus ($)',       'Bonus given to new users on signup'),
  ('referral_bonus',      '5',                              'number',  'payments', 'Referral Bonus ($)',      'Bonus earned per confirmed referral'),
  ('referral_lifetime',   '10',                             'number',  'payments', 'Referral Lifetime %',    'Lifetime % cut from referrals earnings'),
  ('dashboard_cta',       'Play Now & Earn Real Crypto',    'text',    'texts',    'Dashboard CTA Button',   'Text on main play button on dashboard'),
  ('wallet_deposit_note', 'Send your crypto to the address below', 'text', 'texts', 'Deposit Note',          'Instruction text on deposit screen'),
  ('referral_reward_text','Earn $5 for every friend who joins & deposits', 'text', 'texts', 'Referral Reward Text', 'Text shown on referral page'),
  ('solo_games_enabled',  'true',                           'boolean', 'features', 'Solo Games Enabled',     'Enable/disable solo games category'),
  ('duo_games_enabled',   'true',                           'boolean', 'features', '2-Player Games Enabled', 'Enable/disable 2-player games category'),
  ('quad_games_enabled',  'true',                           'boolean', 'features', '4-Player Games Enabled', 'Enable/disable 4-player games category'),
  ('group_games_enabled', 'true',                           'boolean', 'features', 'Group Tournaments',      'Enable/disable group tournament category'),
  ('maintenance_mode',    'false',                          'boolean', 'features', 'Maintenance Mode',       'Show maintenance page to all users'),
  ('daily_bonus_amount',  '2',                              'number',  'rewards',  'Daily Login Bonus ($)',   'Daily bonus for logging in'),
  ('max_daily_wins',      '10',                             'number',  'rewards',  'Max Daily Wins',         'Maximum wins counted per day per user')
ON CONFLICT (key) DO NOTHING;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_manager_config_category   ON manager_config(category);
CREATE INDEX IF NOT EXISTS idx_manager_visitors_last_seen ON manager_visitors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_manager_visitors_spent     ON manager_visitors(total_spent DESC);
