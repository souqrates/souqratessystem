/*
  # Telegram @wallet Integration Settings

  Adds economy_settings keys to control the @wallet buy flow:
  - telegram_wallet_enabled: show/hide the @wallet buy card (bool type)
  - telegram_wallet_hint: custom subtitle shown on the buy screen (text)
  - wallet_deposit_step1/2/3: localizable step labels (text)
*/

INSERT INTO economy_settings (key, value, value_type, description) VALUES
  ('telegram_wallet_enabled',   'true',                                                           'bool',   'Show the @wallet buy card on the deposit screen'),
  ('telegram_wallet_hint',      'Buy TON or USDT with your Visa card — no crypto wallet needed', 'text',   'Subtitle shown under the @wallet card'),
  ('wallet_deposit_step1',      'Open @wallet and buy TON with your Visa card',                  'text',   'Step 1 label on the @wallet deposit guide'),
  ('wallet_deposit_step2',      'Tap Send in @wallet, paste the address & memo below',           'text',   'Step 2 label on the @wallet deposit guide'),
  ('wallet_deposit_step3',      'Your SKZ balance tops up automatically within ~2 minutes',      'text',   'Step 3 label on the @wallet deposit guide')
ON CONFLICT (key) DO NOTHING;
