/*
  # Drop duplicate pay_credit_solo_reward overloads

  The function pay_credit_solo_reward has 3 overloads:
  - (p_session_id uuid, p_game_id int, p_amount numeric) → json  [keep — matches frontend call]
  - (p_session_id uuid, p_game_id int, p_amount numeric, p_score int) → jsonb  [drop]
  - (p_tg bigint, p_game_id int, p_amount numeric) → jsonb  [drop]

  Keeping only the 3-argument session-based version to avoid ambiguity.
*/

DROP FUNCTION IF EXISTS pay_credit_solo_reward(uuid, integer, numeric, integer);
DROP FUNCTION IF EXISTS pay_credit_solo_reward(bigint, integer, numeric);
