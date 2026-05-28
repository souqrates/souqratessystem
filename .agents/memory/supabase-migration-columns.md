---
name: Supabase migration column gaps
description: Columns that exist in Neon (Replit) but must be manually added to Supabase before running pg_dump INSERTs
---

When migrating data from the Replit Neon DB to Supabase via pg_dump INSERTs, columns added to Drizzle schema AFTER the initial Supabase table creation will be missing, causing INSERT failures.

**Columns that required ALTER TABLE before migration:**
- `users`: `display_name text`, `avatar_url text`
- `wallets`: `created_at timestamptz NOT NULL DEFAULT now()`

**Rule:** Before running any pg_dump INSERT batch against Supabase, run `\d tablename` or check the INSERT column list against Supabase's actual schema. Any missing column → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` first.

**Why:** Drizzle push on Replit auto-applies schema changes to Neon. Supabase is only updated manually via SQL Editor. The two schemas drift unless explicitly synced.

**Insert order matters:** Always insert `users` before `wallets` (FK: wallets.user_id → users.id). Use `grep "INSERT INTO public.users"` then `grep "INSERT INTO public.wallets"` to extract per-table INSERTs instead of running the full dump (which includes TRUNCATE and may fail midway).
