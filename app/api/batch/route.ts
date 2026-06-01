import { runPipeline } from "@/lib/pipeline";
import { saveRun } from "@/lib/store";
import { DEFAULT_SALES_CONTEXT } from "@/lib/config";
import type { Prospect } from "@/lib/types";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.batch);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  try {
    const body = await request.json();
    const prospect: Prospect = body.prospect;

    if (!prospect?.name || !prospect?.company) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name and company" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const abortController = new AbortController();
    const startedAt = Date.now();

    // Run pipeline for single prospect
    const events: unknown[] = [];
    let dossier = null;
    let signalTypes: { signalType?: "person" | "company" | "generic" }[] = [];

    for await (const event of runPipeline(
      {
        mode: "live",
        prospect,
        salesContext: DEFAULT_SALES_CONTEXT,
      },
      abortController.signal,
    )) {
      events.push(event);
      if (event.type === "dossier") {
        dossier = event.dossier;
      }
      if (event.type === "metrics") {
        signalTypes = event.signalTypes;
      }
    }

    const durationMs = Date.now() - startedAt;

    if (!dossier) {
      return new Response(
        JSON.stringify({ error: "Pipeline failed to produce dossier" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Save to store with metrics
    const record = saveRun(dossier, durationMs, signalTypes);

    return new Response(
      JSON.stringify({
        id: record.id,
        confidenceTier: record.confidenceTier,
        hookSummary: record.hookSummary,
        draftProduced: record.draftProduced,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
