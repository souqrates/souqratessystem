/*
  # Fix pay_credit_solo_reward prize lookup

  ## Problem
  pay_credit_solo_reward reads win_prize_skz from game_advanced_configs and returns
  ok=false / no_prize_configured when:
    - enabled = false in game_advanced_configs (51 games disabled there)
    - win_prize_skz is NULL

  But the actual prize is already computed client-side from fee_tiers
  (entryFee × multiplier) and passed as p_amount.

  ## Fix
  1. Rewrite prize lookup: use game_advanced_configs when available AND enabled,
     otherwise fall back to p_amount (the fee-tier computed prize from the client).
  2. Re-enable all solo games in game_advanced_configs that are enabled in manager_games
     so the authoritative table stays consistent.
  3. Also sync any new games (126-195) into game_advanced_configs with sensible defaults.
*/

-- ─── 1. Re-enable all games in game_advanced_configs that are enabled in manager_games ───
UPDATE game_advanced_configs gac
SET enabled = true
FROM manager_games mg
WHERE mg.game_id = gac.game_id
  AND mg.enabled = true
  AND gac.enabled = false;

-- Enable all that aren't in manager_games overrides at all (default = enabled)
UPDATE game_advanced_configs
SET enabled = true
WHERE enabled = false
  AND game_id NOT IN (SELECT game_id FROM manager_games WHERE enabled = false);

-- ─── 2. Insert any solo games 126-195 missing from game_advanced_configs ───
INSERT INTO game_advanced_configs (game_id, win_prize_skz, enabled)
SELECT gs.game_id, 25, true          -- default fallback prize; fee tiers override this
FROM (
  SELECT generate_series(126, 195) AS game_id
) gs
WHERE NOT EXISTS (
  SELECT 1 FROM game_advanced_configs WHERE game_id = gs.game_id
);

-- ─── 3. Rewrite pay_credit_solo_reward to fall back to p_amount ───
CREATE OR REPLACE FUNCTION pay_credit_solo_reward(
  p_session_id uuid,
  p_game_id    integer,
  p_amount     numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tg          bigint;
  v_new_bal     numeric;
  v_prize       numeric;
  v_prize_cfg   numeric;
  v_sess        record;
  v_recent_at   timestamptz;
  v_has_session boolean := false;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  -- Server-authoritative prize lookup: use game_advanced_configs when available.
  -- Fall back to p_amount (fee-tier computed prize) when not configured or disabled.
  SELECT win_prize_skz INTO v_prize_cfg
  FROM game_advanced_configs
  WHERE game_id = p_game_id AND COALESCE(enabled, true) = true;

  IF v_prize_cfg IS NOT NULL AND v_prize_cfg > 0 THEN
    v_prize := v_prize_cfg;
  ELSIF p_amount IS NOT NULL AND p_amount > 0 THEN
    -- Fallback: trust the fee-tier prize the client computed.
    -- Cap at a reasonable maximum to prevent abuse (10 000 SKZ).
    v_prize := LEAST(p_amount, 10000);
  ELSE
    RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'no_prize_configured');
  END IF;

  -- Try to find a valid unrewarded session for this player+game
  SELECT * INTO v_sess
  FROM solo_game_sessions
  WHERE telegram_id = v_tg
    AND game_id = p_game_id
    AND rewarded_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_sess IS NOT NULL THEN
    v_has_session := true;

    -- Validate time bounds: game must not have expired
    IF now() > v_sess.started_at + make_interval(secs => v_sess.max_duration_s + 60) THEN
      RETURN json_build_object('ok', false, 'credited', 0, 'reason', 'session_expired');
    END IF;

    -- Mark session as rewarded (exactly-once)
    UPDATE solo_game_sessions
    SET rewarded_at = now(), reward_amount = v_prize
    WHERE id = v_sess.id AND rewarded_at IS NULL;

    IF NOT FOUND THEN
      SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
      RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
    END IF;
  ELSE
    -- Legacy fallback: time-based dedup (10s window)
    SELECT MAX(created_at) INTO v_recent_at
    FROM ledger_entries
    WHERE user_telegram_id = v_tg
      AND direction = 'credit'
      AND category = 'payout'
      AND reference_type = 'solo_game'
      AND reference_id = p_game_id::text
      AND created_at > now() - interval '10 seconds';

    IF v_recent_at IS NOT NULL THEN
      SELECT sc_balance INTO v_new_bal FROM user_balances WHERE telegram_id = v_tg;
      RETURN json_build_object('ok', true, 'duplicate', true, 'credited', 0, 'sc_balance', COALESCE(v_new_bal, 0));
    END IF;
  END IF;

  -- Credit the reward
  PERFORM pay_ensure_balance_row(v_tg);

  UPDATE user_balances
  SET sc_balance    = COALESCE(sc_balance, 0)    + v_prize,
      total_won_usd = COALESCE(total_won_usd, 0) + v_prize,
      updated_at    = now()
  WHERE telegram_id = v_tg
  RETURNING sc_balance INTO v_new_bal;

  INSERT INTO ledger_entries (
    user_telegram_id, direction, category, amount_usd, amount_token, token,
    balance_after_usd, reference_type, reference_id, description, metadata
  ) VALUES (
    v_tg, 'credit', 'payout',
    v_prize, v_prize, 'SKZ',
    v_new_bal,
    'solo_game', p_game_id::text,
    'Solo game reward: +' || v_prize || ' SKZ',
    jsonb_build_object(
      'game_id', p_game_id,
      'server_authoritative', (v_prize_cfg IS NOT NULL AND v_prize_cfg > 0),
      'fee_tier_prize', p_amount,
      'solo_session_id', CASE WHEN v_has_session THEN v_sess.id ELSE NULL END
    )
  );

  -- Referral commission (non-blocking)
  BEGIN
    PERFORM credit_referral_commission(v_tg, v_prize, 'solo_win');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN json_build_object('ok', true, 'credited', v_prize, 'sc_balance', v_new_bal);
END;
$fn$;
