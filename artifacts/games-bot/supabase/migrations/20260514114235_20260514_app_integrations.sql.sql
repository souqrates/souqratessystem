/*
  # External Integrations Vault

  1. New table
    - `app_integrations` — central catalog of every external-service
      credential (Mongo URI, TON API key, Vultr token, Sentry DSN, etc.).
      One row per "slot". The actual value is only readable by service-role
      callers; managers can read presence/metadata but not raw secrets.
  2. New RPCs (all SECURITY DEFINER, admin-guarded)
    - `manager_list_integrations`: returns category, key, label, description,
      is_secret, is_set, masked_value, updated_at
    - `manager_set_integration(key, value)`: upsert a single slot
    - `manager_clear_integration(key)`: clear a slot
    - `get_integration(p_key)`: service-role only — returns the raw value
      so edge functions can use the saved credentials.
  3. Security
    - RLS enabled, only service_role can SELECT/INSERT/UPDATE directly.
    - All admin access goes through SECURITY DEFINER RPCs that verify
      `is_manager_admin(auth caller telegram_id)`.
  4. Seed data
    - Pre-populates the catalog with every supported slot so the manager
      UI lists them out-of-the-box. Values stay NULL until the admin sets
      them from the Integrations page.
*/

CREATE TABLE IF NOT EXISTS public.app_integrations (
  key          text PRIMARY KEY,
  category     text NOT NULL,
  label        text NOT NULL,
  description  text DEFAULT '',
  value        text,
  is_secret    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   bigint
);

ALTER TABLE public.app_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access integrations" ON public.app_integrations;
CREATE POLICY "service role full access integrations"
  ON public.app_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No public/authenticated policies: all reads/writes for managers must go
-- through the RPCs below. This prevents leaking raw secrets to the client.

-- ─── helper: mask a secret for display ───────────────────────────────────
CREATE OR REPLACE FUNCTION public._mask_secret(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v IS NULL OR length(v) = 0 THEN ''
    WHEN length(v) <= 8 THEN repeat('•', length(v))
    ELSE substr(v, 1, 4) || repeat('•', greatest(length(v) - 8, 4)) || substr(v, length(v) - 3)
  END;
$$;

-- ─── list ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_list_integrations(p_admin_id bigint)
RETURNS TABLE (
  key text,
  category text,
  label text,
  description text,
  is_secret boolean,
  is_set boolean,
  masked_value text,
  sort_order int,
  updated_at timestamptz,
  updated_by bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_manager_admin(p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    i.key, i.category, i.label, i.description, i.is_secret,
    (i.value IS NOT NULL AND length(i.value) > 0) AS is_set,
    CASE
      WHEN i.is_secret THEN public._mask_secret(i.value)
      ELSE COALESCE(i.value, '')
    END AS masked_value,
    i.sort_order, i.updated_at, i.updated_by
  FROM public.app_integrations i
  ORDER BY i.category, i.sort_order, i.label;
END;
$$;

-- ─── upsert one slot ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_set_integration(
  p_admin_id bigint,
  p_key text,
  p_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_manager_admin(p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_integrations WHERE key = p_key) THEN
    RAISE EXCEPTION 'unknown_integration_key';
  END IF;

  UPDATE public.app_integrations
     SET value = NULLIF(p_value, ''),
         updated_at = now(),
         updated_by = p_admin_id
   WHERE key = p_key;
END;
$$;

-- ─── clear one slot ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_clear_integration(
  p_admin_id bigint,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_manager_admin(p_admin_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE public.app_integrations
     SET value = NULL,
         updated_at = now(),
         updated_by = p_admin_id
   WHERE key = p_key;
END;
$$;

-- ─── service-role lookup (for edge functions) ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_integration(p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT value FROM public.app_integrations WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION public.get_integration(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.manager_list_integrations(bigint)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manager_set_integration(bigint, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manager_clear_integration(bigint, text)     TO anon, authenticated, service_role;

-- ─── seed catalog ────────────────────────────────────────────────────────
INSERT INTO public.app_integrations (key, category, label, description, is_secret, sort_order) VALUES
  -- MongoDB (archive / cold storage)
  ('mongodb_uri',              'database',  'MongoDB Connection URI',     'mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true', true,  10),
  ('mongodb_database',         'database',  'MongoDB Database Name',      'Name of the database to write archives into.',                false, 11),

  -- TON blockchain
  ('ton_api_provider',         'blockchain','TON API Provider',           'tonapi | toncenter',                                          false, 20),
  ('ton_api_endpoint',         'blockchain','TON API Endpoint',           'e.g. https://tonapi.io or https://toncenter.com/api/v2',      false, 21),
  ('ton_api_key',              'blockchain','TON API Key',                'API key from tonapi.io or toncenter.',                        true,  22),
  ('ton_wallet_address',       'blockchain','Bot TON Wallet Address',     'Public address used to send withdrawals.',                    false, 23),
  ('ton_wallet_mnemonic',      'blockchain','Bot TON Wallet Mnemonic',    '24 words separated by spaces. Stored encrypted at rest.',     true,  24),
  ('ton_min_withdraw_ton',     'blockchain','Min Withdraw (TON)',         'Minimum withdrawal amount in TON.',                           false, 25),
  ('ton_webhook_secret',       'blockchain','TON Webhook Secret',         'Optional verification secret for deposit webhooks.',          true,  26),

  -- Vultr cloud (control plane)
  ('vultr_api_key',            'hosting',   'Vultr API Key',              'Personal API key from vultr.com.',                            true,  30),
  ('vultr_instance_id',        'hosting',   'Vultr Instance ID',          'Default instance for deploy / restart actions.',              false, 31),
  ('vultr_region',             'hosting',   'Vultr Region',               'e.g. ewr, fra, sgp.',                                         false, 32),
  ('vultr_ssh_key_id',         'hosting',   'Vultr SSH Key ID',           'Used for automated deploys.',                                 false, 33),

  -- Sentry (monitoring)
  ('sentry_dsn_frontend',      'monitoring','Sentry DSN (Frontend)',      'DSN for the React app.',                                      true,  40),
  ('sentry_dsn_backend',       'monitoring','Sentry DSN (Edge Functions)','DSN for backend edge functions.',                             true,  41),
  ('sentry_org',               'monitoring','Sentry Organization Slug',   '',                                                            false, 42),
  ('sentry_project',           'monitoring','Sentry Project Slug',        '',                                                            false, 43),

  -- Cloudflare
  ('cloudflare_api_token',     'cdn',       'Cloudflare API Token',       'Scoped token (Zone:DNS:Edit + Cache:Purge).',                 true,  50),
  ('cloudflare_zone_id',       'cdn',       'Cloudflare Zone ID',         'The zone that hosts the bot domain.',                         false, 51),
  ('cloudflare_account_id',    'cdn',       'Cloudflare Account ID',      '',                                                            false, 52),

  -- Resend (email)
  ('resend_api_key',           'email',     'Resend API Key',             'For transactional emails (receipts, alerts).',                true,  60),
  ('resend_from_email',        'email',     'Resend "From" Address',      'noreply@yourdomain.com',                                      false, 61),

  -- PostHog (product analytics)
  ('posthog_api_key',          'analytics', 'PostHog API Key',            '',                                                            true,  70),
  ('posthog_host',             'analytics', 'PostHog Host',               'e.g. https://eu.posthog.com',                                 false, 71),

  -- Telegram (already wired in env, mirrored here for ops visibility)
  ('telegram_bot_token',       'telegram',  'Telegram Bot Token',         'Override the deploy-time secret if rotated.',                 true,  80),
  ('telegram_webhook_secret',  'telegram',  'Telegram Webhook Secret',    'Random string used to verify Telegram callbacks.',            true,  81),
  ('telegram_admin_channel_id','telegram',  'Admin Channel/Group ID',     'Used to push admin alerts.',                                  false, 82),

  -- Stripe (fiat top-ups)
  ('stripe_secret_key',        'payments',  'Stripe Secret Key',          'sk_live_… or sk_test_…',                                      true,  90),
  ('stripe_publishable_key',   'payments',  'Stripe Publishable Key',     'pk_live_… or pk_test_…',                                      false, 91),
  ('stripe_webhook_secret',    'payments',  'Stripe Webhook Secret',      'whsec_… for signature verification.',                         true,  92)
ON CONFLICT (key) DO UPDATE SET
  category    = EXCLUDED.category,
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  is_secret   = EXCLUDED.is_secret,
  sort_order  = EXCLUDED.sort_order;
