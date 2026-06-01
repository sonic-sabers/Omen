import type { SalesContext } from "@/lib/types";

export const DEFAULT_SALES_CONTEXT: SalesContext = {
  sellerCompany: "Omen",
  offering: "AI-powered B2B sales intelligence and outreach automation",
  icp: "B2B SaaS companies with 20-500 employees",
  targetPersona: "VP Sales",
  painHypotheses: [
    "Low outbound reply rates",
    "Limited personalization at scale",
  ],
  proofPoints: [
    "Evidence-backed signal selection",
    "Human-reviewable outreach drafts",
  ],
  tone: "consultative",
};

export const SOURCE_BUDGETS = {
  maxSourcesPerRun: 20,
  maxSourceCharsForLLM: 12000,
  maxRunDurationMs: 58_000,
  tavilyTimeoutMs: 12_000,
} as const;

export const RANKING_CONFIG = {
  dimensions: {
    freshness: 0.17,
    specificity: 0.19,
    personaRelevance: 0.27,
    businessPainFit: 0.21,
    sourceCredibility: 0.09,
    mentionSafety: 0.07,
  },
  archetypeMultipliers: {
    T1: 2.0,
    T2: 1.5,
    T3: 1.0,
    T4: 0.75,
    T5: 0.5,
  },
  thresholds: {
    selectMinScore: 13,
    staleDays: 180,
    stalePenalty: 0.74,
    normalizedScale: 6,
  },
  gradeThresholds: {
    A: 24,
    B: 18,
    C: 12,
  },
} as const;
