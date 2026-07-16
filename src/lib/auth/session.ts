/**
 * Firebase session-cookie helpers (server-only).
 *
 * WHY THIS EXISTS
 * ---------------
 * The SSE endpoints (feedback streams) are opened with the browser `EventSource`
 * API, which CANNOT set an `Authorization` header. Previously the Firebase ID
 * token was passed as a `?token=` query param — but URLs land in server / proxy /
 * CDN access logs and browser history, leaking a replayable bearer credential.
 *
 * Instead we exchange the ID token (once, over a normal Bearer request) for a
 * Firebase *session cookie* that is `HttpOnly` + `Secure` + `SameSite=Lax`. The
 * cookie is sent automatically on same-origin requests (including EventSource),
 * never exposed to JavaScript, and never appears in a URL. The stream endpoints
 * verify it with the Admin SDK.
 */
import "server-only";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";

/** Name of the HttpOnly session cookie. */
export const SESSION_COOKIE = "__session";

/** Session lifetime. Firebase allows 5 minutes … 2 weeks. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days

/**
 * Mint a session cookie from a freshly-issued ID token. Firebase requires the
 * ID token to be recent (issued within the last 5 minutes), so the client must
 * call `getIdToken()` right before exchanging it. Throws if the token is invalid.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

/**
 * Verify the session cookie on a request and return the decoded identity, or
 * `null` when the cookie is absent, expired, or revoked. `checkRevoked=true`
 * makes a revoked/disabled account's cookie fail immediately.
 */
export async function verifySessionRequest(
  req: NextRequest,
): Promise<DecodedIdToken | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    return await adminAuth.verifySessionCookie(cookie, true);
  } catch {
    return null;
  }
}
