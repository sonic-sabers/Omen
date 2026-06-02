import { describe, expect, it, vi } from "vitest";
import type { DraftOutput, SelectedSignal, SalesContext, Prospect } from "@/lib/types";

vi.mock("@/lib/anthropic", () => ({
  askAnthropicJson: vi.fn(),
}));

vi.mock("@/lib/pipeline/draft", () => ({
  buildDraft: vi.fn(),
}));

import { askAnthropicJson } from "@/lib/anthropic";
import { buildDraft } from "@/lib/pipeline/draft";
import { reviewDraft } from "@/lib/pipeline/review";

const mockDraft: DraftOutput = {
  emailSubject: "Quick note on Cignara",
  emailBody: "Hi Ashish,\n\nCignara recently expanded their engineering team.\n\nWe help teams like yours with AI-powered sales intelligence.\n\nWould it make sense to connect for 15 minutes?",
  linkedinBody: "Noticed Cignara is growing. We help with sales intelligence. Open to a chat?",
};

const mockSignal: SelectedSignal = {
  summary: "Cignara recently expanded their engineering team with 5 new hires",
  relevanceReason: "Growth signals buying intent",
  personaFitReason: "Fits VP Sales persona",
  safety: "mentionable",
  sources: [{ sourceName: "LinkedIn", url: "https://example.com", snippet: "Cignara hired 5 engineers", publishedAt: undefined }],
  score: 22,
  grade: "A",
};

const mockProspect: Prospect = { name: "Ashish Gupta", company: "Cignara", title: "Founding Engineer" };

const mockSalesContext: SalesContext = {
  sellerCompany: "Omen",
  offering: "AI-powered B2B sales intelligence and outreach automation",
  icp: "B2B SaaS companies with 20-500 employees",
  targetPersona: "VP Sales",
  painHypotheses: ["Low outbound reply rates"],
  proofPoints: ["Evidence-backed signal selection"],
  tone: "consultative",
};

describe("reviewDraft", () => {
  it("returns draft unchanged when review passes on first attempt", async () => {
    vi.mocked(askAnthropicJson).mockResolvedValueOnce({ pass: true, issues: [] });
    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live");
    expect(result.emailBody).toBe(mockDraft.emailBody);
    expect(result.reviewAttempts).toBe(1);
    expect(buildDraft).not.toHaveBeenCalled();
  });

  it("returns draft in fixture mode without calling LLM", async () => {
    vi.mocked(askAnthropicJson).mockClear();
    vi.mocked(buildDraft).mockClear();
    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "fixture");
    expect(askAnthropicJson).not.toHaveBeenCalled();
    expect(buildDraft).not.toHaveBeenCalled();
    expect(result.reviewAttempts).toBe(0);
  });

  it("retries and returns passing draft after one failure", async () => {
    const improvedDraft: DraftOutput = {
      ...mockDraft,
      emailBody: "Hi Ashish,\n\nCignara hired 5 engineers.\n\nWe help with AI-powered sales intelligence.\n\nWorth a quick chat?",
    };
    vi.mocked(askAnthropicJson)
      .mockResolvedValueOnce({ pass: false, issues: ["Para 1 does not reference the actual signal event"] })
      .mockResolvedValueOnce({ pass: true, issues: [] });
    vi.mocked(buildDraft).mockResolvedValueOnce(improvedDraft);

    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live", 5);
    expect(result.reviewAttempts).toBe(2);
    expect(buildDraft).toHaveBeenCalledTimes(1);
  });

  it("returns best attempt after maxRetries exhausted", async () => {
    vi.mocked(askAnthropicJson).mockResolvedValue({ pass: false, issues: ["issue"] });
    vi.mocked(buildDraft).mockResolvedValue(mockDraft);
    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live", 2);
    expect(result).toBeDefined();
    expect(result.reviewAttempts).toBe(2);
  });

  it("preserves current draft when buildDraft returns undefined on retry", async () => {
    vi.mocked(askAnthropicJson)
      .mockResolvedValueOnce({ pass: false, issues: ["issue"] })
      .mockResolvedValueOnce({ pass: false, issues: ["issue"] });
    vi.mocked(buildDraft).mockResolvedValueOnce(undefined);

    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live", 2);
    expect(result.emailBody).toBe(mockDraft.emailBody);
    expect(result.reviewAttempts).toBe(2);
  });

  it("skips buildDraft when maxRetries is 1 and review fails", async () => {
    vi.mocked(askAnthropicJson).mockResolvedValueOnce({ pass: false, issues: ["issue"] });
    vi.mocked(buildDraft).mockClear();

    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live", 1);
    expect(result.reviewAttempts).toBe(1);
    expect(buildDraft).not.toHaveBeenCalled();
  });

  it("selects best attempt with fewest issues when all retries fail", async () => {
    const betterDraft: DraftOutput = { ...mockDraft, emailSubject: "better" };
    vi.mocked(askAnthropicJson)
      .mockResolvedValueOnce({ pass: false, issues: ["issue1", "issue2", "issue3"] })
      .mockResolvedValueOnce({ pass: false, issues: ["issue1"] });
    vi.mocked(buildDraft).mockResolvedValueOnce(betterDraft);

    const result = await reviewDraft(mockDraft, mockSignal, mockProspect, mockSalesContext, "live", 2);
    expect(result.emailSubject).toBe("better");
    expect(result.reviewAttempts).toBe(2);
  });
});
