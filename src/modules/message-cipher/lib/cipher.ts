import { getStyle } from "./alphabets";

/**
 * Message cipher core.
 *
 * The scheme is a keystream (Vigenère-style) cipher over the UTF-8 bytes of the
 * message, followed by encoding the encrypted bytes into a chosen visual style
 * (alphabet). It is fully reversible and supports any Unicode input (Vietnamese
 * included). The same combined key + style is required to decrypt.
 *
 * NOTE: this is obfuscation-grade, not cryptographically strong. It is meant
 * for fun / light privacy, not for protecting high-value secrets.
 */

// --- PRNG: derive a deterministic keystream from the combined key ------------

/** xmur3 string hash -> 32-bit seed producer. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG -> floats in [0, 1). */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh keystream (0..255 per call) seeded from the combined key. */
function makeKeystream(combinedKey: string): () => number {
  const seed = xmur3(combinedKey);
  // Fold two 32-bit words into the PRNG seed for a bit more spread.
  const rand = mulberry32(seed() ^ seed());
  return () => Math.floor(rand() * 256);
}

// --- byte <-> glyph encoding -------------------------------------------------

/** Number of glyphs needed to represent a full byte (0..255) in `base`. */
function widthFor(base: number): number {
  return Math.max(1, Math.ceil(Math.log(256) / Math.log(base)));
}

function encodeBytes(bytes: Uint8Array, glyphs: string[]): string {
  const base = glyphs.length;
  const width = widthFor(base);
  let out = "";
  for (const b of bytes) {
    let v = b;
    const digits: string[] = [];
    for (let k = 0; k < width; k++) {
      digits.push(glyphs[v % base]);
      v = Math.floor(v / base);
    }
    // big-endian for readability
    out += digits.reverse().join("");
  }
  return out;
}

function decodeBytes(text: string, glyphs: string[]): Uint8Array {
  const base = glyphs.length;
  const width = widthFor(base);
  const index = new Map<string, number>();
  glyphs.forEach((g, i) => index.set(g, i));

  // Keep only recognized glyphs so stray whitespace/newlines are tolerated.
  const known = Array.from(text).filter((c) => index.has(c));
  if (known.length % width !== 0) {
    throw new Error(
      "Bản mã không hợp lệ cho kiểu chữ đã chọn (độ dài không khớp).",
    );
  }
  const bytes = new Uint8Array(known.length / width);
  for (let i = 0; i < bytes.length; i++) {
    let v = 0;
    for (let k = 0; k < width; k++) {
      v = v * base + (index.get(known[i * width + k]) as number);
    }
    bytes[i] = v & 0xff;
  }
  return bytes;
}

// --- public API --------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export function encryptMessage(
  plaintext: string,
  combinedKey: string,
  styleId: string,
): string {
  if (!plaintext) return "";
  const style = getStyle(styleId);
  const bytes = encoder.encode(plaintext);
  const ks = makeKeystream(combinedKey);
  const cipher = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    cipher[i] = (bytes[i] + ks()) & 0xff;
  }
  return encodeBytes(cipher, style.glyphs);
}

export function decryptMessage(
  ciphertext: string,
  combinedKey: string,
  styleId: string,
): string {
  if (!ciphertext) return "";
  const style = getStyle(styleId);
  const cipher = decodeBytes(ciphertext, style.glyphs);
  const ks = makeKeystream(combinedKey);
  const bytes = new Uint8Array(cipher.length);
  for (let i = 0; i < cipher.length; i++) {
    bytes[i] = (cipher[i] - ks() + 256) & 0xff;
  }
  return decoder.decode(bytes);
}

/** Combine the server web secret with the user key into one keying string. */
export function combineKeys(webKey: string, userKey: string): string {
  return `${webKey}::${userKey ?? ""}`;
}
