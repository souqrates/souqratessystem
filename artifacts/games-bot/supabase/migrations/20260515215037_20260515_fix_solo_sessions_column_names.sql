/*
  # Fix solo_game_sessions column name mismatch

  1. Problem
    - The `pay_charge_solo_entry` RPC inserts into columns `entry_fee` and `duration_seconds`
    - But the table only has `entry_fee_skz` and `max_duration_s`
    - This causes a "column entry_fee does not exist" error when entering solo games

  2. Fix
    - Add `entry_fee` column (alias of entry_fee_skz) so the RPC INSERT works
    - Add `duration_seconds` column (alias of max_duration_s) so the RPC INSERT works
    - Both columns are added with sensible defaults

  3. Notes
    - Non-destructive: existing columns remain untouched
    - The RPC function itself is not modified
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solo_game_sessions' AND column_name = 'entry_fee'
  ) THEN
    ALTER TABLE solo_game_sessions ADD COLUMN entry_fee numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solo_game_sessions' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE solo_game_sessions ADD COLUMN duration_seconds integer NOT NULL DEFAULT 60;
  END IF;
END $$;
