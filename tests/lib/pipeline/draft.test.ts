import { describe, expect, it } from "vitest";
import { buildDraft } from "@/lib/pipeline/draft";
import type { SelectedSignal, SalesContext } from "@/lib/types";

const salesContext: SalesContext = {
  sellerCompany: "Omen",
  offering: "AI-powered B2B sales intelligence and outreach automation",
  icp: "B2B SaaS companies with 20-500 employees",
  targetPersona: "VP Sales",
  painHypotheses: ["Low outbound reply rates"],
  proofPoints: ["Evidence-backed signal selection"],
  tone: "consultative",
};

function makeSignal(summary: string): SelectedSignal {
  return {
    summary,
    relevanceReason: "Relevant signal",
    personaFitReason: "Fits persona",
    safety: "mentionable",
    sources: [{ sourceName: "LinkedIn", url: "https://example.com", snippet: summary, publishedAt: undefined }],
    score: 20,
    grade: "B",
  };
}

const prospect = { name: "Ashish Gupta", company: "Cignara", title: "Founding Engineer" };

describe("buildDraft fallback sanitization", () => {
  it("strips markdown headers from emailBody", async () => {
    const signal = makeSignal("### EVP and Chief Marketing Officer\nInfoblox\nNov 2015 – Sep 2017\nSanta Clara, CA");
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft).toBeDefined();
    expect(draft!.emailBody).not.toContain("###");
    expect(draft!.emailBody).not.toContain("Nov 2015");
  });

  it("does not expose en-dash date ranges in emailBody", async () => {
    const signal = makeSignal("Chief Marketing Officer\nActian Corporation\nOct 2013 – Nov 2015");
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailBody).not.toMatch(/Oct 20\d\d/);
    expect(draft!.emailBody).not.toMatch(/Nov 20\d\d/);
  });

  it("strips em-dash date ranges from emailBody", async () => {
    const signal = makeSignal("VP Sales\nAcme Corp\nJan 2020 — Dec 2022");
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailBody).not.toMatch(/Jan 20\d\d/);
    expect(draft!.emailBody).not.toMatch(/Dec 20\d\d/);
  });

  it("strips markdown headers from linkedinBody", async () => {
    const signal = makeSignal("### Chief Revenue Officer\nBigCo\nMar 2021 – Present");
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.linkedinBody).not.toContain("###");
    expect(draft!.linkedinBody).not.toContain("Mar 2021");
  });

  it("uses safe fallback emailSubject when sanitized summary is long", async () => {
    const signal = makeSignal("A very long signal summary that definitely exceeds fifty-five characters total");
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailSubject).toBe("A thought on your outreach timing");
  });
});
