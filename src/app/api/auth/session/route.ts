import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

// firebase-admin needs the Node.js runtime.
export const runtime = "nodejs";

/**
 * Exchange a Firebase ID token (Bearer header) for an HttpOnly session cookie.
 * The client calls this right after sign-in (see AuthProvider). The cookie is
 * what authenticates the SSE streams, which can't send an Authorization header.
 */
export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Thiếu token." }, { status: 400 });
  }

  try {
    const cookie = await createSessionCookie(match[1]);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Không tạo được phiên." }, { status: 401 });
  }
}

/** Clear the session cookie (called on sign-out). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
