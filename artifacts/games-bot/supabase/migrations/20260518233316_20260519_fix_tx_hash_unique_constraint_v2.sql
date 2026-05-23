/*
  # Fix tx_hash unique constraint collision (v2)

  ## Problem
  tx_hash column is NOT NULL with default '', causing unique violation
  when multiple pending intents exist ('' == '' conflict).

  ## Fix
  1. Drop NOT NULL constraint on tx_hash
  2. Set existing empty strings to NULL
  3. Replace blanket unique index with partial index (only non-null, non-empty)
*/

-- Step 1: Drop NOT NULL so we can set NULL values
ALTER TABLE ton_deposit_intents
  ALTER COLUMN tx_hash DROP NOT NULL;

-- Step 2: Convert empty strings to NULL
UPDATE ton_deposit_intents
SET tx_hash = NULL
WHERE tx_hash = '';

-- Step 3: Set default to NULL
ALTER TABLE ton_deposit_intents
  ALTER COLUMN tx_hash SET DEFAULT NULL;

-- Step 4: Drop old unique constraint/index
ALTER TABLE ton_deposit_intents
  DROP CONSTRAINT IF EXISTS uix_ton_deposit_intents_tx_hash;

DROP INDEX IF EXISTS uix_ton_deposit_intents_tx_hash;

-- Step 5: Partial unique index — only enforce on real tx hashes
CREATE UNIQUE INDEX IF NOT EXISTS uix_ton_deposit_intents_tx_hash
  ON ton_deposit_intents (tx_hash)
  WHERE tx_hash IS NOT NULL AND tx_hash <> '';
