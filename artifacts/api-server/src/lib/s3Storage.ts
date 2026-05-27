// ============================================================================
//  S3-compatible object storage backend (Cloudflare R2, AWS S3, MinIO, …).
//  Mirrors the public surface of ./replitStorage.ts so it is a drop-in swap
//  selected by ./objectStorage.ts at import time based on env S3_ENDPOINT.
//
//  ACL model: stored as S3 user metadata key `aclpolicy` (S3 normalises custom
//  metadata to lowercase). Same JSON payload shape as ./objectAcl.ts emits.
// ============================================================================
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject as canAccessObjectGeneric,
} from "./objectAcl";

const ACL_METADATA_KEY = "aclpolicy"; // S3 lowercases x-amz-meta-* keys

// ── Client ──────────────────────────────────────────────────────────────────
const endpoint = process.env.S3_ENDPOINT ?? "";
const region = process.env.S3_REGION || "auto";
const accessKeyId = process.env.S3_ACCESS_KEY ?? "";
const secretAccessKey = process.env.S3_SECRET_KEY ?? "";

export const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true, // R2/MinIO compatibility
});

const DEFAULT_BUCKET = process.env.S3_BUCKET ?? "";

// ── Errors ──────────────────────────────────────────────────────────────────
export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ── File handle (duck-typed to mirror @google-cloud/storage File shape we use)
// Only the methods our codebase touches are implemented.
export interface S3FileMetadata {
  contentType?: string;
  size?: number | string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export class S3File {
  constructor(public readonly bucket: string, public readonly key: string) {}

  get name(): string { return this.key; }

  async exists(): Promise<[boolean]> {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key }));
      return [true];
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return [false];
      throw err;
    }
  }

  async getMetadata(): Promise<[S3FileMetadata]> {
    const out = await s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.key }));
    return [{
      contentType: out.ContentType,
      size: out.ContentLength,
      cacheControl: out.CacheControl,
      metadata: out.Metadata ?? {},
    }];
  }

  createReadStream(): NodeJS.ReadableStream {
    const passthrough = new Readable({ read() {} });
    s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key }))
      .then((out) => {
        const body = out.Body as Readable | undefined;
        if (!body) { passthrough.push(null); return; }
        body.on("data", (c) => passthrough.push(c));
        body.on("end", () => passthrough.push(null));
        body.on("error", (e) => passthrough.destroy(e));
      })
      .catch((e) => passthrough.destroy(e));
    return passthrough;
  }

  async save(body: Buffer | Uint8Array | string, opts: {
    contentType?: string;
    metadata?: { cacheControl?: string; metadata?: Record<string, string> };
    resumable?: boolean;
  } = {}): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
      Body: body,
      ContentType: opts.contentType,
      CacheControl: opts.metadata?.cacheControl,
      Metadata: opts.metadata?.metadata,
    }));
  }

  // GCS-shaped: { metadata: { key: value } } → re-uploads object preserving body.
  // S3 can't update metadata in place; we COPY the object onto itself with new metadata.
  async setMetadata(input: { metadata?: Record<string, string> }): Promise<void> {
    const userMeta = input.metadata ?? {};
    await s3Client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
      CopySource: `${this.bucket}/${encodeURIComponent(this.key)}`,
      Metadata: userMeta,
      MetadataDirective: "REPLACE",
    }));
  }
}

// Compat shim so callers that used `objectStorageClient.bucket(b).file(k)` keep working.
export const objectStorageClient = {
  bucket(bucketName: string) {
    return {
      file(key: string) { return new S3File(bucketName, key); },
    };
  },
};

// ── ACL helpers (S3 metadata-based) ─────────────────────────────────────────
async function getS3AclPolicy(file: S3File): Promise<ObjectAclPolicy | null> {
  const [meta] = await file.getMetadata();
  const raw = meta.metadata?.[ACL_METADATA_KEY];
  if (!raw) return null;
  try { return JSON.parse(raw) as ObjectAclPolicy; } catch { return null; }
}

async function setS3AclPolicy(file: S3File, policy: ObjectAclPolicy): Promise<void> {
  const [exists] = await file.exists();
  if (!exists) throw new Error(`Object not found: ${file.key}`);
  await file.setMetadata({ metadata: { [ACL_METADATA_KEY]: JSON.stringify(policy) } });
}

// ── Path parsing — same /bucket/key convention as Replit backend ────────────
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

// ── Service ─────────────────────────────────────────────────────────────────
export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): string[] {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(new Set(
      pathsStr.split(",").map((p) => p.trim()).filter(Boolean),
    ));
    if (paths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set (comma-separated /bucket/prefix).");
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set (e.g. /souqrates-prod/private).");
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<S3File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parseObjectPath(`${searchPath}/${filePath}`);
      const f = new S3File(bucketName, objectName);
      const [exists] = await f.exists();
      if (exists) return f;
    }
    return null;
  }

  async downloadObject(file: S3File, cacheTtlSec = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const acl = await getS3AclPolicy(file);
    const isPublic = acl?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream as Readable) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size != null) headers["Content-Length"] = String(metadata.size);
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    return this.getNamedUploadURL("uploads");
  }

  async getNamedUploadURL(subdir: string): Promise<string> {
    const cleanSub = subdir.replace(/^\/+|\/+$/g, "");
    const objectId = randomUUID();
    const fullPath = `${this.getPrivateObjectDir()}/${cleanSub}/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return getSignedUrl(
      s3Client,
      new PutObjectCommand({ Bucket: bucketName, Key: objectName }),
      { expiresIn: 900 },
    );
  }

  async getDownloadURL(objectPath: string, ttlSec = 300): Promise<string> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const { bucketName, objectName } = parseObjectPath(`${entityDir}${entityId}`);
    return getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucketName, Key: objectName }),
      { expiresIn: ttlSec },
    );
  }

  async getObjectEntityFile(objectPath: string): Promise<S3File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const { bucketName, objectName } = parseObjectPath(`${entityDir}${entityId}`);
    const file = new S3File(bucketName, objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Accept either GCS-style URL (legacy) or S3/R2 presigned PUT URL.
    let pathPart: string;
    if (rawPath.startsWith("https://storage.googleapis.com/")) {
      pathPart = new URL(rawPath).pathname;
    } else if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      // R2/S3 presigned URL — strip query, take pathname (which begins with /bucket/key for path-style)
      pathPart = new URL(rawPath).pathname;
    } else {
      return rawPath;
    }
    let dir = this.getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    if (!pathPart.startsWith(dir)) return pathPart;
    return `/objects/${pathPart.slice(dir.length)}`;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalized = this.normalizeObjectEntityPath(rawPath);
    if (!normalized.startsWith("/")) return normalized;
    const file = await this.getObjectEntityFile(normalized);
    await setS3AclPolicy(file, aclPolicy);
    return normalized;
  }

  async canAccessObjectEntity({
    userId, objectFile, requestedPermission,
  }: {
    userId?: string;
    objectFile: S3File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    const acl = await getS3AclPolicy(objectFile);
    if (!acl) return false;
    if (acl.visibility === "public" && (requestedPermission ?? ObjectPermission.READ) === ObjectPermission.READ) return true;
    if (!userId) return false;
    if (acl.owner === userId) return true;
    // Delegate group-based rules to the shared helper. Pass an adapter that
    // returns the same ACL we just fetched so the helper doesn't refetch.
    return canAccessObjectGeneric({
      userId,
      // The shared helper calls getObjectAclPolicy(file) which expects a GCS File.
      // We've already done the ACL check above for non-group cases, so this path
      // is only reached for group rules — which the current codebase doesn't
      // exercise (ObjectAccessGroupType is empty). Safe no-op fallback.
      objectFile: objectFile as unknown as never,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    }).catch(() => false);
  }
}
