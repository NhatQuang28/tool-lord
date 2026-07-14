// src/modules/feedback/components/client.ts
"use client";
/**
 * Client fetch helpers for the feedback feature.
 *  - feedbackGet: public GET that ATTACHES the token when signed in (so the
 *    server can compute `mine`/`myVote` and reveal authors for privileged users),
 *    but never throws when signed out.
 *  - feedbackSend: authed mutation; throws when signed out so callers can prompt.
 */
import { auth } from "@/lib/firebase/client";

export async function feedbackGet(url: string): Promise<Response> {
  const headers = new Headers();
  const user = auth.currentUser;
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(url, { headers });
}

export async function feedbackSend(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Bạn cần đăng nhập để dùng tính năng này.");
  const headers = new Headers({ Authorization: `Bearer ${await user.getIdToken()}` });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
