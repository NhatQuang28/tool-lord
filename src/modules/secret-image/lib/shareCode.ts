/**
 * Share-code format helpers. Pure string logic — safe on client and server.
 *
 * A share code bundles the two things a viewer needs:
 *   <id>.<keyB64url>
 * where `id` locates the folder on the server (used in the URL path) and
 * `keyB64url` is the raw AES key, base64url-encoded. The key half is the SECRET
 * and must never be sent to the server — in deep links it rides in the URL
 * fragment (`#`), which browsers never transmit.
 */

const SEPARATOR = ".";

/**
 * Content-type used for every encrypted blob. The server signs the presigned
 * PUT with exactly this value, so the browser MUST send the same header or R2
 * rejects the upload with a signature mismatch. Shared here (a pure module) so
 * client and server can't drift.
 */
export const BLOB_CONTENT_TYPE = "application/octet-stream";

export function encodeShareCode(id: string, keyB64url: string): string {
  return `${id}${SEPARATOR}${keyB64url}`;
}

/** Parse a share code (or a full URL containing one) into its two halves. */
export function decodeShareCode(
  input: string,
): { id: string; keyB64url: string } | null {
  let raw = input.trim();
  if (!raw) return null;

  // Accept a pasted deep link: pull "<id>#<key>" out of the pathname+hash.
  if (raw.includes("/tools/secret-image/v/")) {
    const afterPath = raw.split("/tools/secret-image/v/")[1] ?? "";
    const [id] = afterPath.split(/[?#]/, 1);
    const hash = raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : "";
    if (id && hash) return { id, keyB64url: hash };
    return null;
  }

  const idx = raw.indexOf(SEPARATOR);
  if (idx <= 0 || idx === raw.length - 1) return null;
  const id = raw.slice(0, idx);
  const keyB64url = raw.slice(idx + 1);
  if (!id || !keyB64url) return null;
  return { id, keyB64url };
}
