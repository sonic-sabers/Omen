import { SOURCE_BUDGETS } from "@/lib/config";
import { getFixtureSources, resolveFixtureId } from "@/lib/fixtures";
import { searchTavily } from "@/lib/tavily";
import type { RawSource, RunInput } from "@/lib/types";

function truncateSources(sources: RawSource[]): RawSource[] {
  const limited = sources.slice(0, SOURCE_BUDGETS.maxSourcesPerRun);
  let chars = 0;
  const out: RawSource[] = [];
  for (const s of limited) {
    if (chars >= SOURCE_BUDGETS.maxSourceCharsForLLM) break;
    const left = SOURCE_BUDGETS.maxSourceCharsForLLM - chars;
    const snippet = s.snippet.slice(0, Math.max(0, left));
    out.push({ ...s, snippet });
    chars += snippet.length;
  }
  return out;
}

/**
 * R5: Multi-source search across different signal categories
 * - News/Press releases
 * - Podcasts/Interviews
 * - Conference talks
 * - Job postings
 * - Company blog
 * - LinkedIn (site:linkedin.com)
 */
function buildSearchQueries(
  prospect: RunInput["prospect"],
): { query: string; category: string }[] {
  const base = `${prospect.name} ${prospect.company}`.trim();
  const title = prospect.title ?? "";

  return [
    // News and press releases
    {
      query: `${base} ${title} news press release announcement`,
      category: "news",
    },
    { query: `${base} funding investment series`, category: "funding" },
    { query: `${base} acquisition merger partnership`, category: "m&a" },

    // Executive movements
    {
      query: `${base} ${title} appointed hired joined promoted`,
      category: "executive",
    },

    // Podcasts and media appearances
    { query: `${base} podcast interview keynote speaker`, category: "media" },
    {
      query: `${base} conference talk presentation webinar`,
      category: "conference",
    },

    // Company signals
    {
      query: `${prospect.company} hiring expansion growth`,
      category: "hiring",
    },
    {
      query: `${prospect.company} product launch release announcement`,
      category: "product",
    },

    // LinkedIn (direct profile search)
    {
      query: `${prospect.name} ${prospect.company} site:linkedin.com`,
      category: "linkedin",
    },
    {
      query: `${prospect.name} ${prospect.company} linkedin profile`,
      category: "linkedin",
    },
  ];
}

export async function researchSignals(
  input: RunInput,
  signal: AbortSignal,
): Promise<{ sources: RawSource[]; notes: string[] }> {
  if (input.mode === "fixture") {
    const fixtureId = resolveFixtureId(input);
    const raw = getFixtureSources(fixtureId);
    return {
      sources: truncateSources(raw),
      notes: ["Fixture mode: deterministic research sources loaded."],
    };
  }

  // R5: Gather signals via multiple web searches across sources
  const queries = buildSearchQueries(input.prospect);

  // Parallel search across all categories
  const batches = await Promise.all(
    queries.map(async ({ query, category }) => {
      const results = await searchTavily(query, signal);
      return results.map((r) => ({ ...r, sourceCategory: category }));
    }),
  );

  // Deduplicate by URL
  const dedup = new Map<string, RawSource>();
  const categoryCounts: Record<string, number> = {};

  for (const batch of batches) {
    for (const source of batch) {
      if (!dedup.has(source.url)) {
        dedup.set(source.url, source);
        const cat =
          (source as RawSource & { sourceCategory?: string }).sourceCategory ||
          "other";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }
  }

  const sources = truncateSources(Array.from(dedup.values()));

  // Gate 2: Insufficient signal check
  if (sources.length === 0) {
    return {
      sources: [],
      notes: ["Gate 2: No sources found across any search category."],
    };
  }

  // Check source diversity
  const uniqueCategories = Object.keys(categoryCounts).length;
  const notes = [
    `Live research: ${sources.length} sources from ${queries.length} parallel queries across ${uniqueCategories} categories.`,
    `Categories: ${Object.entries(categoryCounts)
      .map(([k, v]) => `${k}(${v})`)
      .join(", ")}`,
  ];

  // Gate 2 warning if too few sources
  if (sources.length < 3) {
    notes.push(
      "Gate 2 WARNING: Few sources found - signal strength may be limited.",
    );
  }

  return { sources, notes };
}
