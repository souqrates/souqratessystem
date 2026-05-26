import crypto from "crypto";

/**
 * Symmetric encryption for integration secrets at rest.
 *
 * - Algorithm: AES-256-GCM (authenticated). Tag is verified on decrypt;
 *   any tampering with `iv`/`ct`/`tag` throws.
 * - Key: 32 bytes derived from SESSION_SECRET via scrypt with a fixed salt.
 *   Using a fixed salt is acceptable because SESSION_SECRET is itself a
 *   high-entropy secret and we need deterministic key derivation across
 *   processes/restarts. Rotating SESSION_SECRET invalidates all encrypted
 *   integration secrets — that's a feature, not a bug.
 * - Envelope shape: `{ __enc: "v1", iv, tag, ct }`, base64url-encoded
 *   members. The `__enc` discriminator lets us migrate algorithms later.
 *
 * Fail-closed: if SESSION_SECRET is missing or too short, encrypt() throws.
 * Routes that store integration config must surface that as a 503.
 */
const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
// Pin the GCM authentication tag length to 16 bytes (the maximum). Without
// this, Node would accept a shorter tag at decrypt time, which weakens the
// forgery resistance of the cipher (Semgrep gcm-no-tag-length).
const TAG_LEN = 16;
const SALT = Buffer.from("souqrates:integrations:v1");

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is required (>=16 chars) to encrypt integration secrets",
    );
  }
  cachedKey = crypto.scryptSync(secret, SALT, KEY_LEN);
  return cachedKey;
}

export interface EncryptedEnvelope {
  __enc: "v1";
  iv: string;
  tag: string;
  ct: string;
}

export function isEncrypted(v: unknown): v is EncryptedEnvelope {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { __enc?: unknown }).__enc === "v1" &&
    typeof (v as { iv?: unknown }).iv === "string" &&
    typeof (v as { tag?: unknown }).tag === "string" &&
    typeof (v as { ct?: unknown }).ct === "string"
  );
}

export function encryptString(plaintext: string): EncryptedEnvelope {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __enc: "v1",
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ct: ct.toString("base64url"),
  };
}

export function decryptString(env: EncryptedEnvelope): string {
  const key = getKey();
  const iv = Buffer.from(env.iv, "base64url");
  const tag = Buffer.from(env.tag, "base64url");
  const ct = Buffer.from(env.ct, "base64url");
  if (tag.length !== TAG_LEN) {
    throw new Error("integration secret: bad auth tag length");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Mask a secret for UI display: keeps last 4 chars, replaces the rest with •. */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 4) return "•".repeat(plain.length);
  return "•".repeat(Math.min(plain.length - 4, 16)) + plain.slice(-4);
}
