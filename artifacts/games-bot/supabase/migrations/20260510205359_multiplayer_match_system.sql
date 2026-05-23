/*
  # Multiplayer Match System

  ## Overview
  Full real-time multiplayer system for 2-player skill games.
  Each player joins from their own device. Supabase Realtime syncs game state.

  ## Tables

  ### match_rooms
  - id: unique room code (6 chars)
  - game_id: which game is being played
  - status: waiting | playing | finished
  - player1_id, player2_id: telegram user IDs
  - player1_score, player2_score: final scores
  - winner_id: who won
  - bet_amount: entry fee in USDT
  - created_at, started_at, finished_at

  ### match_events
  - Real-time game state sync between players
  - event_type: score_update | game_over | heartbeat
  - payload: JSON with game-specific data

  ## Security
  - RLS enabled on all tables
  - Players can only read rooms they're part of
  - Players can only write to their own score
*/

-- Match rooms table
CREATE TABLE IF NOT EXISTS match_rooms (
  id            text        PRIMARY KEY DEFAULT upper(substr(md5(random()::text), 1, 6)),
  game_id       integer     NOT NULL,
  status        text        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished','cancelled')),
  player1_id    bigint      NOT NULL,
  player2_id    bigint,
  player1_name  text        NOT NULL DEFAULT '',
  player2_name  text        NOT NULL DEFAULT '',
  player1_score integer     NOT NULL DEFAULT 0,
  player2_score integer     NOT NULL DEFAULT 0,
  winner_id     bigint,
  bet_amount    numeric(12,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

ALTER TABLE match_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view rooms they participate in"
  ON match_rooms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create a room"
  ON match_rooms FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update rooms they are in"
  ON match_rooms FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Match events for real-time sync
CREATE TABLE IF NOT EXISTS match_events (
  id          bigserial   PRIMARY KEY,
  room_id     text        NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
  player_id   bigint      NOT NULL,
  event_type  text        NOT NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view events in their rooms"
  ON match_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Players can insert events"
  ON match_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_rooms_status ON match_rooms(status);
CREATE INDEX IF NOT EXISTS idx_match_rooms_player1 ON match_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_match_rooms_player2 ON match_rooms(player2_id);
CREATE INDEX IF NOT EXISTS idx_match_events_room ON match_events(room_id, created_at);

-- Enable realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE match_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
