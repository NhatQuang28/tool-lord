import { NextRequest, NextResponse } from "next/server";

/**
 * Per-request Content-Security-Policy with a fresh nonce.
 *
 * Follows the Next.js recommended nonce + `strict-dynamic` pattern: the nonce is
 * generated here, stamped onto Next's own scripts (Next reads it from this CSP
 * header) and onto our two inline scripts in `layout.tsx` (which read it back
 * from the `x-nonce` request header). `strict-dynamic` means only scripts loaded
 * by an already-trusted (nonce'd) script run — so the Firebase SDK's dynamically
 * injected scripts (Google sign-in, etc.) work, while injected inline attacker
 * script does not. The `https:`/`'unsafe-inline'` fallbacks are ignored by modern
 * browsers when a nonce is present; they only soften behaviour on old browsers.
 *
 * The allowlists below cover Firebase Auth + Cloudflare R2 (secret-image
 * uploads/downloads). If you add a third-party origin, extend connect-src /
 * frame-src / img-src accordingly. VERIFY IN A BROWSER after changing this:
 * sign in (email + Google popup), open a feedback stream, upload & view a
 * secret image — the browser console reports any CSP violation.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    // Firebase Auth token/identity endpoints + Cloudflare R2 presigned URLs.
    `connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.r2.cloudflarestorage.com`,
    // Firebase Auth iframe + Google sign-in popup.
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all paths EXCEPT static assets and prefetches (no inline scripts to
    // protect there, and it keeps those responses cacheable).
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
