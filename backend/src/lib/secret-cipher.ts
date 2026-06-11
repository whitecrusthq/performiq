import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Authenticated symmetric encryption for at-rest secrets (storage provider keys,
 * service-account JSON, etc.). Format: `enc:v1:<ivB64>:<tagB64>:<cipherB64>`.
 *
 * Key resolution order:
 *   1. STORAGE_CONFIG_ENCRYPTION_KEY (recommended: 32 random bytes, base64 or hex)
 *   2. derived from JWT_SECRET via scrypt with a fixed salt (fallback so existing
 *      deployments keep working without extra env setup).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce recommended for GCM
const TAG_LEN = 16;
const VERSION = "v1";
const SCRYPT_SALT = Buffer.from("performiq.storage.cipher.v1");

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.STORAGE_CONFIG_ENCRYPTION_KEY?.trim();
  if (raw) {
    let buf: Buffer | null = null;
    if (/^[A-Fa-f0-9]+$/.test(raw) && raw.length === 64) {
      buf = Buffer.from(raw, "hex");
    } else {
      try {
        const b = Buffer.from(raw, "base64");
        if (b.length === 32) buf = b;
      } catch { /* fall through */ }
    }
    if (buf && buf.length === 32) {
      cachedKey = buf;
      return cachedKey;
    }
    // bad explicit key — fall through to derivation rather than crashing
  }
  const seed = process.env.JWT_SECRET;
  if (!seed) throw new Error("Cannot derive encryption key: JWT_SECRET is not set");
  cachedKey = scryptSync(seed, SCRYPT_SALT, 32);
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  if (typeof blob !== "string" || !blob.startsWith("enc:")) return blob ?? "";
  const parts = blob.split(":");
  if (parts.length !== 5 || parts[1] !== VERSION) {
    throw new Error("Unsupported secret ciphertext format");
  }
  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const ct = Buffer.from(parts[4], "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Invalid secret ciphertext envelope");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("enc:" + VERSION + ":");
}

/** Convenience: only encrypt when there is something to encrypt. */
export function encryptSecretIfPresent(plain: unknown): string {
  if (typeof plain !== "string" || plain.length === 0) return "";
  if (isEncryptedSecret(plain)) return plain; // idempotent
  return encryptSecret(plain);
}
