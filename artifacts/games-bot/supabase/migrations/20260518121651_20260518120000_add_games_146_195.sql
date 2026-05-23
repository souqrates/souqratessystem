/*
  # Add 50 New Solo Games (IDs 146–195)

  ## Summary
  Registers all 50 new solo skill games (IDs 146-195) that were added to the
  frontend (constants.js + GameEngine.jsx) into the manager_games table so they
  appear in the Telegram bot and manager dashboard.

  ## Changes
  1. Inserts 50 rows into `manager_games` — one per game — with:
     - `enabled = true`
     - `target_score` matching each game's win threshold
     - `entry_fee_skz = 10` (Medium default) or `15` (Hard) or `5` (Easy)
     - `win_prize_skz = 30` (Medium/Easy) or `45` (Hard)
     - `sort_order` set to game_id for natural ordering
  2. Uses ON CONFLICT DO UPDATE so re-running is safe.

  ## Affected Game IDs
  146 Perfect Cut, 147 Color Match Drop, 148 Ring Hop, 149 Stop The Bar,
  150 Pendulum Strike, 151 Sequence Blink, 152 Card Flip Pro, 153 Sound Memory,
  154 Grid Trace, 155 Symbol Shift, 156 Flick Shot, 157 Cannon Merge,
  158 Rope Slice, 159 Laser Bounce, 160 Tower Balance, 161 Tap Color Rush Pro,
  162 Math Dash, 163 Word Swipe, 164 Shape Sort, 165 Pattern Break,
  166 Flow Connect, 167 Block Escape, 168 Pipe Master, 169 Hex Fill,
  170 Maze Run Pro, 171 Beat Tap, 172 Lane Switcher, 173 Dot Rhythm,
  174 Drum Loop, 175 Line Rider Pro, 176 Maze Balance, 177 Thread Needle,
  178 Curve Draw, 179 Dodge Spikes, 180 Stack Master, 181 Rope Swing,
  182 Gravity Flip Pro, 183 Wall Jump, 184 Quick Sort, 185 Odd One Out,
  186 Equation Build, 187 Traffic Control, 188 Sniper Focus, 189 Type Speed Pro,
  190 Micro Drag, 191 Bounce Count, 192 Zen Balance, 193 Color Grid Logic,
  194 Pixel Paint Pro, 195 Vocal Pitch
*/

INSERT INTO manager_games (game_id, enabled, sort_order, target_score, entry_fee_skz, win_prize_skz)
VALUES
  -- Medium difficulty (entry 10, prize 30)
  (146, true, 146, 1000,  10, 30),
  (147, true, 147, 1200,  10, 30),
  (149, true, 149,  800,  10, 30),
  (152, true, 152, 1200,  10, 30),
  (154, true, 154, 1000,  10, 30),
  (156, true, 156, 1000,  10, 30),
  (158, true, 158, 1000,  10, 30),
  (163, true, 163, 1500,  10, 30),
  (164, true, 164, 1200,  10, 30),
  (167, true, 167,  800,  10, 30),
  (168, true, 168, 1000,  10, 30),
  (172, true, 172, 1200,  10, 30),
  (181, true, 181, 1500,  10, 30),
  (184, true, 184, 1200,  10, 30),
  (185, true, 185, 1000,  10, 30),
  (191, true, 191, 1000,  10, 30),
  (194, true, 194, 1500,  10, 30),

  -- Hard difficulty (entry 15, prize 45)
  (148, true, 148, 1000,  15, 45),
  (150, true, 150, 1500,  15, 45),
  (151, true, 151, 1000,  15, 45),
  (153, true, 153, 1000,  15, 45),
  (155, true, 155, 1200,  15, 45),
  (157, true, 157, 2048,  15, 45),
  (159, true, 159,  800,  15, 45),
  (160, true, 160, 1500,  15, 45),
  (161, true, 161, 1500,  15, 45),
  (162, true, 162, 2000,  15, 45),
  (165, true, 165, 1000,  15, 45),
  (166, true, 166, 1000,  15, 45),
  (169, true, 169, 1000,  15, 45),
  (170, true, 170, 1000,  15, 45),
  (171, true, 171, 1500,  15, 45),
  (173, true, 173, 1000,  15, 45),
  (174, true, 174, 1200,  15, 45),
  (175, true, 175, 1000,  15, 45),
  (176, true, 176, 1000,  15, 45),
  (177, true, 177, 1000,  15, 45),
  (178, true, 178, 1000,  15, 45),
  (179, true, 179, 2000,  15, 45),
  (180, true, 180, 2000,  15, 45),
  (182, true, 182, 1500,  15, 45),
  (183, true, 183, 1500,  15, 45),
  (186, true, 186, 1500,  15, 45),
  (187, true, 187, 2000,  15, 45),
  (188, true, 188, 1000,  15, 45),
  (189, true, 189, 1500,  15, 45),
  (190, true, 190, 1000,  15, 45),
  (192, true, 192, 2000,  15, 45),
  (193, true, 193, 1000,  15, 45),
  (195, true, 195, 1000,  15, 45)
ON CONFLICT (game_id) DO UPDATE SET
  enabled       = EXCLUDED.enabled,
  target_score  = EXCLUDED.target_score,
  entry_fee_skz = EXCLUDED.entry_fee_skz,
  win_prize_skz = EXCLUDED.win_prize_skz,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();
