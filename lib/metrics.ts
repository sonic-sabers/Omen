import type {
  ResearchDossier,
  SignalCandidate,
  SelectedSignal,
} from "@/lib/types";

/**
 * Key Metrics for Omen Pipeline
 *
 * 1. Hook Specificity Rate - % of drafts about the person (vs generic/company)
 * 2. Grounding Fidelity - % of claims with real cited sources
 * 3. Honest Abstention Rate - % of thin-signal cases that correctly "skip"
 * 4. Time-to-Draft - seconds from prospect name to reviewed draft
 * 5. Reply Rate (North Star) - placeholder for future tracking
 */

export interface RunMetrics {
  // Core metrics
  hookSpecificityRate: number; // 0-100%
  groundingFidelity: number; // 0-100%
  honestAbstentionRate: number; // 0-100%
  timeToDraftMs: number;

  // Derived metrics
  signalCount: number;
  personSignalCount: number;
  companySignalCount: number;
  sourcesCount: number;
  claimsWithCitation: number;
  totalClaims: number;
  skipped: boolean;
  skipReason?: string;
}

/**
 * Calculate hook specificity rate
 * What % of signals are about the specific person vs company/generic
 */
export function calculateHookSpecificity(
  dossier: ResearchDossier,
  allSignals: { signalType?: "person" | "company" | "generic" }[],
): number {
  if (allSignals.length === 0) return 0;

  const personSignals = allSignals.filter(
    (s) =>
      s.signalType === "person" ||
      dossier.selectedSignal?.summary
        ?.toLowerCase()
        .includes(dossier.prospect.name.toLowerCase()),
  ).length;

  return Math.round((personSignals / allSignals.length) * 100);
}

/**
 * Calculate grounding fidelity
 * % of claims that trace to a real cited source
 *
 * Each signal should have at least one source citation
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "is",
  "was",
  "are",
  "were",
  "has",
  "have",
  "had",
  "it",
  "its",
  "that",
  "this",
  "be",
  "as",
]);

function significantWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/\b[a-z0-9$%]{3,}\b/g)
      ?.filter((w) => !STOP_WORDS.has(w)) ?? []
  );
}

export function calculateGroundingFidelity(
  selectedSignal: SelectedSignal | undefined,
  sourcesCount: number,
): number {
  if (!selectedSignal) return 0;

  const claims = selectedSignal.summary
    .split(/[.!?]+/)
    .filter((c) => c.trim().length > 10);
  const citedClaims = claims.filter((claim) => {
    const claimWords = new Set(significantWords(claim));
    if (claimWords.size === 0) return false;
    return selectedSignal.sources.some((source) => {
      const snippetWords = new Set(significantWords(source.snippet));
      const overlap = [...claimWords].filter((w) => snippetWords.has(w)).length;
      return overlap >= Math.min(3, Math.ceil(claimWords.size * 0.4));
    });
  });

  if (claims.length === 0) return 100;
  return Math.round((citedClaims.length / claims.length) * 100);
}

/**
 * Calculate honest abstention rate
 * Did we correctly skip when signal was thin?
 */
export function calculateHonestAbstention(
  confidenceTier: "HIGH" | "MEDIUM" | "SKIP",
  signalStrength: "strong" | "medium" | "thin",
  draftProduced: boolean,
): { rate: number; skipped: boolean; reason?: string } {
  // Should skip when signal is thin
  const shouldSkip = signalStrength === "thin" || confidenceTier === "SKIP";
  const didSkip = !draftProduced;

  if (shouldSkip && didSkip) {
    return {
      rate: 100,
      skipped: true,
      reason: "Correctly abstained on thin signal",
    };
  }
  if (!shouldSkip && !didSkip) {
    return {
      rate: 100,
      skipped: false,
      reason: "Correctly produced draft on strong signal",
    };
  }
  if (shouldSkip && !didSkip) {
    return {
      rate: 0,
      skipped: false,
      reason: "Failed to abstain - produced weak draft",
    };
  }
  // !shouldSkip && didSkip - false positive skip
  return {
    rate: 50,
    skipped: true,
    reason: "Overly conservative - skipped strong signal",
  };
}

/**
 * Determine signal strength based on various factors
 */
export function determineSignalStrength(
  selectedSignal: SelectedSignal | undefined,
  sourcesCount: number,
): "strong" | "medium" | "thin" {
  if (!selectedSignal) return "thin";

  const score = selectedSignal.score;
  const grade = selectedSignal.grade;

  // Strong: A grade with high score and multiple sources
  if (grade === "A" && score >= 20 && sourcesCount >= 3) return "strong";

  // Medium: B grade or decent score
  if ((grade === "B" || grade === "A") && score >= 15) return "medium";

  // Thin: C/D grade or low score or few sources
  return "thin";
}

/**
 * Compile all metrics for a run
 */
export function compileMetrics(
  dossier: ResearchDossier,
  durationMs: number,
  confidenceTier: "HIGH" | "MEDIUM" | "SKIP",
  allSignalTypes: { signalType?: "person" | "company" | "generic" }[],
): RunMetrics {
  const sourcesCount = dossier.selectedSignal?.sources.length || 0;
  const signalStrength = determineSignalStrength(
    dossier.selectedSignal,
    sourcesCount,
  );
  const abstention = calculateHonestAbstention(
    confidenceTier,
    signalStrength,
    Boolean(dossier.draft),
  );

  return {
    hookSpecificityRate: calculateHookSpecificity(dossier, allSignalTypes),
    groundingFidelity: calculateGroundingFidelity(
      dossier.selectedSignal,
      sourcesCount,
    ),
    honestAbstentionRate: abstention.rate,
    timeToDraftMs: durationMs,

    // Derived
    signalCount: allSignalTypes.length,
    personSignalCount: allSignalTypes.filter((s) => s.signalType === "person")
      .length,
    companySignalCount: allSignalTypes.filter((s) => s.signalType === "company")
      .length,
    sourcesCount,
    claimsWithCitation: Math.round(
      (calculateGroundingFidelity(dossier.selectedSignal, sourcesCount) / 100) *
        (dossier.selectedSignal?.summary.split(/[.!?]+/).length || 0),
    ),
    totalClaims: dossier.selectedSignal?.summary.split(/[.!?]+/).length || 0,
    skipped: abstention.skipped,
    skipReason: abstention.reason,
  };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: RunMetrics) {
  return {
    hookSpecificity: `${metrics.hookSpecificityRate}%`,
    groundingFidelity: `${metrics.groundingFidelity}%`,
    honestAbstention: `${metrics.honestAbstentionRate}%`,
    timeToDraft: `${(metrics.timeToDraftMs / 1000).toFixed(1)}s`,
    signalBreakdown: `${metrics.personSignalCount} person / ${metrics.companySignalCount} company / ${metrics.signalCount} total`,
    sourcesUsed: metrics.sourcesCount,
    claimsCited: `${metrics.claimsWithCitation}/${metrics.totalClaims}`,
    status: metrics.skipped ? "SKIPPED" : "DRAFT",
  };
}
