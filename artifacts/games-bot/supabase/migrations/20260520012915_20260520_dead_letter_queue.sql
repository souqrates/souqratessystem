/*
  # Dead Letter Queue for Failed Deposits

  ## Summary
  Captures TON/USDT deposit intents that expire without settlement so admins
  can investigate and manually credit users. Also adds hourly session cleanup.

  ## New Tables
  - `failed_deposits` — expired intents never confirmed

  ## New Functions
  - `sweep_failed_deposits()` — moves expired awaiting intents to the dead letter queue

  ## Cron Jobs
  - `sweep_failed_deposits` — every 30 minutes
  - `cleanup_expired_sessions_hourly` — every hour
*/

CREATE TABLE IF NOT EXISTS failed_deposits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id        uuid NOT NULL,
  user_telegram_id bigint NOT NULL,
  source           text NOT NULL DEFAULT '',
  amount_ton       numeric,
  memo             text,
  expired_at       timestamptz NOT NULL,
  swept_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE failed_deposits ENABLE ROW LEVEL SECURITY;

-- Admins identified by telegram_id in manager_admins
CREATE POLICY "Admins can read failed deposits"
  ON failed_deposits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM manager_admins ma
      WHERE ma.telegram_id = (
        SELECT telegram_id FROM telegram_sessions
        WHERE id = (current_setting('app.session_id', true))::uuid
        LIMIT 1
      )
    )
  );

CREATE OR REPLACE FUNCTION sweep_failed_deposits()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO failed_deposits (intent_id, user_telegram_id, source, amount_ton, memo, expired_at)
  SELECT
    id,
    user_telegram_id,
    source,
    amount_ton,
    memo,
    expires_at
  FROM ton_deposit_intents
  WHERE status = 'awaiting'
    AND expires_at < now() - interval '10 minutes'
    AND id NOT IN (SELECT intent_id FROM failed_deposits);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE ton_deposit_intents
  SET status = 'expired'
  WHERE status = 'awaiting'
    AND expires_at < now() - interval '10 minutes';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION sweep_failed_deposits() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep_failed_deposits') THEN
    PERFORM cron.schedule(
      'sweep_failed_deposits',
      '*/30 * * * *',
      'SELECT sweep_failed_deposits()'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_sessions_hourly') THEN
    PERFORM cron.schedule(
      'cleanup_expired_sessions_hourly',
      '5 * * * *',
      'DELETE FROM telegram_sessions WHERE expires_at < now() - interval ''2 hours'''
    );
  END IF;
END $$;
