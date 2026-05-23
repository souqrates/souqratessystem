
/*
  # Fix withdrawal cancellation: add 'cancelled' to status constraint

  ## Problem
  pay_cancel_withdrawal() sets status = 'cancelled' but the check constraint
  on user_withdrawal_requests only allows:
  pending, approved, processing, sent, rejected, failed

  This causes a constraint violation crash whenever a user tries to cancel
  their own pending withdrawal within the cancel window.

  ## Fix
  Add 'cancelled' to the status check constraint.
*/

ALTER TABLE user_withdrawal_requests
  DROP CONSTRAINT IF EXISTS user_withdrawal_requests_status_check;

ALTER TABLE user_withdrawal_requests
  ADD CONSTRAINT user_withdrawal_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'approved', 'processing', 'sent',
    'rejected', 'failed', 'cancelled'
  ]));
