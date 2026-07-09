/**
 * Client-side encryption for the secret-image tool. Runs in the browser only
 * (uses Web Crypto). This is the heart of the end-to-end guarantee: everything
 * is encrypted here BEFORE upload and decrypted here AFTER download, so the
 * server and R2 only ever see ciphertext.
 *
 * Scheme: AES-GCM 256. One random key per folder (exported into the share
 * code); one fresh random 12-byte IV per encrypted blob (never reused). GCM
 * also authenticates, so tampered ciphertext fails to decrypt rather than
 * yielding garbage.
 *
 * Following Workers/Web-Crypto best practice, all randomness comes from
 * `crypto.getRandomValues` / `crypto.subtle` — never `Math.random`.
 */
import type { FileMeta } from "../types";

const ALGO = "AES-GCM";
const IV_BYTES = 12;

// --- base64 helpers ---------------------------------------------------------

function bytesToBinary(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}

export function base64ToBytes(b64: string): Uint8Array {
  return binaryToBytes(atob(b64));
}

/** URL-safe base64 (no padding) — used for the key that rides in URLs/codes. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(b64);
}

// --- key management ---------------------------------------------------------

export function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return bytesToBase64Url(raw);
}

export function importKey(keyB64url: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(keyB64url);
  // `raw as BufferSource` — a Uint8Array is a valid BufferSource.
  return crypto.subtle.importKey("raw", raw, { name: ALGO }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- byte-level encrypt / decrypt -------------------------------------------

export interface EncryptedBlob {
  /** Raw ciphertext bytes (uploaded to R2 as-is, never base64'd). */
  cipher: ArrayBuffer;
  /** Base64 IV for this blob. */
  ivB64: string;
}

export async function encryptBytes(
  key: CryptoKey,
  data: ArrayBuffer,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data);
  return { cipher, ivB64: bytesToBase64(iv) };
}

export function decryptBytes(
  key: CryptoKey,
  cipher: ArrayBuffer,
  ivB64: string,
): Promise<ArrayBuffer> {
  const iv = base64ToBytes(ivB64);
  return crypto.subtle.decrypt({ name: ALGO, iv }, key, cipher);
}

// --- file metadata (name + MIME type) encrypt / decrypt ---------------------

export async function encryptMeta(
  key: CryptoKey,
  meta: FileMeta,
): Promise<{ metaCipher: string; metaIv: string }> {
  const data = new TextEncoder().encode(JSON.stringify(meta));
  const { cipher, ivB64 } = await encryptBytes(key, data.buffer as ArrayBuffer);
  return { metaCipher: bytesToBase64(new Uint8Array(cipher)), metaIv: ivB64 };
}

export async function decryptMeta(
  key: CryptoKey,
  metaCipher: string,
  metaIv: string,
): Promise<FileMeta> {
  const cipher = base64ToBytes(metaCipher);
  const plain = await decryptBytes(key, cipher.buffer as ArrayBuffer, metaIv);
  return JSON.parse(new TextDecoder().decode(plain)) as FileMeta;
}
