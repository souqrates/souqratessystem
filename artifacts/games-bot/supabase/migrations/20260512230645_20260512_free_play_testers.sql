/*
  # Free Play Testers (zero-cost play for whitelisted accounts)

  ## Summary
  Adds an explicit whitelist of telegram_id values that can play any game
  (solo entry fees, multiplayer bets) without being charged SKZ — even
  after their free trial has expired. Lets the operator test all games
  end-to-end without burning balance.

  ## New Tables
  - `free_play_testers`
    - `telegram_id` (bigint, PK) — account permanently in free-play mode
    - `note`        (text)        — admin notes
    - `created_at`  (timestamptz) — when the account was whitelisted

  ## Modified Functions
  1. `pay_charge_solo_entry(uuid, int, numeric)` — if caller's telegram_id
     is in `free_play_testers`, returns ok with `charged=0` and writes a
     `trial_play` ledger entry tagged `free_play_tester`. No balance change.
  2. `pay_debit_bet(bigint, numeric)` — if telegram_id is in
     `free_play_testers`, bypasses the debit entirely (mirrors the existing
     trial bypass).

  ## New RPC
  - `tester_self_enroll(p_session_id uuid)` — SECURITY DEFINER. Resolves
    the calling session to a telegram_id and inserts it into the whitelist.
    Idempotent. Granted to anon+authenticated so the operator can enable
    free-play from their own logged-in session via a UI button.

  ## Security
  - RLS enabled on `free_play_testers`. No public SELECT/INSERT/UPDATE/DELETE.
    All access goes through SECURITY DEFINER functions with locked search_path.
  - `tester_self_enroll` only operates on the caller's own resolved
    telegram_id — it cannot whitelist anyone else.

  ## Notes
  Disabling free play later: delete the row from `free_play_testers` (no
  cascade), and the bypass stops immediately. The functions degrade
  gracefully back to normal charging.
*/

CREATE TABLE IF NOT EXISTS public.free_play_testers (
  telegram_id bigint PRIMARY KEY,
  note        text         DEFAULT '',
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.free_play_testers ENABLE ROW LEVEL SECURITY;

-- No public policies; SECURITY DEFINER functions are the only path.

CREATE OR REPLACE FUNCTION public.pay_charge_solo_entry(p_session_id uuid, p_game_id integer, p_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_tg            bigint;
v_bal           numeric;
v_trial_exp     timestamptz;
v_is_paid       boolean;
v_trial_active  boolean;
v_is_tester     boolean;
BEGIN
IF p_amount IS NULL OR p_amount <= 0 THEN
RAISE EXCEPTION 'bad_arguments';
END IF;

v_tg := pay_resolve_session(p_session_id);
IF v_tg IS NULL THEN
RAISE EXCEPTION 'session_invalid';
END IF;

PERFORM pay_ensure_balance_row(v_tg);

SELECT EXISTS(SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg) INTO v_is_tester;

SELECT sc_balance, trial_expires_at, is_paid
INTO v_bal, v_trial_exp, v_is_paid
FROM user_balances WHERE telegram_id = v_tg FOR UPDATE;

v_trial_active := (NOT v_is_paid AND v_trial_exp IS NOT NULL AND v_trial_exp > now());

-- Free-play tester: zero-charge bypass, with ledger record.
IF v_is_tester THEN
INSERT INTO ledger_entries (
user_telegram_id, direction, category, amount_usd, amount_token, token,
reference_type, reference_id, description, metadata
) VALUES (
v_tg, 'debit', 'trial_play',
0, 0, 'SKZ',
'solo_game', p_game_id::text,
'Free-play tester (no charge)',
jsonb_build_object('game_id', p_game_id, 'free_play_tester', true)
);
RETURN json_build_object(
'ok',           true,
'charged',      0,
'trial',        true,
'free_play',    true,
'sc_balance',   COALESCE(v_bal,0)
);
END IF;

IF v_trial_active THEN
INSERT INTO ledger_entries (
user_telegram_id, direction, category, amount_usd, amount_token, token,
reference_type, reference_id, description, metadata
) VALUES (
v_tg, 'debit', 'trial_play',
0, 0, 'SKZ',
'solo_game', p_game_id::text,
'Free trial play (no charge)',
jsonb_build_object('game_id', p_game_id, 'trial_expires_at', v_trial_exp)
);

RETURN json_build_object(
'ok',           true,
'charged',      0,
'trial',        true,
'sc_balance',   COALESCE(v_bal,0),
'trial_expires_at', v_trial_exp
);
END IF;

IF COALESCE(v_bal,0) < p_amount THEN
RAISE EXCEPTION 'insufficient_balance';
END IF;

UPDATE user_balances
SET sc_balance = COALESCE(sc_balance,0) - p_amount,
updated_at = now()
WHERE telegram_id = v_tg;

INSERT INTO ledger_entries (
user_telegram_id, direction, category, amount_usd, amount_token, token,
reference_type, reference_id, description, metadata
) VALUES (
v_tg, 'debit', 'bet',
p_amount, p_amount, 'SKZ',
'solo_game', p_game_id::text,
'Solo game entry: -' || p_amount || ' SKZ',
jsonb_build_object('game_id', p_game_id, 'from_balance', p_amount)
);

RETURN json_build_object(
'ok',           true,
'charged',      p_amount,
'trial',        false,
'sc_balance',   COALESCE(v_bal,0) - p_amount
);
END $function$;

CREATE OR REPLACE FUNCTION public.pay_debit_bet(p_tg bigint, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_real          numeric;
  v_trial_exp     timestamptz;
  v_is_paid       boolean;
  v_trial_active  boolean;
  v_is_tester     boolean;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  PERFORM pay_ensure_balance_row(p_tg);

  SELECT EXISTS(SELECT 1 FROM free_play_testers WHERE telegram_id = p_tg) INTO v_is_tester;
  IF v_is_tester THEN
    RETURN;
  END IF;

  SELECT sc_balance, trial_expires_at, is_paid
  INTO v_real, v_trial_exp, v_is_paid
  FROM user_balances WHERE telegram_id = p_tg FOR UPDATE;

  v_trial_active := (NOT COALESCE(v_is_paid, false)
                     AND v_trial_exp IS NOT NULL
                     AND v_trial_exp > now());

  IF v_trial_active THEN
    RETURN;
  END IF;

  IF COALESCE(v_real, 0) < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '53100';
  END IF;

  UPDATE user_balances
  SET sc_balance = sc_balance - p_amount,
      updated_at = now()
  WHERE telegram_id = p_tg;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tester_self_enroll(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  INSERT INTO free_play_testers (telegram_id, note)
  VALUES (v_tg, 'self-enrolled')
  ON CONFLICT (telegram_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'telegram_id', v_tg);
END;
$function$;

CREATE OR REPLACE FUNCTION public.tester_self_disable(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN
    RAISE EXCEPTION 'session_invalid';
  END IF;

  DELETE FROM free_play_testers WHERE telegram_id = v_tg;

  RETURN json_build_object('ok', true, 'telegram_id', v_tg);
END;
$function$;

CREATE OR REPLACE FUNCTION public.tester_is_enrolled(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tg bigint;
BEGIN
  v_tg := pay_resolve_session(p_session_id);
  IF v_tg IS NULL THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM free_play_testers WHERE telegram_id = v_tg);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tester_self_enroll(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tester_self_disable(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tester_is_enrolled(uuid) TO anon, authenticated;
