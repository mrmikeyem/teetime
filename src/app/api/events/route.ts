import { auth } from "@/lib/auth";
import { subscribeToChanges } from "@/lib/events";

export const dynamic = "force-dynamic";

// Cloudflare's proxy drops idle connections at ~100s; nginx's default
// proxy_read_timeout is 60s. Ping well under both.
const HEARTBEAT_MS = 30_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(chunk: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      }

      const unsubscribe = subscribeToChanges((event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      }

      req.signal.addEventListener("abort", close);

      // Tell EventSource how fast to retry after a drop.
      send("retry: 3000\n\n");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx not to buffer this response — without it the stream's
      // events sit in the proxy buffer instead of reaching the client.
      "X-Accel-Buffering": "no",
    },
  });
}
