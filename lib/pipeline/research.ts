import { RESEARCH_CONFIG, SOURCE_BUDGETS } from "@/lib/config";
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
 * R5: Multi-source search — 20 parallel queries across signal categories:
 * News, Funding, M&A, Executive moves, Media/Podcasts, Conferences,
 * Hiring signals, Product launches, Profile aggregators, Social/Twitter,
 * Company blog, Job postings, Financial/regulatory, Industry awards,
 * Quotes/opinions, Team changes, Customer/review signals, Patents/IP,
 * Partnerships, Recent activity
 */
function buildSearchQueries(
  prospect: RunInput["prospect"],
): { query: string; category: string }[] {
  const base = `${prospect.name} ${prospect.company}`.trim();
  const title = prospect.title ?? "";

  return [
    // News and press releases
    { query: `${base} ${title} news press release announcement`, category: "news" },
    { query: `${base} ${title} site:businesswire.com OR site:prnewswire.com`, category: "news" },

    // Funding
    { query: `${base} funding investment series raised`, category: "funding" },
    { query: `${prospect.company} valuation funding round investors`, category: "funding" },

    // M&A and partnerships
    { query: `${base} acquisition merger partnership deal`, category: "m&a" },

    // Executive movements
    { query: `${base} ${title} appointed hired joined promoted`, category: "executive" },
    { query: `${prospect.company} leadership team changes executive hire`, category: "executive" },

    // Podcasts and media
    { query: `${base} podcast interview guest speaker`, category: "media" },
    { query: `${base} site:youtube.com OR site:spotify.com OR site:apple.com/podcasts`, category: "media" },

    // Conferences and events
    { query: `${base} conference keynote webinar panel presentation`, category: "conference" },

    // Company hiring signals
    { query: `${prospect.company} hiring "account executive" OR "sales" OR "revenue" jobs`, category: "hiring" },
    { query: `${prospect.company} site:linkedin.com/jobs OR site:lever.co OR site:greenhouse.io`, category: "hiring" },

    // Product and growth
    { query: `${prospect.company} product launch release new feature`, category: "product" },
    { query: `${prospect.company} customer win case study growth`, category: "product" },

    // Social signals (Twitter/X, Reddit)
    { query: `${prospect.name} twitter OR "x.com" opinion thought leadership`, category: "social" },
    { query: `${prospect.company} reddit OR "hacker news" OR ycombinator discussion`, category: "social" },

    // Financial and regulatory
    { query: `${prospect.company} revenue earnings analyst report`, category: "financial" },

    // Awards and recognition
    { query: `${base} award recognition "forbes" OR "inc 500" OR "fast company"`, category: "awards" },

    // Executive profile aggregators (LinkedIn blocks crawlers directly)
    { query: `${prospect.name} ${prospect.company} crunchbase profile biography`, category: "profile" },
    { query: `${prospect.name} ${prospect.company} background career history quotes`, category: "profile" },

    // LinkedIn via aggregators that re-publish profile data
    { query: `${prospect.name} ${prospect.company} linkedin summary experience`, category: "linkedin" },
    { query: `"${prospect.name}" "${prospect.company}" site:rocketreach.co OR site:apollo.io OR site:zoominfo.com`, category: "linkedin" },
    { query: `"${prospect.name}" linkedin ${title} ${prospect.company} OR site:signalhire.com OR site:contactout.com`, category: "linkedin" },
    { query: `${prospect.name} ${prospect.company} previous role career path promoted`, category: "linkedin" },
    { query: `${prospect.name} ${prospect.company} "connected with" OR "works at" OR "currently at" linkedin`, category: "linkedin" },
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

  // Gate 2 warning if below citation target
  if (sources.length < RESEARCH_CONFIG.minSourceTarget) {
    notes.push(
      `Gate 2 WARNING: Only ${sources.length} sources found (target: ${RESEARCH_CONFIG.minSourceTarget}+). Signal strength may be limited.`,
    );
  }

  return { sources, notes };
}
