/*
  # Critical security hardening — gamification RLS, manager rate-limit, guest sessions

  ## Summary
  Closes three critical vulnerabilities reported in the security audit:

  1. **Gamification RLS leakage** — `user_gamification`, `daily_streaks`,
     `user_achievements`, and `user_quest_progress` previously allowed any
     anon caller to read all rows. Direct anon SELECT is now denied; reads
     happen through new `SECURITY DEFINER` RPCs that resolve the caller's
     identity from a session id.
  2. **Manager web login brute-force** — `manager_web_login` had no
     attempt throttling. A new `manager_login_attempts` table tracks
     attempts per `telegram_id`; the RPC now refuses requests after
     5 failed attempts in a 15-minute window and enforces a minimum
     passcode length of 8.
  3. **Guest session abuse** — `pay_create_guest_session` could be called
     unbounded by any anon caller. The RPC now enforces a global rate-limit
     of 30 new guest sessions per minute and 500 per hour, recorded in a
     new `guest_session_throttle` table.

  ## Changes

  ### 1. Gamification RLS lockdown
  - Drop permissive `USING (true)` SELECT policies on:
    `user_gamification`, `daily_streaks`, `user_achievements`,
    `user_quest_progress`.
  - Tables remain RLS-enabled with no anon/auth SELECT — all reads route
    through new RPCs.

  ### 2. New RPCs (SECURITY DEFINER)
  - `gm_get_user_state(p_session_id)` — returns the caller's own
    `user_gamification`, `daily_streak`, and unlocked achievements.
  - `gm_get_top_players(p_limit)` — public-safe leaderboard. Returns only
    aggregated columns (`anon_label`, `xp`, `level`, `total_wins`) and
    deliberately omits `telegram_id` to prevent enumeration.

  ### 3. New tables
  - `manager_login_attempts(id, telegram_id, attempted_at, success)`
    — RLS enabled, no client access (RPC-only).
  - `guest_session_throttle(id, created_at)` — RLS enabled, no client
    access; used purely as a sliding-window counter.

  ## Security
  - All new RPCs are `SECURITY DEFINER` with `search_path` pinned.
  - New tables have RLS enabled with **no** policies — only the
    SECURITY DEFINER RPCs (or service role) can touch them.
  - No data is dropped or migrated; existing rows untouched.

  ## Notes
  1. Catalog tables (`achievements_catalog`, `quests_catalog`) remain
     publicly readable — they contain no user data.
  2. The minimum-passcode-length check applies at login. Existing short
     passcodes will simply be rejected; admins must re-register a stronger
     passcode via the manager bot.
*/

-- =============================================================
-- 1. GAMIFICATION RLS LOCKDOWN
-- =============================================================

DROP POLICY IF EXISTS "Anon can read gamification" ON user_gamification;
DROP POLICY IF EXISTS "Anyone authenticated can read gamification" ON user_gamification;
DROP POLICY IF EXISTS "Anon can read streaks" ON daily_streaks;
DROP POLICY IF EXISTS "Auth can read streaks" ON daily_streaks;
DROP POLICY IF EXISTS "Anon can read user achievements" ON user_achievements;
DROP POLICY IF EXISTS "Auth can read user achievements" ON user_achievements;
DROP POLICY IF EXISTS "Anon can read quest progress" ON user_quest_progress;
DROP POLICY IF EXISTS "Auth can read own quest progress" ON user_quest_progress;

-- Tables remain RLS-enabled with no SELECT policies = no direct reads.

-- =============================================================
-- 2. GAMIFICATION READ RPCs (session-bound)
-- =============================================================

CREATE OR REPLACE FUNCTION public.gm_get_user_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg          bigint;
  v_gam         jsonb;
  v_streak      jsonb;
  v_achievements jsonb;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  SELECT to_jsonb(g.*) INTO v_gam
  FROM user_gamification g
  WHERE g.telegram_id = v_tg;

  SELECT to_jsonb(s.*) INTO v_streak
  FROM daily_streaks s
  WHERE s.telegram_id = v_tg;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'achievement_code', a.achievement_code,
           'unlocked_at',      a.unlocked_at
         )), '[]'::jsonb)
  INTO v_achievements
  FROM user_achievements a
  WHERE a.telegram_id = v_tg;

  RETURN jsonb_build_object(
    'gamification', COALESCE(v_gam, '{}'::jsonb),
    'streak',       COALESCE(v_streak, '{}'::jsonb),
    'achievements', v_achievements
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gm_get_user_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_get_user_state(uuid) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.gm_get_top_players(p_limit integer DEFAULT 5)
RETURNS TABLE(rank integer, anon_label text, xp integer, level integer, total_wins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer;
BEGIN
  v_limit := GREATEST(1, LEAST(50, COALESCE(p_limit, 5)));

  RETURN QUERY
  WITH ranked AS (
    SELECT g.telegram_id,
           g.xp,
           g.level,
           g.total_wins,
           ROW_NUMBER() OVER (ORDER BY g.xp DESC, g.telegram_id ASC) AS rn
    FROM user_gamification g
    ORDER BY g.xp DESC
    LIMIT v_limit
  )
  SELECT r.rn::int AS rank,
         'Player #' || LPAD((ABS(r.telegram_id) % 100000)::text, 5, '0') AS anon_label,
         r.xp,
         r.level,
         r.total_wins
  FROM ranked r
  ORDER BY r.rn;
END;
$function$;

REVOKE ALL ON FUNCTION public.gm_get_top_players(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_get_top_players(integer) TO anon, authenticated;


-- =============================================================
-- 3. MANAGER LOGIN RATE-LIMIT
-- =============================================================

CREATE TABLE IF NOT EXISTS manager_login_attempts (
  id            bigserial PRIMARY KEY,
  telegram_id   bigint NOT NULL,
  attempted_at  timestamptz NOT NULL DEFAULT now(),
  success       boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mla_tg_time
  ON manager_login_attempts (telegram_id, attempted_at DESC);

ALTER TABLE manager_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions and service role can access.


CREATE OR REPLACE FUNCTION public.manager_web_login(p_telegram_id bigint, p_passcode text)
RETURNS TABLE(telegram_id bigint, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_hash        text;
  v_fail_count  integer;
  v_ok          boolean := false;
BEGIN
  IF p_telegram_id IS NULL OR p_passcode IS NULL OR length(p_passcode) < 8 THEN
    INSERT INTO manager_login_attempts (telegram_id, success)
    VALUES (COALESCE(p_telegram_id, 0), false);
    RETURN;
  END IF;

  -- Rate-limit: 5 failed attempts in the last 15 minutes -> lockout
  SELECT count(*) INTO v_fail_count
  FROM manager_login_attempts
  WHERE telegram_id = p_telegram_id
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_fail_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '53400';
  END IF;

  SELECT a.web_passcode_hash INTO v_hash
  FROM manager_admins a
  WHERE a.telegram_id = p_telegram_id;

  IF v_hash IS NOT NULL AND crypt(p_passcode, v_hash) = v_hash THEN
    v_ok := true;
  END IF;

  INSERT INTO manager_login_attempts (telegram_id, success)
  VALUES (p_telegram_id, v_ok);

  IF v_ok THEN
    RETURN QUERY
    SELECT a.telegram_id, a.name, a.role
    FROM manager_admins a
    WHERE a.telegram_id = p_telegram_id;
  END IF;
END;
$function$;


-- =============================================================
-- 4. GUEST SESSION THROTTLE
-- =============================================================

CREATE TABLE IF NOT EXISTS guest_session_throttle (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gst_created
  ON guest_session_throttle (created_at DESC);

ALTER TABLE guest_session_throttle ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions and service role can access.


CREATE OR REPLACE FUNCTION public.pay_create_guest_session(p_guest_tg_id bigint, p_first_name text DEFAULT 'Guest'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_session_id  uuid;
  v_expires_at  timestamptz;
  v_tg_id       bigint;
  v_recent_min  integer;
  v_recent_hour integer;
BEGIN
  -- Global rate-limit: 30/min, 500/hour
  SELECT count(*) INTO v_recent_min
  FROM guest_session_throttle
  WHERE created_at > now() - interval '1 minute';

  IF v_recent_min >= 30 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '53400';
  END IF;

  SELECT count(*) INTO v_recent_hour
  FROM guest_session_throttle
  WHERE created_at > now() - interval '1 hour';

  IF v_recent_hour >= 500 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '53400';
  END IF;

  INSERT INTO guest_session_throttle DEFAULT VALUES;

  -- Best-effort cleanup of very old throttle rows
  DELETE FROM guest_session_throttle
  WHERE created_at < now() - interval '2 hours';

  -- Ignore client-provided guest id to prevent collision/impersonation;
  -- always allocate a fresh negative id.
  v_tg_id := -(floor(random() * 1000000000)::bigint + 1);

  INSERT INTO telegram_sessions (
    telegram_id, username, first_name, last_name,
    photo_url, language_code, is_premium,
    init_data_hash, auth_date, start_param
  ) VALUES (
    v_tg_id, '', COALESCE(NULLIF(p_first_name, ''), 'Guest'), '',
    '', 'en', false,
    'guest', now(), ''
  )
  RETURNING id, expires_at INTO v_session_id, v_expires_at;

  INSERT INTO manager_visitors (telegram_id, first_name, username, last_seen)
  VALUES (v_tg_id, COALESCE(NULLIF(p_first_name, ''), 'Guest'), '', now())
  ON CONFLICT (telegram_id) DO UPDATE SET last_seen = excluded.last_seen;

  RETURN jsonb_build_object(
    'session_id',  v_session_id,
    'telegram_id', v_tg_id,
    'expires_at',  v_expires_at
  );
END;
$function$;
