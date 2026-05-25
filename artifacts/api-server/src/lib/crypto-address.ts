/**
 * Offline format + checksum validation for crypto withdrawal addresses.
 *
 * Why local-only (no RPC): a single fat-fingered withdrawal address can
 * burn user funds permanently. We want to reject malformed addresses
 * BEFORE they enter the cooldown queue (the 24h whitelist would otherwise
 * make a user wait a day just to discover they typed a bad address).
 *
 * Checksum validation catches > 99.99% of typos because every supported
 * network embeds a self-verifying checksum in the address itself:
 *   - TRC20: Base58Check (Bitcoin family) — double-SHA256 last 4 bytes.
 *   - TON: CRC16-XMODEM last 2 bytes of the user-friendly form.
 *
 * What this does NOT do:
 *   - Verify the address exists on-chain (would require an RPC call).
 *   - Verify the address is a contract vs EOA, or its activation status.
 *   - Block "burn" addresses or known scam addresses (those are policy).
 */
import crypto from "crypto";

export type Network = "trc20" | "ton";

export interface AddressValidation {
  ok: boolean;
  /** Human-readable reason on failure. Stable enough for i18n keys. */
  reason?: "wrong_length" | "bad_charset" | "bad_checksum" | "bad_prefix" | "bad_version" | "unsupported_network";
}

/**
 * Top-level entry point. Maps loose network spellings to validators so the
 * caller can pass through whatever `methodCode` already exists in the
 * withdrawal table (e.g. "usdt_trc20", "ton", "tron").
 */
export function validateCryptoAddress(network: string, address: string): AddressValidation {
  const addr = (address ?? "").trim();
  if (!addr) return { ok: false, reason: "wrong_length" };

  const n = network.toLowerCase();
  if (n === "trc20" || n === "tron" || n.includes("trc20")) return validateTrc20(addr);
  if (n === "ton") return validateTon(addr);

  // We deliberately *accept* unknown networks rather than block — callers
  // should add a validator before adding a new methodCode, but we don't
  // want a missing validator to brick all withdrawals on an existing one.
  return { ok: true };
}

// ─── TRC20 (Base58Check, version byte 0x41) ──────────────────────────────

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s: string): Uint8Array | null {
  const map: Record<string, number> = {};
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    const ch = BASE58_ALPHABET[i];
    if (ch !== undefined) map[ch] = i;
  }
  let bytes: number[] = [0];
  for (const c of s) {
    const v = map[c];
    if (v === undefined) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      const x = ((bytes[i] ?? 0) * 58) + carry;
      bytes[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading "1"s in the input map to leading zero bytes.
  for (const c of s) {
    if (c === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

function validateTrc20(address: string): AddressValidation {
  // All mainnet Tron addresses are exactly 34 base58 chars and begin with T.
  if (address.length !== 34) return { ok: false, reason: "wrong_length" };
  if (address[0] !== "T") return { ok: false, reason: "bad_prefix" };

  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) return { ok: false, reason: "bad_charset" };

  // Version byte: 0x41 = mainnet account.
  if (decoded[0] !== 0x41) return { ok: false, reason: "bad_version" };

  const payload = decoded.subarray(0, 21);
  const givenChecksum = decoded.subarray(21, 25);
  const h1 = crypto.createHash("sha256").update(payload).digest();
  const h2 = crypto.createHash("sha256").update(h1).digest();
  for (let i = 0; i < 4; i++) {
    if (h2[i] !== givenChecksum[i]) return { ok: false, reason: "bad_checksum" };
  }
  return { ok: true };
}

// ─── TON (user-friendly base64url + CRC16-XMODEM) ────────────────────────

function crc16Xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base64UrlDecode(s: string): Uint8Array | null {
  // TON addresses use the URL-safe alphabet (- and _ instead of + and /).
  // Accept both for resilience to copy/paste from non-URL contexts.
  const normalised = s.replace(/-/g, "+").replace(/_/g, "/");
  // Length must be multiple of 4 once padded; standard TON form is 48 chars
  // with no padding (decodes to 36 bytes).
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  try {
    const buf = Buffer.from(padded, "base64");
    if (buf.length === 0) return null;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function validateTon(address: string): AddressValidation {
  // Reject raw form (workchain:hex64) up front — we only support
  // user-friendly addresses for withdrawals because raw form has no
  // checksum and is easy to typo silently.
  if (address.includes(":")) return { ok: false, reason: "bad_prefix" };

  // User-friendly form is always 48 chars (36 bytes base64url-encoded).
  if (address.length !== 48) return { ok: false, reason: "wrong_length" };

  const decoded = base64UrlDecode(address);
  if (!decoded || decoded.length !== 36) return { ok: false, reason: "bad_charset" };

  // Tag byte: 0x11 bounceable / 0x51 non-bounceable, +0x80 testnet.
  // We allow all four mainnet+testnet bounceable/non-bounceable variants.
  const tag = decoded[0]! & 0x7f;
  if (tag !== 0x11 && tag !== 0x51) return { ok: false, reason: "bad_version" };

  const payload = decoded.subarray(0, 34);
  const givenCrc = (decoded[34]! << 8) | decoded[35]!;
  const expectedCrc = crc16Xmodem(payload);
  if (givenCrc !== expectedCrc) return { ok: false, reason: "bad_checksum" };

  return { ok: true };
}
