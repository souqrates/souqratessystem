import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool sized for a many-pod deployment behind a load balancer.
// Override via env if you front this with PgBouncer (then drop max to ~5).
const DB_POOL_MAX            = Number(process.env.DB_POOL_MAX ?? 20);
const DB_IDLE_TIMEOUT_MS     = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000);
const DB_CONNECTION_TIMEOUT  = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000);
const DB_STATEMENT_TIMEOUT   = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 15_000);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: DB_POOL_MAX,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT,
  // Postgres-side query timeout: any single statement that runs longer than
  // this is killed by the server. Prevents a hung query from saturating the
  // pool and taking down the whole API.
  statement_timeout: DB_STATEMENT_TIMEOUT,
});

// Surface low-level pool errors instead of silently crashing the process.
pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] idle pool client error:", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
