/*
  # Enable 25 New Solo Games

  ## Summary
  Several new solo games were added to the codebase (constants.js + GameEngine.jsx)
  but were either disabled or missing entirely from the manager_games table.

  ## Changes
  1. Enable all 25 new solo games that were set to enabled=false
  2. Insert entries for game IDs 11 and 22 which were missing entirely
  3. All games are enabled=true so they appear in the app

  ## Affected game IDs
  New insertions: 11 (Flash Tap), 22 (Pulse Strike)
  Re-enabled: 52, 54, 71, 72, 73, 74, 75, 106, 107, 108, 109, 110, 112, 113, 114
*/

-- Insert missing games (11, 22) and re-enable all disabled ones
INSERT INTO manager_games (game_id, enabled)
VALUES
  (11,  true),
  (22,  true)
ON CONFLICT (game_id) DO UPDATE SET enabled = true;

-- Re-enable all the disabled games
UPDATE manager_games
SET enabled = true
WHERE game_id IN (52, 54, 71, 72, 73, 74, 75, 106, 107, 108, 109, 110, 112, 113, 114);
