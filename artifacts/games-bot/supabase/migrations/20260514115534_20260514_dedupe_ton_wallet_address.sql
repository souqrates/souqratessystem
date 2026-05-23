/*
  # Deduplicate TON wallet address across Economy and Integrations

  ## Background
  The bot TON wallet address was stored in two places:
    - public.economy_settings.ton_deposit_address  (public, used by Wallet UI to show deposit address)
    - public.app_integrations.ton_wallet_address   (admin-only, intended to feed withdrawal Edge Functions)

  Both pages let admins type the same value, which caused confusion and risk of drift.

  ## Decision
  Keep ONE source of truth:
    - economy_settings.ton_deposit_address remains (it is a public, non-secret address that the
      frontend already reads for deposit instructions). Edge Functions can also read it server-side.
    - The duplicate row in app_integrations is removed.

  Integrations remains the place for SECRET TON credentials only (api key, mnemonic, webhook secret).

  ## Changes
  1. Delete the now-redundant row `ton_wallet_address` from public.app_integrations.

  No data is lost: the same value still exists in economy_settings.
*/

DELETE FROM public.app_integrations
 WHERE key = 'ton_wallet_address';
