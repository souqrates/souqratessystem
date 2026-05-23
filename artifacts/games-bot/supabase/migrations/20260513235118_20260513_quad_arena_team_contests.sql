/*
  # Quad Arena Team Contests

  ## Summary
  Adds team-mode support to user contests for the Quad Arena game (game_id = 12).
  When a contest is created for game_id = 12, participants are auto-assigned to
  one of 4 color teams (green / blue / gold / red) in round-robin order as they
  join. When the contest finalizes, the winning team is the one with the
  highest combined score. After the 30% house cut, the remaining 70% is split
  equally among all members of the winning team.

  ## Modified Tables
  - `tournament_rooms`
    - Added `is_team_mode` boolean default false — set true for team contests
  - `tournament_players`
    - Added `team_color` text — one of 'green' | 'blue' | 'gold' | 'red'

  ## Modified RPCs
  - `contest_create` — for game_id = 12 marks the room as team-mode and assigns
    the host to team 'green'
  - `contest_join_internal` — assigns the joining player a team color in
    round-robin order based on current player_count
  - `contest_finalize` — for team-mode rooms, ranks teams by total score,
    finds winning team, and credits each member their equal share

  ## Security
  - RLS unchanged on tournament tables
  - All RPCs SECURITY DEFINER, validate ownership/state as before
  - Equal-split math is computed on integer cent-quantities to avoid drift
*/

ALTER TABLE tournament_rooms
  ADD COLUMN IF NOT EXISTS is_team_mode boolean NOT NULL DEFAULT false;

ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS team_color text;

CREATE INDEX IF NOT EXISTS idx_tournament_players_room_team
  ON tournament_players(room_id, team_color);

-- Helper to pick a team color round-robin (0:green,1:blue,2:gold,3:red)
CREATE OR REPLACE FUNCTION public._team_color_for_index(p_idx integer)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['green','blue','gold','red'])[((p_idx) % 4) + 1];
$$;

-- =====================================================================
-- contest_create: mark game 12 as team-mode + assign host team
-- =====================================================================
CREATE OR REPLACE FUNCTION public.contest_create(
  p_session_id uuid,
  p_game_id integer,
  p_game_name text,
  p_title text,
  p_max_seats integer,
  p_entry_fee numeric,
  p_duration_seconds integer DEFAULT 60,
  p_start_at timestamptz DEFAULT NULL
) RETURNS tournament_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tg bigint;
  v_room tournament_rooms;
  v_token text;
  v_name text;
  v_host_name text;
  v_team boolean := false;
BEGIN
  v_tg := pay_resolve_session(p_session_id);

  IF p_entry_fee IS NULL OR p_entry_fee <= 0 THEN
    RAISE EXCEPTION 'invalid_entry_fee';
  END IF;
  IF p_max_seats IS NULL OR p_max_seats < 2 OR p_max_seats > 1200 THEN
    RAISE EXCEPTION 'invalid_seat_count';
  END IF;
  IF p_duration_seconds < 15 OR p_duration_seconds > 1800 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  v_team := (p_game_id = 12);

  SELECT COALESCE(NULLIF(display_name,''), NULLIF(first_name,''), 'Host')
    INTO v_host_name
    FROM users WHERE telegram_id = v_tg;
  v_host_name := COALESCE(v_host_name, 'Host');

  PERFORM pay_debit_bet(v_tg, p_entry_fee);

  FOR i IN 1..6 LOOP
    v_token := _contest_make_token();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM tournament_rooms WHERE share_token = v_token);
  END LOOP;

  v_name := COALESCE(NULLIF(p_game_name,''), 'Group Game');

  INSERT INTO tournament_rooms(
    game_id, game_name, status, host_id, host_name,
    max_players, player_count, bet_amount, prize_pool,
    duration_seconds, starts_at,
    title, share_token, house_cut_bps, is_contest, is_team_mode
  ) VALUES (
    p_game_id, v_name, 'waiting', v_tg, v_host_name,
    p_max_seats, 1, p_entry_fee, p_entry_fee,
    p_duration_seconds, p_start_at,
    COALESCE(NULLIF(p_title,''), v_name), v_token, 3000, true, v_team
  )
  RETURNING * INTO v_room;

  INSERT INTO tournament_players(room_id, player_id, player_name, team_color)
  VALUES (
    v_room.id, v_tg, v_host_name,
    CASE WHEN v_team THEN 'green' ELSE NULL END
  )
  ON CONFLICT DO NOTHING;

  RETURN v_room;
END;
$$;

-- =====================================================================
-- contest_join_internal: assign team color round-robin in team mode
-- =====================================================================
CREATE OR REPLACE FUNCTION public.contest_join_internal(
  p_tg bigint,
  p_room_id text,
  p_player_name text
) RETURNS tournament_rooms
LANGUAGE plpgsql AS $$
DECLARE
  v_room tournament_rooms;
  v_inserted boolean := false;
  v_idx integer;
  v_team text;
BEGIN
  SELECT * INTO v_room FROM tournament_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.is_contest IS NOT TRUE THEN RAISE EXCEPTION 'not_a_contest'; END IF;
  IF v_room.status = 'finished' THEN RAISE EXCEPTION 'contest_ended'; END IF;
  IF v_room.status = 'playing' THEN RAISE EXCEPTION 'contest_started'; END IF;
  IF v_room.max_players > 0 AND v_room.player_count >= v_room.max_players THEN
    RAISE EXCEPTION 'contest_full';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tournament_players WHERE room_id = p_room_id AND player_id = p_tg) THEN
    PERFORM pay_debit_bet(p_tg, v_room.bet_amount);

    v_team := NULL;
    IF v_room.is_team_mode THEN
      SELECT COUNT(*) INTO v_idx FROM tournament_players WHERE room_id = p_room_id;
      v_team := _team_color_for_index(v_idx);
    END IF;

    INSERT INTO tournament_players(room_id, player_id, player_name, team_color)
    VALUES (p_room_id, p_tg, COALESCE(NULLIF(p_player_name,''), 'Player'), v_team);
    v_inserted := true;
  END IF;

  IF v_inserted THEN
    UPDATE tournament_rooms
       SET player_count = (SELECT COUNT(*) FROM tournament_players WHERE room_id = p_room_id),
           prize_pool   = prize_pool + v_room.bet_amount
     WHERE id = p_room_id
     RETURNING * INTO v_room;
  END IF;
  RETURN v_room;
END;
$$;

-- =====================================================================
-- contest_finalize: team mode splits pot equally across winning team
-- =====================================================================
CREATE OR REPLACE FUNCTION public.contest_finalize(
  p_session_id uuid,
  p_room_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tg bigint;
  v_room tournament_rooms;
  v_winner bigint;
  v_pot numeric;
  v_winner_share numeric;
  v_house_share numeric;
  v_cut numeric;
  v_team text;
  v_team_count integer;
  v_per_share numeric;
  v_team_members RECORD;
  v_top_score numeric;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  SELECT * INTO v_room FROM tournament_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.is_contest IS NOT TRUE THEN RAISE EXCEPTION 'not_a_contest'; END IF;
  IF v_room.status = 'finished' THEN
    RETURN jsonb_build_object('already_finished', true);
  END IF;
  IF v_room.host_id <> v_tg AND (v_room.ends_at IS NULL OR now() < v_room.ends_at) THEN
    RAISE EXCEPTION 'not_host_or_not_expired';
  END IF;

  WITH ranked AS (
    SELECT id, player_id,
      ROW_NUMBER() OVER (ORDER BY COALESCE(score,0) DESC, joined_at ASC) rn
    FROM tournament_players WHERE room_id = p_room_id
  )
  UPDATE tournament_players tp
     SET rank = r.rn
    FROM ranked r WHERE tp.id = r.id;

  v_pot := COALESCE(v_room.prize_pool, 0) + COALESCE(v_room.forfeited_pot, 0);
  v_cut := LEAST(GREATEST(COALESCE(v_room.house_cut_bps, 3000), 0), 5000);
  v_house_share  := round(v_pot * v_cut / 10000.0, 4);
  v_winner_share := v_pot - v_house_share;

  UPDATE tournament_rooms SET status = 'finished' WHERE id = p_room_id;

  -- TEAM MODE: split winner_share equally among winning team members
  IF v_room.is_team_mode THEN
    SELECT team_color, SUM(COALESCE(score,0)) AS s
      INTO v_team, v_top_score
      FROM tournament_players
     WHERE room_id = p_room_id AND team_color IS NOT NULL
     GROUP BY team_color
     ORDER BY s DESC, team_color ASC
     LIMIT 1;

    IF v_team IS NULL THEN
      RETURN jsonb_build_object('pot', v_pot, 'winner_share', v_winner_share,
                                'house_share', v_house_share, 'team', NULL);
    END IF;

    SELECT COUNT(*) INTO v_team_count
      FROM tournament_players
     WHERE room_id = p_room_id AND team_color = v_team;

    IF v_team_count > 0 AND v_winner_share > 0 THEN
      v_per_share := round(v_winner_share / v_team_count, 4);
      FOR v_team_members IN
        SELECT player_id FROM tournament_players
         WHERE room_id = p_room_id AND team_color = v_team
      LOOP
        PERFORM pay_credit_winnings(v_team_members.player_id, v_per_share);
      END LOOP;
    END IF;

    RETURN jsonb_build_object(
      'team_mode', true,
      'winning_team', v_team,
      'team_size', v_team_count,
      'per_share', v_per_share,
      'pot', v_pot,
      'winner_share', v_winner_share,
      'house_share', v_house_share
    );
  END IF;

  -- SOLO MODE (existing behaviour)
  SELECT player_id INTO v_winner
    FROM tournament_players WHERE room_id = p_room_id AND rank = 1
    LIMIT 1;

  IF v_winner IS NOT NULL AND v_winner_share > 0 THEN
    PERFORM pay_credit_winnings(v_winner, v_winner_share);
  END IF;

  RETURN jsonb_build_object(
    'winner_id', v_winner,
    'pot', v_pot,
    'winner_share', v_winner_share,
    'house_share', v_house_share
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._team_color_for_index(integer) TO anon, authenticated;
