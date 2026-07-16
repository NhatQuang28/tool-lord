import "server-only";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { resolveCallerFromRequest, subscribeFeed } from "@/modules/feedback/lib/feedback.server";

// firebase-admin needs the Node.js runtime; the stream must never be cached and
// must stay open for the life of the connection.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of feed changes. `EventSource` can't set an
 * Authorization header, so identity comes from the HttpOnly session cookie
 * (see lib/auth/session.ts). Each connection holds one Firestore listener that
 * pushes already-anonymized post DTOs; it is torn down when the client leaves.
 */
export async function GET(req: NextRequest) {
  // Each connection pins a Firestore listener for its lifetime, so cap how fast
  // one IP can open new streams to blunt connection-exhaustion (DoS) attempts.
  if (!(await checkRateLimit("feedback-stream", clientIp(req), 30, "1 m"))) {
    return tooManyRequests();
  }
  const caller = await resolveCallerFromRequest(req);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };
      const send = (event: string, data: unknown) =>
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      send("ready", { ok: true });

      const unsub = subscribeFeed(caller, {
        onPost: (post) => send("post", post),
        onRemove: (id) => send("remove", id),
      });

      // Comment lines keep the connection alive through idle proxies.
      const heartbeat = setInterval(() => enqueue(`: ping\n\n`), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (e.g. nginx) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
