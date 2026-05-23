/*
  # High-severity hardening (Table 2 fixes)

  1. users table SELECT policy
    - Drop "OR true" leak. Only own row visible by auth.uid().
    - Service-role bypass remains (used by edge functions).

  2. Replay protection on telegram_sessions
    - Adds partial UNIQUE index on init_data_hash to reject reused initData
      (excludes the literal 'guest' hash used for guest sessions).

  3. Bot identification
    - Adds `player1_is_bot..player4_is_bot` boolean columns to `match_rooms`.
    - Adds `is_bot` boolean to `tournament_players`.
    - Defaults to false; old rows are safe.

  4. TON deposit memo strength
    - Adds CHECK constraint requiring memo length >= 12 on ton_deposit_intents.

  5. Notes
    - Backwards-compatible: column additions are nullable booleans defaulting false.
    - Idempotent.
*/

-- 1. users SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

CREATE POLICY "Users can view their own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    telegram_id = (
      SELECT users_1.telegram_id FROM users users_1 WHERE users_1.id = auth.uid()
    )
  );

-- 2. Replay protection on telegram_sessions
CREATE UNIQUE INDEX IF NOT EXISTS telegram_sessions_init_hash_unique
  ON telegram_sessions (init_data_hash)
  WHERE init_data_hash <> 'guest' AND init_data_hash <> '';

-- 3. Bot identification columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='match_rooms' AND column_name='player1_is_bot') THEN
    ALTER TABLE match_rooms ADD COLUMN player1_is_bot boolean DEFAULT false;
    ALTER TABLE match_rooms ADD COLUMN player2_is_bot boolean DEFAULT false;
    ALTER TABLE match_rooms ADD COLUMN player3_is_bot boolean DEFAULT false;
    ALTER TABLE match_rooms ADD COLUMN player4_is_bot boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='tournament_players' AND column_name='is_bot') THEN
    ALTER TABLE tournament_players ADD COLUMN is_bot boolean DEFAULT false;
  END IF;
END $$;

-- 4. TON memo minimum length
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_schema='public' AND table_name='ton_deposit_intents'
                   AND constraint_name='ton_deposit_intents_memo_min_len') THEN
    ALTER TABLE ton_deposit_intents
      ADD CONSTRAINT ton_deposit_intents_memo_min_len
      CHECK (length(coalesce(memo, '')) >= 12);
  END IF;
END $$;
