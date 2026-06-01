import { RunInputSchema } from "@/lib/schemas";
import { assertLiveEnv } from "@/lib/env";
import { runPipeline } from "@/lib/pipeline";
import { acquireRunLock, releaseRunLock } from "@/lib/cache";
import { saveRun } from "@/lib/store";
import type { ResearchDossier } from "@/lib/types";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.run);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const sessionId = request.headers.get("x-session-id") ?? "anonymous";
  if (!acquireRunLock(sessionId)) {
    return new Response(
      JSON.stringify({ error: "A run is already active for this session." }),
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    releaseRunLock(sessionId);
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
    });
  }

  const parsed = RunInputSchema.safeParse(raw);
  if (!parsed.success) {
    releaseRunLock(sessionId);
    return new Response(
      JSON.stringify({
        error: "Invalid request payload.",
        details: parsed.error.flatten(),
      }),
      { status: 400 },
    );
  }

  if (parsed.data.mode === "live") {
    try {
      assertLiveEnv();
    } catch (error) {
      releaseRunLock(sessionId);
      const message =
        error instanceof Error ? error.message : "Live mode misconfigured.";
      return new Response(JSON.stringify({ error: message }), { status: 400 });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      let finalDossier: ResearchDossier | undefined;
      let signalTypes: { signalType?: "person" | "company" | "generic" }[] = [];
      try {
        for await (const event of runPipeline(parsed.data, request.signal)) {
          if (event.type === "dossier") finalDossier = event.dossier;
          if (event.type === "metrics") signalTypes = event.signalTypes;
          controller.enqueue(encoder.encode(sseData(event)));
        }
        if (finalDossier)
          saveRun(finalDossier, Date.now() - startedAt, signalTypes);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Pipeline failed unexpectedly.";
        controller.enqueue(encoder.encode(sseData({ type: "error", message })));
        controller.enqueue(encoder.encode(sseData({ type: "done" })));
      } finally {
        releaseRunLock(sessionId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
