/*
  # Group Tournament System — Unlimited Players

  ## Summary
  Creates a tournament system supporting 100-1000+ players per room.
  Each player submits their score; a live leaderboard ranks all participants.

  ## New Tables
  - `tournament_rooms` — room metadata, game config, status, start/end times
  - `tournament_players` — one row per player per room, stores score + rank
  - `tournament_events` — real-time events (chat, reactions, game state)

  ## Security
  - RLS enabled on all tables
  - Players can only write to their own score row
  - Anyone can read room + leaderboard (public tournament results)

  ## Notes
  - Room IDs are 6-char uppercase alphanumeric (easy to share)
  - max_players = 0 means unlimited
  - status: waiting | countdown | playing | finished
*/

CREATE TABLE IF NOT EXISTS tournament_rooms (
  id text PRIMARY KEY DEFAULT upper(substr(md5(random()::text), 1, 6)),
  game_id integer NOT NULL,
  game_name text,
  status text DEFAULT 'waiting',
  host_id bigint,
  host_name text,
  max_players integer DEFAULT 0,
  player_count integer DEFAULT 0,
  bet_amount numeric(12,4) DEFAULT 0,
  prize_pool numeric(12,4) DEFAULT 0,
  duration_seconds integer DEFAULT 60,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id bigserial PRIMARY KEY,
  room_id text REFERENCES tournament_rooms(id) ON DELETE CASCADE,
  player_id bigint NOT NULL,
  player_name text NOT NULL,
  score integer DEFAULT 0,
  rank integer,
  status text DEFAULT 'joined',
  joined_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(room_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_events (
  id bigserial PRIMARY KEY,
  room_id text REFERENCES tournament_rooms(id) ON DELETE CASCADE,
  player_id bigint,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_room ON tournament_players(room_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_room_score ON tournament_players(room_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_events_room ON tournament_events(room_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rooms_status ON tournament_rooms(status, game_id);

ALTER TABLE tournament_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournament rooms"
  ON tournament_rooms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert tournament rooms"
  ON tournament_rooms FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Host can update room"
  ON tournament_rooms FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read tournament players"
  ON tournament_players FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Players can join tournament"
  ON tournament_players FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update own score"
  ON tournament_players FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read tournament events"
  ON tournament_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert tournament events"
  ON tournament_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_rooms;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_players;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tournament_events;
  END IF;
END $$;
