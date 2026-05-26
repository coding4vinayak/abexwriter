/**
 * AES-256-GCM symmetric encryption for at-rest secrets (API keys).
 *
 * The encryption key is derived from the `LLM_KEY_SECRET` environment variable
 * via SHA-256 (so any-length passphrase is accepted). For production, set this
 * to a 32+ character random string and rotate by re-encrypting all rows.
 *
 * Wire format (base64 of):  [12-byte IV] [16-byte authTag] [ciphertext]
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;       // GCM standard
const AUTH_TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.LLM_KEY_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    // Dev fallback. Logged loudly so it isn't silently used in production.
    // eslint-disable-next-line no-console
    console.warn(
      "[llm/crypto] LLM_KEY_SECRET is not set — using insecure dev fallback. " +
      "Set LLM_KEY_SECRET to a 32+ character random string in production.",
    );
    cachedKey = createHash("sha256").update("abexwriter-dev-fallback-do-not-use-in-prod").digest();
    return cachedKey;
  }
  cachedKey = createHash("sha256").update(secret).digest();
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error("Invalid ciphertext payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ct = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Build a redacted preview safe to expose via the API. */
export function redactKey(key: string): string {
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
