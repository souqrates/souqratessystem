/*
  # Populate game entry fees and win prizes

  1. Problem
    - All games in `game_advanced_configs` have NULL `entry_fee_skz` and `win_prize_skz`
    - The `pay_credit_solo_reward` RPC returns "no_prize_configured" when `win_prize_skz` is NULL
    - This means solo game winners never receive their prize even though entry fees are deducted

  2. Fix
    - Populate `entry_fee_skz` and `win_prize_skz` for all games using the
      default tier values from the client-side constants:
      - Solo:  Easy=5/15, Medium=10/30, Hard=15/45
      - 2P:    Easy=10/20, Medium=20/40, Hard=30/60
      - 4P:    Easy=20/70, Medium=35/122, Hard=50/175
      - Group: Easy=30/100-150, Medium=60/110, Hard=100/140

  3. Tables modified
    - `game_advanced_configs` - entry_fee_skz and win_prize_skz columns updated
*/

-- Solo games (players = 1 / no players field)
-- IDs: 1-10, 56-60, 76-85, 116-125
-- Easy: fee=5, prize=15 | Medium: fee=10, prize=30 | Hard: fee=15, prize=45

-- Solo Easy
UPDATE game_advanced_configs SET entry_fee_skz = 5, win_prize_skz = 15
WHERE game_id IN (9) AND entry_fee_skz IS NULL;

-- Solo Medium
UPDATE game_advanced_configs SET entry_fee_skz = 10, win_prize_skz = 30
WHERE game_id IN (4, 5, 6, 7, 57, 60, 76, 77, 79, 80, 82, 122) AND entry_fee_skz IS NULL;

-- Solo Hard
UPDATE game_advanced_configs SET entry_fee_skz = 15, win_prize_skz = 45
WHERE game_id IN (1, 2, 3, 8, 10, 56, 58, 59, 78, 81, 83, 84, 85, 116, 117, 118, 119, 120, 121, 123, 124, 125) AND entry_fee_skz IS NULL;

-- 2-Player games (players = 2)
-- IDs: 13-25, 61-65, 86-95
-- Easy: fee=10, prize=20 | Medium: fee=20, prize=40 | Hard: fee=30, prize=60

-- 2P Easy
UPDATE game_advanced_configs SET entry_fee_skz = 10, win_prize_skz = 20
WHERE game_id IN (14, 17, 25, 62, 86, 95) AND entry_fee_skz IS NULL;

-- 2P Medium
UPDATE game_advanced_configs SET entry_fee_skz = 20, win_prize_skz = 40
WHERE game_id IN (13, 16, 18, 19, 20, 21, 24, 61, 63, 87, 88, 89, 90, 92, 93) AND entry_fee_skz IS NULL;

-- 2P Hard
UPDATE game_advanced_configs SET entry_fee_skz = 30, win_prize_skz = 60
WHERE game_id IN (15, 23, 64, 65, 91, 94) AND entry_fee_skz IS NULL;

-- 4-Player games (players = 4)
-- IDs: 12, 26-40, 66-70, 96-105
-- Easy: fee=20, prize=70 | Medium: fee=35, prize=122 | Hard: fee=50, prize=175

-- 4P Easy
UPDATE game_advanced_configs SET entry_fee_skz = 20, win_prize_skz = 70
WHERE game_id IN (29, 31, 37, 67, 99, 100) AND entry_fee_skz IS NULL;

-- 4P Medium
UPDATE game_advanced_configs SET entry_fee_skz = 35, win_prize_skz = 122
WHERE game_id IN (27, 28, 30, 32, 38, 40, 66, 68, 97, 98, 101, 103, 105) AND entry_fee_skz IS NULL;

-- 4P Hard
UPDATE game_advanced_configs SET entry_fee_skz = 50, win_prize_skz = 175
WHERE game_id IN (12, 26, 33, 34, 35, 36, 39, 69, 70, 96, 102, 104) AND entry_fee_skz IS NULL;

-- Group/Tournament games (players = 0)
-- IDs: 41, 44, 46, 50, 53, 111, 126-145
-- Easy: fee=30, prize=100-150 | Medium: fee=60, prize=110 | Hard: fee=100, prize=140

-- Group Easy
UPDATE game_advanced_configs SET entry_fee_skz = 30, win_prize_skz = 100
WHERE game_id IN (41, 130, 137, 144) AND entry_fee_skz IS NULL;

-- Group Medium
UPDATE game_advanced_configs SET entry_fee_skz = 60, win_prize_skz = 110
WHERE game_id IN (46, 126, 128, 132, 135, 136, 139, 140, 143) AND entry_fee_skz IS NULL;

-- Group Hard
UPDATE game_advanced_configs SET entry_fee_skz = 100, win_prize_skz = 140
WHERE game_id IN (44, 50, 53, 111, 127, 129, 131, 133, 134, 138, 141, 142, 145) AND entry_fee_skz IS NULL;

-- For any games still missing configs, insert rows with defaults
INSERT INTO game_advanced_configs (game_id, entry_fee_skz, win_prize_skz, enabled)
SELECT g.id, 
  CASE 
    WHEN g.id IN (9, 130, 137, 144, 14, 17, 25, 62, 86, 95, 29, 31, 37, 67, 99, 100, 41) THEN 
      CASE WHEN g.id IN (9) THEN 5 
           WHEN g.id IN (14,17,25,62,86,95) THEN 10
           WHEN g.id IN (29,31,37,67,99,100) THEN 20
           WHEN g.id IN (41,130,137,144) THEN 30
           ELSE 10 END
    ELSE 10
  END,
  CASE 
    WHEN g.id IN (9) THEN 15
    ELSE 30
  END,
  true
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
             (12),(13),(14),(15),(16),(17),(18),(19),(20),(21),(23),(24),(25),
             (26),(27),(28),(29),(30),(31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
             (41),(44),(46),(50),(53),
             (56),(57),(58),(59),(60),
             (61),(62),(63),(64),(65),
             (66),(67),(68),(69),(70),
             (76),(77),(78),(79),(80),(81),(82),(83),(84),(85),
             (86),(87),(88),(89),(90),(91),(92),(93),(94),(95),
             (96),(97),(98),(99),(100),(101),(102),(103),(104),(105),
             (111),
             (116),(117),(118),(119),(120),(121),(122),(123),(124),(125),
             (126),(127),(128),(129),(130),(131),(132),(133),(134),(135),
             (136),(137),(138),(139),(140),(141),(142),(143),(144),(145)
) AS g(id)
WHERE NOT EXISTS (SELECT 1 FROM game_advanced_configs WHERE game_id = g.id);
