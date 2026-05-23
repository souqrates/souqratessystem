/*
  # Drop duplicate pay_buy_with_ton (uuid signature)

  There are two overloads of pay_buy_with_ton causing ambiguity:
    - pay_buy_with_ton(text, numeric, text)  ← correct, keep
    - pay_buy_with_ton(uuid, numeric, text)  ← old, drop

  Dropping the uuid variant resolves the "could not choose best candidate" error.
*/

DROP FUNCTION IF EXISTS public.pay_buy_with_ton(uuid, numeric, text);
