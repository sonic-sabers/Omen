import { describe, expect, it } from "vitest";
import { judgeCandidates } from "@/lib/pipeline/judge";
import type { Prospect, SignalCandidate } from "@/lib/types";

const prospect: Prospect = { name: "Jane Doe", company: "Acme", title: "VP Sales" };

function candidate(summary: string, daysAgo: number, sourceName = "TechCrunch"): SignalCandidate {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    summary,
    sources: [{ sourceName, url: "https://example.com", publishedAt: d.toISOString(), snippet: summary }],
  };
}

describe("ranking calibration", () => {
  it("prioritizes high-intent funding over low-intent personal content", async () => {
    const funding = candidate("Acme raised $30M Series B and hired a new CFO", 5);
    const podcast = candidate("VP appeared on a podcast discussing leadership style", 2, "Company Blog");
    const result = await judgeCandidates([podcast, funding], prospect, "fixture");

    expect(result.rankedSignals[0]?.summary).toContain("raised $30M");
  });

  it("penalizes stale signals even if they have strong keywords", async () => {
    const staleFunding = candidate("Acme raised $40M Series B", 300);
    const freshHiring = candidate("Acme is hiring 20 enterprise AEs", 7, "Reuters");
    const result = await judgeCandidates([staleFunding, freshHiring], prospect, "fixture");

    expect(result.rankedSignals[0]?.summary).toContain("hiring 20");
  });

  it("keeps disqualifying rumors from being selected", async () => {
    const rumor = candidate("Unverified rumor of fraud and litigation at Acme", 1, "Forum");
    const safer = candidate("Acme announced GTM expansion and regional hiring", 12, "Reuters");
    const result = await judgeCandidates([rumor, safer], prospect, "fixture");

    expect(result.selectedSignal?.summary).toContain("GTM expansion");
    expect(result.riskFlags.some((f) => f.toLowerCase().includes("disqualifying"))).toBe(true);
  });
});

