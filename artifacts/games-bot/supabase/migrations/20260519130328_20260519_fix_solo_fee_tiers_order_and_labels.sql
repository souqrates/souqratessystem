/*
  # Fix solo_fee_tiers sort order, labels, and add missing manager_config keys

  ## Changes
  1. solo_fee_tiers — corrects sort_order so tiers display cheapest → most expensive
     and renames misleading labels (Starter was 1000 SKZ which is not a starter price)
  2. manager_config — adds missing keys: currency_symbol, referral_enabled,
     min_withdrawal_skz, deposit_enabled, withdrawal_enabled
*/

-- Fix sort_order so cheapest tier appears first
UPDATE solo_fee_tiers SET sort_order = 1, label = 'Starter'  WHERE entry_fee = 150;
UPDATE solo_fee_tiers SET sort_order = 2, label = 'Standard' WHERE entry_fee = 250;
UPDATE solo_fee_tiers SET sort_order = 3, label = 'Pro'      WHERE entry_fee = 400;
UPDATE solo_fee_tiers SET sort_order = 4, label = 'Elite'    WHERE entry_fee = 1000;
UPDATE solo_fee_tiers SET sort_order = 5, label = 'King'     WHERE entry_fee = 10000;

-- Also make the cheapest tier the default (better UX for new users)
UPDATE solo_fee_tiers SET is_default = false;
UPDATE solo_fee_tiers SET is_default = true WHERE entry_fee = 150;

-- Add missing manager_config keys if not present
INSERT INTO manager_config (key, value) VALUES ('currency_symbol', 'SKZ')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO manager_config (key, value) VALUES ('referral_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO manager_config (key, value) VALUES ('min_withdrawal_skz', '500')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO manager_config (key, value) VALUES ('deposit_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO manager_config (key, value) VALUES ('withdrawal_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;
