// ============================================================================
//  Object Storage facade.
//  Picks the backend at module-load time based on env:
//    - S3_ENDPOINT set  → Cloudflare R2 / AWS S3 (./s3Storage)
//    - otherwise        → Replit Object Storage sidecar (./replitStorage)
//
//  Both backends export the same public surface:
//    class ObjectStorageService   — identical method signatures
//    class ObjectNotFoundError
//    const objectStorageClient    — { bucket(name).file(key) → handle with
//                                     .exists / .getMetadata / .save /
//                                     .createReadStream / .setMetadata }
//
//  The branching is intentional: same codebase runs on Replit (dev, today)
//  and on Contabo/R2 (production after migration) with zero code changes —
//  only env differs. Callers see one unified `any`-typed handle for the file
//  object because the underlying classes (GCS `File` vs `S3File`) differ but
//  are duck-typed to the same method set. Routes already use only the shared
//  subset; type safety on the shared methods is preserved by each backend.
// ============================================================================
import * as replit from "./replitStorage.js";
import * as s3 from "./s3Storage.js";

const useS3 = !!process.env.S3_ENDPOINT;
const impl = useS3 ? s3 : replit;

// Cast to the s3 class type so callers get a single concrete typing. The
// replit class is structurally compatible on every method we expose.
export const ObjectStorageService =
  impl.ObjectStorageService as unknown as typeof s3.ObjectStorageService;
export const ObjectNotFoundError = impl.ObjectNotFoundError;

// `objectStorageClient` shape is duck-typed (`.bucket(name).file(key)`); the
// raw underlying client differs across backends so it's intentionally untyped
// at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const objectStorageClient: any = impl.objectStorageClient;

export const ACTIVE_STORAGE_BACKEND: "s3" | "replit" = useS3 ? "s3" : "replit";
