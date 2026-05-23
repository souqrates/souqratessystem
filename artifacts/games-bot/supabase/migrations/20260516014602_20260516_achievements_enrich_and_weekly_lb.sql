/*
  # Enrich Achievements System & Weekly Leaderboard

  ## Changes
  1. Add missing columns to achievements_catalog: color, category
  2. Seed achievements with full metadata
  3. Add RPC get_user_achievements using existing schema
  4. Add RPC get_weekly_leaderboard
*/

-- Add missing columns to existing achievements_catalog
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements_catalog' AND column_name='color') THEN
    ALTER TABLE achievements_catalog ADD COLUMN color text NOT NULL DEFAULT '#f59e0b';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements_catalog' AND column_name='category') THEN
    ALTER TABLE achievements_catalog ADD COLUMN category text NOT NULL DEFAULT 'gaming'
      CHECK (category IN ('gaming','social','financial','milestone','special'));
  END IF;
END $$;

-- Seed the catalog — using the existing schema (no id column, code is PK)
INSERT INTO achievements_catalog (code, name, description, icon, xp_reward, tier, threshold, sort_order, color, category) VALUES
  ('first_win',         'First Blood',        'Win your very first match',                      'sword',      100,  'starter',   1,   1,  '#22d3ee', 'gaming'),
  ('win_5',             'On a Roll',          'Win 5 matches total',                             'flame',      150,  'novice',    5,   2,  '#f97316', 'gaming'),
  ('win_25',            'Veteran',            'Win 25 matches — you are no rookie',              'shield',     300,  'fighter',   25,  3,  '#10b981', 'gaming'),
  ('win_100',           'Century',            'Win 100 matches — legendary grind',               'trophy',     800,  'champion',  100, 4,  '#f59e0b', 'gaming'),
  ('streak_3',          'Hot Streak',         'Win 3 matches in a row',                          'zap',        200,  'novice',    3,   5,  '#fbbf24', 'gaming'),
  ('streak_5',          'Unstoppable',        'Win 5 matches in a row',                          'crown',      500,  'fighter',   5,   6,  '#f59e0b', 'gaming'),
  ('play_solo',         'Solo Warrior',       'Complete your first solo match',                  'user',       50,   'starter',   1,   7,  '#22d3ee', 'gaming'),
  ('play_pvp',          'The Challenger',     'Complete your first 2-player duel',               'swords',     75,   'starter',   1,   8,  '#10b981', 'gaming'),
  ('play_quad',         'Arena Fighter',      'Complete your first 4-player match',              'users',      100,  'novice',    1,   9,  '#f59e0b', 'gaming'),
  ('play_tournament',   'Tournament Bound',   'Join your first group tournament',                'award',      150,  'novice',    1,   10, '#fb7185', 'gaming'),
  ('hard_win',          'Bring the Heat',     'Win a Hard difficulty match',                     'flame',      250,  'fighter',   1,   11, '#ef4444', 'gaming'),
  ('games_10',          'Gamer',              'Play 10 total matches',                           'gamepad-2',  100,  'starter',   10,  12, '#06b6d4', 'gaming'),
  ('games_50',          'Dedicated Player',   'Play 50 total matches',                           'target',     350,  'fighter',   50,  13, '#22d3ee', 'gaming'),
  ('games_200',         'Grind Master',       'Play 200 total matches',                          'star',       1000, 'champion',  200, 14, '#f59e0b', 'gaming'),
  ('level_5',           'Rising Star',        'Reach Level 5',                                   'sparkles',   200,  'novice',    5,   20, '#22d3ee', 'milestone'),
  ('level_10',          'Veteran Rank',       'Reach Level 10 — Elite tier unlocked',            'medal',      500,  'elite',     10,  21, '#f59e0b', 'milestone'),
  ('level_15',          'Master Class',       'Reach Level 15 — Masters tier',                   'crown',      1000, 'master',    15,  22, '#facc15', 'milestone'),
  ('level_20',          'Sovereign',          'Reach Level 20 — The pinnacle',                   'gem',        2500, 'mythic',    20,  23, '#fbbf24', 'milestone'),
  ('xp_1000',           'XP Hunter',          'Earn 1,000 total XP',                             'zap',        100,  'starter',   1000, 24,'#22d3ee', 'milestone'),
  ('xp_10000',          'XP Collector',       'Earn 10,000 total XP',                            'star',       300,  'fighter',   10000,25,'#f59e0b', 'milestone'),
  ('login_3',           'Warming Up',         'Login 3 days in a row',                           'calendar',   100,  'starter',   3,   30, '#22d3ee', 'special'),
  ('login_7',           'Week Warrior',       'Login 7 days in a row',                           'flame',      300,  'novice',    7,   31, '#f97316', 'special'),
  ('login_30',          'Dedicated',          'Login 30 days in a row',                          'trophy',     1000, 'champion',  30,  32, '#f59e0b', 'special'),
  ('first_deposit',     'Money In',           'Make your first deposit',                         'wallet',     100,  'starter',   1,   40, '#10b981', 'financial'),
  ('first_withdrawal',  'Cash Out',           'Make your first withdrawal',                      'arrow-up',   100,  'starter',   1,   41, '#22d3ee', 'financial'),
  ('first_referral',    'Recruiter',          'Invite your first friend',                        'user-plus',  200,  'novice',    1,   50, '#10b981', 'social'),
  ('referrals_5',       'Team Builder',       'Invite 5 friends to the platform',                'users',      500,  'fighter',   5,   51, '#22d3ee', 'social'),
  ('referrals_10',      'Influencer',         'Invite 10 friends — you are an ambassador',       'megaphone',  1500, 'champion',  10,  52, '#f59e0b', 'social')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  xp_reward   = EXCLUDED.xp_reward,
  sort_order  = EXCLUDED.sort_order,
  color       = EXCLUDED.color,
  category    = EXCLUDED.category;

-- ─── RPC: GET USER ACHIEVEMENTS ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_achievements(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tg bigint;
  v_result jsonb;
BEGIN
  SELECT telegram_id INTO v_tg FROM user_sessions WHERE session_id = p_session_id AND expires_at > now();
  IF v_tg IS NULL THEN RETURN jsonb_build_object('ok', false, 'items', '[]'::jsonb); END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'total', COUNT(*),
    'unlocked_count', COUNT(ua.telegram_id),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'code',        ac.code,
        'name',        ac.name,
        'description', ac.description,
        'icon',        ac.icon,
        'color',       COALESCE(ac.color, '#f59e0b'),
        'xp_reward',   ac.xp_reward,
        'category',    COALESCE(ac.category, 'gaming'),
        'sort_order',  ac.sort_order,
        'unlocked',    (ua.telegram_id IS NOT NULL),
        'unlocked_at', ua.unlocked_at
      ) ORDER BY (ua.telegram_id IS NOT NULL) DESC, ac.sort_order
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM achievements_catalog ac
  LEFT JOIN user_achievements ua ON ua.achievement_code = ac.code AND ua.telegram_id = v_tg;

  RETURN v_result;
END;
$$;

-- ─── RPC: WEEKLY LEADERBOARD ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_weekly_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE(
  telegram_id  bigint,
  username     text,
  display_name text,
  avatar_url   text,
  anon_label   text,
  total_won    numeric,
  total_wins   bigint,
  level        int,
  rank         bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.telegram_id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.anon_label,
    COALESCE(SUM(CASE WHEN l.direction='credit' AND l.created_at >= now() - interval '7 days'
                 THEN l.amount_token ELSE 0 END), 0)::numeric AS total_won,
    COUNT(CASE WHEN l.direction='credit' AND l.category IN ('match_win','solo_reward','contest_prize')
               AND l.created_at >= now() - interval '7 days' THEN 1 END) AS total_wins,
    COALESCE(ub.level, 1)::int AS level,
    ROW_NUMBER() OVER (ORDER BY
      COALESCE(SUM(CASE WHEN l.direction='credit' AND l.created_at >= now() - interval '7 days'
                   THEN l.amount_token ELSE 0 END), 0) DESC
    ) AS rank
  FROM users u
  LEFT JOIN user_balances ub ON ub.telegram_id = u.telegram_id
  LEFT JOIN ledger l ON l.telegram_id = u.telegram_id
  WHERE u.telegram_id IS NOT NULL
  GROUP BY u.telegram_id, u.username, u.display_name, u.avatar_url, u.anon_label, ub.level
  HAVING COALESCE(SUM(CASE WHEN l.direction='credit' AND l.created_at >= now() - interval '7 days'
                      THEN l.amount_token ELSE 0 END), 0) > 0
  ORDER BY total_won DESC
  LIMIT p_limit;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_user_achievements(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_leaderboard(int) TO anon, authenticated;
