import { listRuns } from "@/lib/store";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.runs);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  return new Response(JSON.stringify({ runs: listRuns(limit) }), {
    headers: { "Content-Type": "application/json" },
  });
}
