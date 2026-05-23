/*
  # Fix ledger_entries category constraint to include 'entry_fee'

  The pay_charge_solo_entry function uses 'entry_fee' as the ledger category,
  but the check constraint on ledger_entries does not include this value.
  This causes every solo game charge to fail with a constraint violation,
  preventing users from starting any paid game.

  Fix: Add 'entry_fee' to the allowed categories list.
*/

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_category_check;

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_category_check
  CHECK (category = ANY (ARRAY[
    'deposit',
    'withdrawal',
    'withdrawal_hold',
    'withdrawal_refund',
    'stake',
    'payout',
    'rake',
    'referral_bonus',
    'bonus',
    'adjustment',
    'solo_reward',
    'trial_play',
    'winnings',
    'entry_fee'
  ]));
