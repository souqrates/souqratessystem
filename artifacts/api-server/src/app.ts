import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifyAdminToken } from "./lib/admin-auth";

const app: Express = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public admin login: trades a known admin token for an OK response. The
// client then stores the same token and sends it as Authorization: Bearer
// on every subsequent admin request. We do not mint a separate session
// token — the admin shared secret IS the credential.
app.post("/api/admin/login", (req, res): void => {
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

export default app;
