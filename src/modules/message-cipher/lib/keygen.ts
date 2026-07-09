/**
 * Generate a random user key. Works in both the browser and Node (uses the Web
 * Crypto API available as `globalThis.crypto` in modern runtimes).
 */
export function generateUserKey(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  // URL-safe base64-ish string, easy to copy/paste.
  const b64 =
    typeof btoa === "function"
      ? btoa(String.fromCharCode(...bytes))
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
