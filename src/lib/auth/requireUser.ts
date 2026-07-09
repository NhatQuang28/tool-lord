/**
 * Server-side auth gate for API routes.
 *
 * Reads the `Authorization: Bearer <idToken>` header and verifies it with the
 * Firebase Admin SDK. Returns the decoded token (identity) on success, or
 * `null` when missing/invalid — the caller should then respond with 401.
 *
 * Usage in a route:
 *   const user = await requireUser(req);
 *   if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
 *   // ...run the resource-heavy work for user.uid
 */
import "server-only";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebase/admin";

export async function requireUser(
  req: NextRequest,
): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}
