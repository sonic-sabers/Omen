import { SOURCE_BUDGETS, TAVILY_CONFIG } from "@/lib/config";
import { readEnv } from "@/lib/env";
import type { RawSource } from "@/lib/types";

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }>;
}

export class TavilyError extends Error {
  constructor(
    public readonly code:
      | "no_api_key"
      | "rate_limited"
      | "auth_failed"
      | "http_error"
      | "network"
      | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "TavilyError";
  }
}

export async function searchTavily(
  query: string,
  signal: AbortSignal,
  includeDomains?: string[],
): Promise<RawSource[]> {
  const { tavilyApiKey } = readEnv();
  if (!tavilyApiKey) {
    throw new TavilyError("no_api_key", "TAVILY_API_KEY is not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SOURCE_BUDGETS.tavilyTimeoutMs,
  );
  signal.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const response = await fetch(TAVILY_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tavilyApiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: TAVILY_CONFIG.maxResultsPerQuery,
        search_depth: TAVILY_CONFIG.searchDepth,
        ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429)
        throw new TavilyError(
          "rate_limited",
          "Tavily rate limit exceeded (HTTP 429)",
        );
      if (response.status === 401 || response.status === 403)
        throw new TavilyError(
          "auth_failed",
          `Tavily auth failed (HTTP ${response.status})`,
        );
      throw new TavilyError(
        "http_error",
        `Tavily returned HTTP ${response.status}`,
      );
    }

    const json = (await response.json()) as TavilyResponse;
    const out: RawSource[] = [];

    for (const row of json.results ?? []) {
      if (!row.url || !row.content) continue;
      out.push({
        sourceName:
          row.title?.slice(0, TAVILY_CONFIG.sourceNameMaxChars) || "Web Source",
        url: row.url,
        publishedAt: row.published_date,
        snippet: row.content.slice(0, TAVILY_CONFIG.snippetMaxChars),
      });
    }

    return out;
  } catch (err) {
    if (err instanceof TavilyError) throw err;
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw new TavilyError(
      isTimeout ? "timeout" : "network",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timeout);
  }
}
