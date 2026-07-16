/**
 * Static security headers applied to every response. The per-request
 * Content-Security-Policy (which needs a fresh nonce) is set in middleware.ts.
 */
const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains. Safe once the site is
  // HTTPS-only (it is, on Vercel/toollord.online).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Belt-and-braces clickjacking defense alongside CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which may carry ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop ambient access to powerful features this app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
