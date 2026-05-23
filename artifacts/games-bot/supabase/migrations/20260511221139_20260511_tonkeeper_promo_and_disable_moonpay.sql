/*
  # Disable MoonPay, add Tonkeeper deposit-promo settings

  Plan: keep two payment methods only:
    1) Telegram Stars (primary)
    2) Direct TON deposit (with a banner that recommends Tonkeeper,
       since users can top up Tonkeeper with a Visa card and the rates
       are better than 3rd-party on-ramps).

  Changes:
    1. Default `moonpay_enabled` to 'false' so the Visa/Card button
       is hidden from the Wallet UI. Admin can still flip it on later.
    2. Add new public economy_settings rows for the Tonkeeper banner
       (headline, body, CTA link, image url, and an enabled toggle),
       plus a configurable response-time message and minimum deposit
       hint shown to the user.

  Safety: no destructive operations. UPDATE only flips the default
  for an existing key. INSERT uses ON CONFLICT DO NOTHING so
  re-running is safe.
*/

UPDATE economy_settings
  SET value = 'false', updated_at = now()
  WHERE key = 'moonpay_enabled';

INSERT INTO economy_settings (key, value, value_type, category, label, description, is_public, sort_order)
VALUES
  ('tonkeeper_promo_enabled', 'true',
    'bool', 'ux',
    'Show Tonkeeper promo banner',
    'Display a small banner inside the TON deposit screen encouraging users to install Tonkeeper to top up with a Visa card.',
    true, 100),

  ('tonkeeper_promo_title', 'New to TON? Get Tonkeeper',
    'text', 'ux',
    'Tonkeeper promo title',
    'Headline shown on the Tonkeeper banner.',
    true, 101),

  ('tonkeeper_promo_body', 'Tonkeeper lets you buy TON with your Visa card at the best rates. You will need a TON wallet for deposits and withdrawals anyway, so set it up once and reuse it.',
    'text', 'ux',
    'Tonkeeper promo body',
    'Description shown on the Tonkeeper banner.',
    true, 102),

  ('tonkeeper_promo_cta', 'Install Tonkeeper',
    'text', 'ux',
    'Tonkeeper promo button text',
    'Label for the CTA button on the Tonkeeper banner.',
    true, 103),

  ('tonkeeper_promo_url', 'https://tonkeeper.com',
    'url', 'ux',
    'Tonkeeper promo CTA link',
    'Where the CTA button takes the user.',
    true, 104),

  ('ton_deposit_eta_minutes', '2',
    'number', 'ux',
    'TON deposit confirmation time (min)',
    'Estimated minutes shown to the user before their TON deposit appears in-app.',
    true, 105),

  ('ton_deposit_hint', 'After paying, your balance updates automatically once the transaction confirms on-chain.',
    'text', 'ux',
    'TON deposit help text',
    'Short text shown under the deposit address.',
    true, 106)

ON CONFLICT (key) DO NOTHING;
