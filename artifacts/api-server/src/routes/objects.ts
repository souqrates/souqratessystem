/**
 * GET /objects/:id — serve an uploaded object (e.g. a book cover image).
 *
 * Used by the web frontends (<img src="/api/objects/<uuid>">) so they don't
 * have to know about GCS URLs. Streams via the api-server, respecting the
 * object's stored Content-Type.
 *
 * Security: this route serves any uploaded object by its random UUID path.
 * The protection model is:
 *   - Cover images are intended to be browsable (catalog discovery).
 *   - Private files (e.g. paid book PDFs) MUST NOT be referenced via this
 *     route. The persistent /objects/<id> path of a private file is stored
 *     server-side; clients only ever receive a freshly-signed short-lived
 *     GCS GET URL via the signed-download-token flow.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

// Only objects under these prefixes may be served publicly by this route.
// Paid/private assets (e.g. books/files/*) must NEVER be added here — they
// are only reachable via short-lived signed GCS URLs minted at the moment
// a buyer redeems their download token.
const PUBLIC_PREFIXES = ["books/covers/"];

router.get(/^\/objects\/(.+)$/, async (req: Request, res: Response): Promise<void> => {
  const id = String((req.params as any)[0] || "");
  if (!id) { res.status(400).json({ error: "id required" }); return; }
  if (!PUBLIC_PREFIXES.some((p) => id.startsWith(p))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const file = await storage.getObjectEntityFile(`/objects/${id}`);
    const fetchResp = await storage.downloadObject(file, 3600);
    res.status(fetchResp.status);
    fetchResp.headers.forEach((value, key) => res.setHeader(key, value));
    if (fetchResp.body) {
      const reader = fetchResp.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (e) {
    if (e instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: e }, "objects: download failed");
    res.status(500).json({ error: "Download failed" });
  }
});

export default router;
