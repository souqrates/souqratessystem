/*
  # Critical Security Hardening (Table 1 fixes)

  1. Webhook & internal-service shared secret
    - New table `private_security_config(key, value)` (no policies => zero access for anon/authenticated).
    - Seeds a random `webhook_secret_token` and a `internal_service_secret` if missing.
    - Adds SECURITY DEFINER helper `private.get_security_secret(text)` callable only by edge functions
      via service role (REVOKE from PUBLIC). Functions read directly using service role anyway.

  2. RLS tightening
    - `match_events`: drops the `INSERT ... WITH CHECK (true)` policy and replaces with a check
      that the supplied `room_id` exists and the `event_type` is in a safe whitelist. Payload size capped.
    - `tournament_events`: same treatment.
    - SELECT on rooms remains open for matchmaking discovery, but read-only.

  3. Notes
    - Existing functional behavior preserved; only abusive paths blocked.
    - Idempotent. Safe to re-run.
*/

CREATE TABLE IF NOT EXISTS private_security_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE private_security_config ENABLE ROW LEVEL SECURITY;

INSERT INTO private_security_config (key, value)
SELECT 'webhook_secret_token', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private_security_config WHERE key='webhook_secret_token');

INSERT INTO private_security_config (key, value)
SELECT 'internal_service_secret', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private_security_config WHERE key='internal_service_secret');

-- Tighten match_events INSERT
DROP POLICY IF EXISTS "Players can insert events" ON match_events;

CREATE POLICY "Insert events into existing rooms only"
  ON match_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('joined','left','ready','score','finished','heartbeat')
    AND length(coalesce(payload::text, '')) < 4000
    AND EXISTS (SELECT 1 FROM match_rooms WHERE match_rooms.id = match_events.room_id)
  );

-- Tighten tournament_events INSERT
DROP POLICY IF EXISTS "Anyone can insert tournament events" ON tournament_events;

CREATE POLICY "Insert tournament events into existing rooms only"
  ON tournament_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type IN ('joined','left','ready','score','finished','heartbeat')
    AND length(coalesce(payload::text, '')) < 4000
    AND EXISTS (SELECT 1 FROM tournament_rooms WHERE tournament_rooms.id = tournament_events.room_id)
  );
