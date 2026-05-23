/*
  # Fix game entry fees and prizes to match correct tier values

  1. Problem
    - Previous migration inserted default values (10/30) for all games
    - Need to update to correct tier-based values matching the client constants

  2. Fix
    - Update all games to correct fee/prize based on their mode and difficulty
    
  3. Tier reference:
    - Solo Easy: 5/15, Solo Medium: 10/30, Solo Hard: 15/45
    - 2P Easy: 10/20, 2P Medium: 20/40, 2P Hard: 30/60
    - 4P Easy: 20/70, 4P Medium: 35/122, 4P Hard: 50/175
    - Group Easy: 30/100, Group Medium: 60/110, Group Hard: 100/140
*/

-- Solo Easy (id=9)
UPDATE game_advanced_configs SET entry_fee_skz = 5, win_prize_skz = 15 WHERE game_id = 9;

-- Solo Medium
UPDATE game_advanced_configs SET entry_fee_skz = 10, win_prize_skz = 30
WHERE game_id IN (4, 5, 6, 7, 57, 60, 76, 77, 79, 80, 82, 122);

-- Solo Hard
UPDATE game_advanced_configs SET entry_fee_skz = 15, win_prize_skz = 45
WHERE game_id IN (1, 2, 3, 8, 10, 56, 58, 59, 78, 81, 83, 84, 85, 116, 117, 118, 119, 120, 121, 123, 124, 125);

-- 2P Easy
UPDATE game_advanced_configs SET entry_fee_skz = 10, win_prize_skz = 20
WHERE game_id IN (14, 17, 25, 62, 86, 95);

-- 2P Medium
UPDATE game_advanced_configs SET entry_fee_skz = 20, win_prize_skz = 40
WHERE game_id IN (13, 16, 18, 19, 20, 21, 24, 61, 63, 87, 88, 89, 90, 92, 93);

-- 2P Hard
UPDATE game_advanced_configs SET entry_fee_skz = 30, win_prize_skz = 60
WHERE game_id IN (15, 23, 64, 65, 91, 94);

-- 4P Easy
UPDATE game_advanced_configs SET entry_fee_skz = 20, win_prize_skz = 70
WHERE game_id IN (29, 31, 37, 99, 100);

-- 4P Medium
UPDATE game_advanced_configs SET entry_fee_skz = 35, win_prize_skz = 122
WHERE game_id IN (27, 28, 30, 32, 38, 40, 66, 67, 68, 97, 98, 101, 103, 105);

-- 4P Hard
UPDATE game_advanced_configs SET entry_fee_skz = 50, win_prize_skz = 175
WHERE game_id IN (12, 26, 33, 34, 35, 36, 39, 69, 70, 96, 102, 104);

-- Group Easy
UPDATE game_advanced_configs SET entry_fee_skz = 30, win_prize_skz = 100
WHERE game_id IN (41, 130, 137, 144);

-- Group Medium
UPDATE game_advanced_configs SET entry_fee_skz = 60, win_prize_skz = 110
WHERE game_id IN (46, 126, 128, 132, 135, 136, 139, 140, 143);

-- Group Hard
UPDATE game_advanced_configs SET entry_fee_skz = 100, win_prize_skz = 140
WHERE game_id IN (44, 50, 53, 111, 127, 129, 131, 133, 134, 138, 141, 142, 145);
