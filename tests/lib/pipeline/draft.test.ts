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

function makeSignal(
  summary: string,
  overrides: Partial<SelectedSignal> = {},
): SelectedSignal {
  return {
    summary,
    relevanceReason: "Relevant signal",
    personaFitReason: "Fits persona",
    safety: "mentionable",
    sources: [{ sourceName: "LinkedIn", url: "https://example.com", snippet: summary, publishedAt: undefined }],
    score: 20,
    grade: "B",
    ...overrides,
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
    expect(draft!.emailSubject).toBe("Quick thought for your team");
  });

  it("does not expose internal ranking metadata in fixture emailBody", async () => {
    const signal = makeSignal("Acme announced a new enterprise sales motion", {
      relevanceReason: "Selected as top-ranked signal (20/30, grade B).",
    });
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailBody).not.toContain("Selected as top-ranked signal");
    expect(draft!.emailBody).not.toContain("20/30");
    expect(draft!.emailBody).not.toContain("grade B");
  });

  it("does not mention sensitive layoff details in fixture copy", async () => {
    const signal = makeSignal("Acme announced a 15% workforce reduction amid restructuring.", {
      relevanceReason: "Selected as top-ranked signal (20/30, grade B).",
      safety: "usable_but_do_not_mention",
    });
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailSubject).toBe("Quick thought on outbound timing");
    expect(draft!.emailBody).not.toMatch(/layoff|workforce reduction|restructuring|selected as|20\/30|grade B/i);
    expect(draft!.linkedinBody).not.toMatch(/layoff|workforce reduction|restructuring|selected as|20\/30|grade B/i);
    expect(draft!.emailBody).not.toContain("I had a thought about your team's outreach timing");
    expect(draft!.emailBody).not.toContain("buying signals without adding noise");
    expect(draft!.emailBody).toContain("only safe context into outreach");
    expect(draft!.warning).toBe("Sensitive signal: do not reference layoffs or crisis directly.");
  });

  it("writes clean sensitive fallback copy", async () => {
    const signal = makeSignal("Acme announced a 15% workforce reduction amid restructuring.", {
      safety: "usable_but_do_not_mention",
    });
    const draft = await buildDraft(signal, salesContext, "fixture", prospect);
    expect(draft!.emailBody).toContain(
      "For Founding Engineer teams, timing can be the difference between a useful note and another generic touchpoint.",
    );
    expect(draft!.emailBody).toContain(
      "Would it be worth a quick 15-minute conversation to compare how your team handles signal-based outreach today?",
    );
  });
});
