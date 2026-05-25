import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// Liveness: process is up and responding. No external deps.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness: process can serve real traffic (DB reachable + pool not exhausted).
// Load balancers should route here, not /healthz, when deciding to send traffic.
router.get("/readyz", async (_req, res) => {
  const started = Date.now();
  try {
    const r = await pool.query("SELECT 1 AS ok");
    const dbLatencyMs = Date.now() - started;
    const ok = r.rows[0]?.ok === 1;
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      db: { ok, latencyMs: dbLatencyMs },
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      uptimeSec: Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: "down",
      db: { ok: false, error: (err as Error).message },
      uptimeSec: Math.round(process.uptime()),
    });
  }
});

export default router;
