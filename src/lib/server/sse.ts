/**
 * Server-sent events from an async iterator. Works with `fetch` + a stream reader on the
 * client (the analysis endpoint is POST, which EventSource can't send).
 */
export function sseResponse<T extends { type: string }>(
  events: AsyncIterable<T>,
  signal?: AbortSignal,
  heartbeatMs = 15_000,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away; the iterator stops on the next abort check.
        }
      };
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), heartbeatMs);
      try {
        for await (const event of events) {
          if (signal?.aborted) break;
          send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err) {
        send(`event: error\ndata: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`);
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
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
