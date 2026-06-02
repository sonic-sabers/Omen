import type { RawSource, RunInput } from "@/lib/types";

export const FIXTURE_IDS = [
  "funding-success",
  "ambiguous-namesake",
  "stale-conflict",
  "layoffs-sensitive",
  "no-signal",
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

function nowIso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

const FIXTURE_SOURCES: Record<FixtureId, RawSource[]> = {
  "funding-success": [
    {
      sourceName: "TechCrunch",
      url: "https://example.com/funding",
      publishedAt: nowIso(5),
      snippet: "Acme closed a $25M Series B to expand enterprise sales operations.",
    },
    {
      sourceName: "Company Blog",
      url: "https://example.com/hiring",
      publishedAt: nowIso(3),
      snippet: "Acme is hiring 12 new account executives across North America.",
    },
  ],
  "ambiguous-namesake": [
    {
      sourceName: "Regional News",
      url: "https://example.com/other-jane",
      publishedAt: nowIso(7),
      snippet: "Jane Smith at a different Acme in the UK was appointed VP Sales after leading regional growth.",
    },
  ],
  "stale-conflict": [
    {
      sourceName: "Press",
      url: "https://example.com/old-launch",
      publishedAt: nowIso(280),
      snippet: "Acme announced a product launch last year.",
    },
    {
      sourceName: "Forum",
      url: "https://example.com/unverified",
      publishedAt: nowIso(1),
      snippet: "Unverified claim that Acme announced a product pause amid internal conflict.",
    },
  ],
  "layoffs-sensitive": [
    {
      sourceName: "Reuters",
      url: "https://example.com/layoffs",
      publishedAt: nowIso(9),
      snippet: "Acme announced a 15% workforce reduction amid restructuring.",
    },
  ],
  "no-signal": [],
};

export function getFixtureSources(fixtureId?: string): RawSource[] {
  const key = (fixtureId ?? "funding-success") as FixtureId;
  return [...(FIXTURE_SOURCES[key] ?? FIXTURE_SOURCES["funding-success"])];
}

export function resolveFixtureId(input: RunInput): FixtureId {
  if (!input.fixtureId) return "funding-success";
  return FIXTURE_IDS.includes(input.fixtureId as FixtureId)
    ? (input.fixtureId as FixtureId)
    : "funding-success";
}
