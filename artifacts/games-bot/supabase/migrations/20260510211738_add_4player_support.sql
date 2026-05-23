/*
  # Add 4-Player Support to match_rooms

  ## Summary
  Extends the match_rooms table to support up to 4 players per room.

  ## Changes
  - New columns: player3_id, player3_name, player3_score, player4_id, player4_name, player4_score
  - New column: max_players (2 or 4) to distinguish room types
  - New column: player3_score and player4_score default 0

  ## Security
  - Existing RLS policies remain unchanged (no RLS on these tables per original migration)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_rooms' AND column_name = 'player3_id'
  ) THEN
    ALTER TABLE match_rooms
      ADD COLUMN player3_id bigint,
      ADD COLUMN player3_name text,
      ADD COLUMN player3_score integer DEFAULT 0,
      ADD COLUMN player4_id bigint,
      ADD COLUMN player4_name text,
      ADD COLUMN player4_score integer DEFAULT 0,
      ADD COLUMN max_players integer DEFAULT 2;
  END IF;
END $$;
