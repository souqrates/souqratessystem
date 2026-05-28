import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifyAdminToken } from "./lib/admin-auth";
import {
  globalLimiter,
  internalWriteLimiter,
  adminLoginLimiter,
} from "./lib/rate-limit";

const app: Express = express();

// We sit behind Replit's reverse proxy. Tell Express to trust it so
// req.ip + rate-limit keys reflect the real client IP, not the proxy.
app.set("trust proxy", 1);

// Strong default security headers. CSP is permissive here because the API
// only serves JSON; the Mini App frontends set their own CSPs in Vite/HTML.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Capture the raw request bytes alongside the parsed JSON. The Cryptomus
// IPN webhook re-computes an HMAC over the exact bytes that were sent, so a
// round-trip through JSON.parse + JSON.stringify could subtly reorder keys
// and break signature verification.
app.use(express.json({
  limit: "256kb",
  verify: (req, _res, buf) => {
    if (buf?.length) (req as unknown as { rawBody?: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Coarse-grained global limiter — applied before any handler so abusive
// bursts are dropped early without touching DB.
app.use(globalLimiter);

// Bot-scoped tighter limit on the financial surface.
app.use("/api/internal", internalWriteLimiter);

// Public admin login: trades a known admin token for an OK response. The
// client then stores the same token and sends it as Authorization: Bearer
// on every subsequent admin request. We do not mint a separate session
// token — the admin shared secret IS the credential.
app.post("/api/admin/login", adminLoginLimiter, (req, res): void => {
  const { token } = (req.body ?? {}) as { token?: string };
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  if (!verifyAdminToken(token)) {
    res.status(403).json({ error: "Invalid admin token" });
    return;
  }
  res.json({ ok: true });
});

app.use("/api", router);

// Sentry error handler must be the LAST middleware. Captures any error that
// bubbles out of a route handler. No-op if Sentry isn't initialised.
Sentry.setupExpressErrorHandler(app);

export default app;
