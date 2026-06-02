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
): { query: string; category: string; domains?: string[] }[] {
  const title = prospect.title ?? "";
  const name = prospect.name;
  const company = prospect.company;

  return [
    // News — person-anchored, pinned to high-quality press outlets
    {
      query: `"${name}" "${company}" news announcement`,
      category: "news",
      domains: ["techcrunch.com", "forbes.com", "businesswire.com", "prnewswire.com", "venturebeat.com", "inc.com", "wired.com", "bloomberg.com", "reuters.com", "wsj.com", "ft.com"],
    },

    // Funding
    {
      query: `"${name}" "${company}" funding raised series investment`,
      category: "funding",
      domains: ["crunchbase.com", "techcrunch.com", "pitchbook.com", "axios.com", "bloomberg.com", "businessinsider.com"],
    },
    {
      query: `"${company}" funding round raised`,
      category: "funding",
      domains: ["crunchbase.com", "pitchbook.com", "techcrunch.com", "venturebeat.com"],
    },

    // M&A
    {
      query: `"${name}" "${company}" acquisition merger partnership deal`,
      category: "m&a",
      domains: ["reuters.com", "bloomberg.com", "wsj.com", "techcrunch.com", "businesswire.com"],
    },

    // Executive movements
    {
      query: `"${name}" ${title} appointed hired joined promoted`,
      category: "executive",
      domains: ["linkedin.com", "businesswire.com", "prnewswire.com", "globenewswire.com", "accesswire.com"],
    },

    // Podcasts & media appearances
    {
      query: `"${name}" podcast interview speaker`,
      category: "media",
      domains: ["spotify.com", "podcasts.apple.com", "youtube.com", "podchaser.com", "listennotes.com", "buzzsprout.com", "simplecast.com"],
    },
    {
      query: `"${name}" "${company}" interview keynote panel`,
      category: "media",
      domains: ["youtube.com", "techcrunch.com", "forbes.com", "inc.com", "wired.com", "saastr.com", "ycombinator.com"],
    },

    // Hiring signals
    {
      query: `"${company}" hiring jobs open roles`,
      category: "hiring",
      domains: ["lever.co", "greenhouse.io", "ashbyhq.com", "workable.com", "jobs.weekday.works", "wellfound.com", "linkedin.com"],
    },

    // Product & growth
    {
      query: `"${company}" product launch feature announcement`,
      category: "product",
      domains: ["producthunt.com", "techcrunch.com", "venturebeat.com", "businesswire.com", "prnewswire.com", "g2.com", "capterra.com"],
    },

    // Social & thought leadership
    {
      query: `"${name}" "${company}"`,
      category: "social",
      domains: ["twitter.com", "x.com", "threads.net", "news.ycombinator.com", "reddit.com"],
    },

    // Financial / analyst
    {
      query: `"${company}" revenue growth earnings`,
      category: "financial",
      domains: ["bloomberg.com", "wsj.com", "ft.com", "reuters.com", "seekingalpha.com", "fool.com"],
    },

    // Awards & recognition
    {
      query: `"${name}" award recognition list`,
      category: "awards",
      domains: ["forbes.com", "inc.com", "fastcompany.com", "fortune.com", "businessinsider.com"],
    },

    // Profile aggregators
    {
      query: `"${name}" "${company}" profile career background`,
      category: "profile",
      domains: ["crunchbase.com", "wellfound.com", "rocketreach.co", "apollo.io", "zoominfo.com", "clearbit.com", "clay.com"],
    },

    // Weekday & job intelligence
    {
      query: `"${company}" hiring team growth`,
      category: "hiring",
      domains: ["weekday.works", "jobs.weekday.works", "getpocket.com", "builtin.com", "builtinsf.com", "builtinnyc.com", "builtinboston.com", "builtinchicago.com", "builtinla.com", "builtinseattle.com", "builtinaustin.com", "builtincolorado.com"],
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
    queries.map(async ({ query, category, domains }) => {
      const results = await searchTavily(query, signal, domains);
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
