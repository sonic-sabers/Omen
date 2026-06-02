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

export async function searchTavily(query: string, signal: AbortSignal, includeDomains?: string[]): Promise<RawSource[]> {
  const { tavilyApiKey } = readEnv();
  if (!tavilyApiKey) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_BUDGETS.tavilyTimeoutMs);
  signal.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const response = await fetch(TAVILY_CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        max_results: TAVILY_CONFIG.maxResultsPerQuery,
        search_depth: TAVILY_CONFIG.searchDepth,
        ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as TavilyResponse;
    const out: RawSource[] = [];

    for (const row of json.results ?? []) {
      if (!row.url || !row.content) continue;
      out.push({
        sourceName: row.title?.slice(0, TAVILY_CONFIG.sourceNameMaxChars) || "Web Source",
        url: row.url,
        publishedAt: row.published_date,
        snippet: row.content.slice(0, TAVILY_CONFIG.snippetMaxChars),
      });
    }

    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
