/*
  # Add USDT Deposit Settings (v2)

  - usdt_deposit_enabled (bool): show/hide USDT deposit option in wallet
  - sc_per_usdt (number): SKZ credited per 1 USDT sent
*/

INSERT INTO economy_settings (key, value, value_type) VALUES
  ('usdt_deposit_enabled', 'true',  'bool'),
  ('sc_per_usdt',          '500',   'number')
ON CONFLICT (key) DO NOTHING;
