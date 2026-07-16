import "server-only";
import type { NextRequest } from "next/server";
import { checkRateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { resolveCallerFromRequest, subscribeComments } from "@/modules/feedback/lib/feedback.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream of one post's comment changes. Mirrors /api/feedback/stream:
 * identity comes from the HttpOnly session cookie, and each connection holds a
 * single Firestore listener emitting already-anonymized comment DTOs.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await checkRateLimit("feedback-stream", clientIp(req), 30, "1 m"))) {
    return tooManyRequests();
  }
  const { id } = await ctx.params;
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

      const unsub = subscribeComments(caller, id, {
        onComment: (comment) => send("comment", comment),
        onRemove: (cid) => send("remove", cid),
      });

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
      "X-Accel-Buffering": "no",
    },
  });
}
