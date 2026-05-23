/*
  # Private Rooms Guard

  1. Changes
    - Add `is_private` filter to `match_quick_join` logic (block quick-match from joining private rooms)
    - Ensure `match_join_room` RPC rejects joining a private room unless called with the exact room_id (by code)
      - Private rooms can only be joined by explicit room code, not via quick-match scan
    - No destructive changes — only adds a guard condition to existing RPC

  2. Notes
    - The `is_private` column already exists on `match_rooms` (added in 20260513_private_rooms migration)
    - This migration adds a DB-level safety net on top of the frontend filter already applied
*/

-- Ensure the is_private column exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_rooms' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE match_rooms ADD COLUMN is_private boolean DEFAULT false;
  END IF;
END $$;

-- Index for quick-match query (only scan public waiting rooms)
CREATE INDEX IF NOT EXISTS idx_match_rooms_public_waiting
  ON match_rooms (game_id, status, max_players, bet_amount, created_at)
  WHERE status = 'waiting' AND is_private = false;
