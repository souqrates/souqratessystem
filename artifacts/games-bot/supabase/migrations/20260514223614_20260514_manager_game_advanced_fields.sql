/*
  # Add advanced game config fields for manager

  1. Modified Tables
    - `game_advanced_configs`
      - `trap_penalty` (numeric) - Score penalty when player hits a trap
      - `max_score` (integer) - Maximum possible score for the game
      - `solo_win_score` (integer) - Score needed to win solo games
      - `image_url` (text) - Custom image URL for the game card
    - `manager_games` (staging table)
      - Same 4 columns added for staging overrides
    - `manager_preview_games` (view update not needed - it reads all columns)

  2. Notes
    - These fields are nullable; null means "use game default"
    - image_url must be a valid HTTP(S) URL if set
    - trap_penalty is numeric to allow decimal values (e.g., 0.5)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_advanced_configs' AND column_name = 'trap_penalty'
  ) THEN
    ALTER TABLE game_advanced_configs ADD COLUMN trap_penalty numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_advanced_configs' AND column_name = 'max_score'
  ) THEN
    ALTER TABLE game_advanced_configs ADD COLUMN max_score integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_advanced_configs' AND column_name = 'solo_win_score'
  ) THEN
    ALTER TABLE game_advanced_configs ADD COLUMN solo_win_score integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_advanced_configs' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE game_advanced_configs ADD COLUMN image_url text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'trap_penalty'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN trap_penalty numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'max_score'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN max_score integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'solo_win_score'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN solo_win_score integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manager_games' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE manager_games ADD COLUMN image_url text DEFAULT NULL;
  END IF;
END $$;
