/*
  # Admin Contest Management RPCs

  1. New Functions
    - `manager_list_contests(p_admin_id, p_status, p_limit)` - Lists all contests with filtering
    - `manager_cancel_contest(p_admin_id, p_room_id)` - Cancels an active contest and refunds participants
    - `manager_create_contest(...)` - Admin creates a contest on behalf of the platform

  2. Security
    - All functions are SECURITY DEFINER
    - All functions verify admin status before executing
*/

-- Admin: list all contests (not just open ones)
CREATE OR REPLACE FUNCTION public.manager_list_contests(
  p_admin_id bigint,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_admin record;
  v_rows jsonb;
BEGIN
  SELECT * INTO v_admin FROM admin_users WHERE telegram_id = p_admin_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_admin'; END IF;

  IF p_status IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, title, game_id, game_name, status, host_id, host_name,
             max_players, player_count, bet_amount, prize_pool, forfeited_pot,
             duration_seconds, starts_at, ends_at, created_at, share_token,
             house_cut_bps, is_contest, is_team_mode
      FROM tournament_rooms
      WHERE is_contest = true AND status = p_status
      ORDER BY created_at DESC
      LIMIT p_limit
    ) r;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, title, game_id, game_name, status, host_id, host_name,
             max_players, player_count, bet_amount, prize_pool, forfeited_pot,
             duration_seconds, starts_at, ends_at, created_at, share_token,
             house_cut_bps, is_contest, is_team_mode
      FROM tournament_rooms
      WHERE is_contest = true
      ORDER BY created_at DESC
      LIMIT p_limit
    ) r;
  END IF;

  RETURN v_rows;
END;
$$;

-- Admin: cancel/delete a contest and refund active participants
CREATE OR REPLACE FUNCTION public.manager_cancel_contest(
  p_admin_id bigint,
  p_room_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_admin record;
  v_room record;
  v_player record;
  v_refund_count integer := 0;
BEGIN
  SELECT * INTO v_admin FROM admin_users WHERE telegram_id = p_admin_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_admin'; END IF;

  SELECT * INTO v_room FROM tournament_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;

  IF v_room.status = 'finished' OR v_room.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'refunded', 0);
  END IF;

  -- Refund all active participants
  FOR v_player IN
    SELECT tp.player_id, tp.player_name
    FROM tournament_players tp
    WHERE tp.room_id = p_room_id
  LOOP
    -- Refund entry fee back to player
    IF v_room.bet_amount > 0 THEN
      UPDATE user_balances
      SET sc_balance = sc_balance + v_room.bet_amount
      WHERE telegram_id = v_player.player_id;

      INSERT INTO user_ledger (telegram_id, direction, amount_token, category, description)
      VALUES (
        v_player.player_id,
        'credit',
        v_room.bet_amount,
        'contest_refund',
        'Admin cancelled contest: ' || COALESCE(v_room.title, v_room.id)
      );

      v_refund_count := v_refund_count + 1;
    END IF;
  END LOOP;

  -- Mark contest as cancelled
  UPDATE tournament_rooms
  SET status = 'cancelled',
      prize_pool = 0,
      ends_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object('ok', true, 'refunded', v_refund_count);
END;
$$;

-- Admin: create a platform-hosted contest
CREATE OR REPLACE FUNCTION public.manager_create_contest(
  p_admin_id bigint,
  p_game_id integer,
  p_game_name text,
  p_title text,
  p_max_seats integer,
  p_entry_fee numeric,
  p_duration_seconds integer,
  p_start_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_admin record;
  v_room_id text;
  v_token text;
  v_house_bps integer;
BEGIN
  SELECT * INTO v_admin FROM admin_users WHERE telegram_id = p_admin_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_admin'; END IF;

  IF p_max_seats < 2 OR p_max_seats > 1200 THEN RAISE EXCEPTION 'invalid_seat_count'; END IF;
  IF p_entry_fee < 0 THEN RAISE EXCEPTION 'invalid_entry_fee'; END IF;

  v_house_bps := COALESCE((SELECT (value::integer) FROM economy_settings WHERE key = 'contest_house_cut_bps'), 3000);

  v_room_id := upper(substr(md5(random()::text), 1, 6));
  v_token := _contest_make_token();

  INSERT INTO tournament_rooms (
    id, game_id, game_name, title, host_id, host_name,
    max_players, bet_amount, duration_seconds, starts_at,
    share_token, house_cut_bps, is_contest, status
  ) VALUES (
    v_room_id, p_game_id, p_game_name, p_title, p_admin_id, v_admin.name,
    p_max_seats, p_entry_fee, p_duration_seconds, p_start_at,
    v_token, v_house_bps, true, 'waiting'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_room_id,
    'share_token', v_token,
    'title', p_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_list_contests(bigint, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manager_cancel_contest(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manager_create_contest(bigint, integer, text, text, integer, numeric, integer, timestamptz) TO anon, authenticated;
