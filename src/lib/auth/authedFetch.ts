"use client";

/**
 * Client-side fetch that attaches the current user's Firebase ID token as a
 * `Bearer` header. This is the mechanism resource-heavy tools use to call their
 * API routes — the server verifies the token with `requireUser` before working.
 *
 * Throws if no user is signed in, so callers can prompt the user to log in.
 */
import { auth } from "@/lib/firebase/client";

export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Bạn cần đăng nhập để dùng tính năng này.");
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
