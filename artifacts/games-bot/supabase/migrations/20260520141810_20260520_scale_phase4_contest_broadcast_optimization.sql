/*
  # Phase 4 — Contest Broadcast Optimization & Rate-Limited Score Submission

  1. New/Replaced Functions
     - `contest_submit_score` — submits score to tournament_players; validates player is in room
     - `get_contest_leaderboard` — fast leaderboard for a contest room
     - `match_submit_score_ratelimited` — rate-limited wrapper around match_submit_score

  2. Notes
     - tournament_rooms.id and tournament_players.room_id are TEXT (not UUID)
     - No UUID casting needed
*/

-- ── contest_submit_score ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contest_submit_score(
  p_session_id  text,
  p_room_id     text,
  p_score       int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telegram_id bigint;
  v_room        tournament_rooms%ROWTYPE;
  v_player      tournament_players%ROWTYPE;
BEGIN
  -- Resolve session
  SELECT pay_resolve_session(p_session_id) INTO v_telegram_id;
  IF v_telegram_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Load room
  SELECT * INTO v_room FROM tournament_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'room_not_found');
  END IF;

  IF v_room.status NOT IN ('playing', 'countdown') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'room_not_active', 'status', v_room.status);
  END IF;

  -- Find player record
  SELECT * INTO v_player
  FROM tournament_players
  WHERE room_id = p_room_id AND player_id = v_telegram_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_in_room');
  END IF;

  -- Only update if score is higher
  IF p_score > COALESCE(v_player.score, 0) THEN
    UPDATE tournament_players
    SET score = p_score, updated_at = now()
    WHERE room_id = p_room_id AND player_id = v_telegram_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', p_score);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contest_submit_score(text, text, int) TO authenticated, anon;

-- ── get_contest_leaderboard ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(
  p_room_id text,
  p_limit   int DEFAULT 50
)
RETURNS TABLE(
  player_id   bigint,
  player_name text,
  score       int,
  rank        int,
  joined_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tp.player_id,
    tp.player_name,
    COALESCE(tp.score, 0)::int AS score,
    ROW_NUMBER() OVER (ORDER BY COALESCE(tp.score, 0) DESC)::int AS rank,
    tp.joined_at
  FROM tournament_players tp
  WHERE tp.room_id = p_room_id
  ORDER BY COALESCE(tp.score, 0) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard(text, int) TO authenticated, anon;

-- ── match_submit_score_ratelimited ────────────────────────────────────────────
-- Thin wrapper: checks rate limit then delegates to match_submit_score
CREATE OR REPLACE FUNCTION public.match_submit_score_ratelimited(
  p_session_id text,
  p_room_id    text,
  p_score      int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telegram_id bigint;
  v_allowed     boolean;
BEGIN
  SELECT pay_resolve_session(p_session_id) INTO v_telegram_id;
  IF v_telegram_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- 30 score submits per minute per player per room
  SELECT check_rate_limit(
    'score_submit:' || v_telegram_id::text || ':' || p_room_id,
    'score_submit',
    30,
    60
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  -- Delegate to existing match_submit_score
  RETURN public.match_submit_score(p_session_id, p_room_id, p_score);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_submit_score_ratelimited(text, text, int) TO authenticated, anon;
