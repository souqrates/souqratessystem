/*
  # Performance: Batch RPCs for Bot Scores and Rankings

  Replaces sequential per-bot RPC calls with single set-based operations.

  ## New Functions

  1. match_submit_all_bot_scores(p_room_id, p_scores jsonb)
     - Accepts array of {bot_id, score} objects
     - Submits all bot scores in a single transaction
     - Replaces the N+1 loop in bot_fill that called match_submit_bot_score per bot

  2. tour_finalize_rankings(p_room_id text)
     - Updates all player ranks in a single UPDATE ... SET rank = subquery
     - Replaces the row-by-row rank update loop that made N sequential writes

  3. tour_submit_bot_scores_batch(p_room_id text, p_scores jsonb)
     - Updates all bot scores in tournament_players in a single UPDATE with CASE
     - Replaces the per-bot loop in submit_bot_scores_group

  4. pay_batch_credit(p_credits jsonb)
     - Credits multiple users in a single function call
     - Each credit still gets its own ledger entry (financial integrity)
     - But all happen in one DB round-trip instead of N
*/

-- ── 1. match_submit_all_bot_scores ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_submit_all_bot_scores(
  p_room_id text,
  p_scores  jsonb   -- [{bot_id: number, score: number}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     jsonb;
  v_bot_id   bigint;
  v_score    int;
  v_count    int := 0;
  v_result   jsonb;
BEGIN
  IF jsonb_array_length(p_scores) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'submitted', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores)
  LOOP
    v_bot_id := (v_item->>'bot_id')::bigint;
    v_score  := (v_item->>'score')::int;

    SELECT public.match_submit_bot_score(p_room_id, v_bot_id, v_score) INTO v_result;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'submitted', v_count);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'submitted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_submit_all_bot_scores(text, jsonb) TO authenticated, anon;

-- ── 2. tour_finalize_rankings ─────────────────────────────────────────────────
-- Updates all player ranks for a tournament room in ONE query using window functions
CREATE OR REPLACE FUNCTION public.tour_finalize_rankings(p_room_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY COALESCE(score, 0) DESC) AS new_rank
    FROM tournament_players
    WHERE room_id = p_room_id
  )
  UPDATE tournament_players tp
  SET rank = ranked.new_rank
  FROM ranked
  WHERE tp.id = ranked.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Mark room as finished
  UPDATE tournament_rooms
  SET status = 'finished'
  WHERE id = p_room_id AND status != 'finished';

  RETURN jsonb_build_object('ok', true, 'players_ranked', v_updated);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tour_finalize_rankings(text) TO authenticated, anon;

-- ── 3. tour_submit_bot_scores_batch ──────────────────────────────────────────
-- Updates all unscored bots in a tournament room with a single UPDATE
CREATE OR REPLACE FUNCTION public.tour_submit_bot_scores_batch(
  p_room_id text,
  p_scores  jsonb  -- [{player_id: number, score: number}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  -- Build a temp mapping and do a single bulk update
  WITH score_map AS (
    SELECT
      (item->>'player_id')::bigint AS player_id,
      (item->>'score')::int        AS score
    FROM jsonb_array_elements(p_scores) AS item
  )
  UPDATE tournament_players tp
  SET
    score       = sm.score,
    finished_at = now()
  FROM score_map sm
  WHERE tp.room_id   = p_room_id
    AND tp.player_id = sm.player_id
    AND tp.is_bot    = true
    AND tp.score IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tour_submit_bot_scores_batch(text, jsonb) TO authenticated, anon;

-- ── 4. pay_batch_credit ───────────────────────────────────────────────────────
-- Credits multiple users in one DB round-trip while preserving individual ledger entries
CREATE OR REPLACE FUNCTION public.pay_batch_credit(
  p_credits jsonb  -- [{telegram_id: number, amount_usd: number, category: text, ref_id: text, ref_type: text}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      jsonb;
  v_tg_id     bigint;
  v_amount    numeric;
  v_category  text;
  v_ref_id    text;
  v_ref_type  text;
  v_count     int := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_credits)
  LOOP
    v_tg_id    := (v_item->>'telegram_id')::bigint;
    v_amount   := (v_item->>'amount_usd')::numeric;
    v_category := v_item->>'category';
    v_ref_id   := v_item->>'ref_id';
    v_ref_type := v_item->>'ref_type';

    IF v_tg_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN CONTINUE; END IF;

    PERFORM public.pay_internal_credit(
      v_tg_id,
      v_amount,
      COALESCE(v_category, 'reward'),
      v_ref_id,
      v_ref_type
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'credited', v_count);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'credited', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_batch_credit(jsonb) TO service_role;
