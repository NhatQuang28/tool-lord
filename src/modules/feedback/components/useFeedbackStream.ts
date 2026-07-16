// src/modules/feedback/components/useFeedbackStream.ts
"use client";
/**
 * Subscribe to a feedback SSE endpoint via `EventSource`. Since EventSource
 * can't send an Authorization header, identity travels in the HttpOnly session
 * cookie (minted by AuthProvider on sign-in) — the browser attaches it to this
 * same-origin request automatically, so no credential ever appears in the URL.
 * The connection is torn down and re-opened whenever `path` or `userKey` (the
 * signed-in uid) changes, and closed on unmount. EventSource auto-reconnects on
 * transient drops.
 */
import { useEffect, useRef } from "react";

type StreamHandlers = Record<string, (data: unknown) => void>;

export function useFeedbackStream(
  path: string | null,
  userKey: string | null,
  handlers: StreamHandlers,
) {
  // Keep the latest handlers without forcing a re-subscribe every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!path) return;
    const url = new URL(path, window.location.origin);
    // withCredentials sends the same-origin session cookie with the stream.
    const source = new EventSource(url.toString(), { withCredentials: true });
    for (const [event, fn] of Object.entries(handlersRef.current)) {
      source.addEventListener(event, (e) => {
        try {
          fn(JSON.parse((e as MessageEvent).data));
        } catch {
          /* ignore malformed frames */
        }
      });
    }

    return () => {
      source.close();
    };
  }, [path, userKey]);
}
