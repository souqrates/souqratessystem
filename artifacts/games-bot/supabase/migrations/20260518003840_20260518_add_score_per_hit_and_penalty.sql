/*
  # Add score_per_hit and score_penalty to manager_games

  1. Changes
    - `manager_games`: Add `score_per_hit` (integer, default 20) — points awarded per correct action
    - `manager_games`: Add `score_penalty` (integer, default 20) — points deducted per wrong action

  2. Notes
    - Both columns default to 20 so existing games retain current behavior
    - These values are surfaced in the manager panel and passed to game components via applyOverrides
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'score_per_hit'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN score_per_hit integer DEFAULT 20;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'score_penalty'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN score_penalty integer DEFAULT 20;
  END IF;
END $$;
