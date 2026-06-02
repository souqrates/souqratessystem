---
name: Lib rebuild required for nullable column
description: When changing a Drizzle column from notNull() to nullable, run typecheck:libs before leaf package typecheck or you get false type errors.
---

## Rule
After any change to `lib/db/src/schema/**` (adding/removing `.notNull()`, changing column types, etc.),
run `pnpm run typecheck:libs` **before** running `pnpm --filter @workspace/api-server run typecheck`.

## Why
`lib/db` is a composite TypeScript project that emits declarations. The api-server (leaf package) imports
the **compiled** types from lib/db, not the source. If you skip the lib rebuild, the old compiled
declarations still reflect the old type (e.g., `string` instead of `string | null`), causing spurious
"null not assignable" errors in any route that uses the changed column.

## How to apply
Whenever the task involves schema changes:
1. Edit `lib/db/src/schema/*.ts`
2. Run SQL migration via `psql "$POSTGRES_URL" -c "ALTER TABLE ..."` 
3. `pnpm run typecheck:libs`  ← this rebuilds lib/db declarations
4. `pnpm --filter @workspace/api-server run typecheck`  ← now uses fresh types
