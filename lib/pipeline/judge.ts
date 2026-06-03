import { RANKING_CONFIG } from "@/lib/config";
import type {
  Prospect,
  RankedSignal,
  RejectedSignal,
  ScoreBreakdown,
  SelectedSignal,
  SignalCandidate,
  SafetyClassification,
} from "@/lib/types";

export interface JudgeResult {
  selectedSignal?: SelectedSignal;
  rankedSignals: RankedSignal[];
  rejectedAlternatives: RejectedSignal[];
  riskFlags: string[];
  fallbackNotes: string[];
}

export type ConfidenceTier = "HIGH" | "MEDIUM" | "SKIP";

/**
 * R8: Calculate confidence verdict based on:
 * - Identity confidence (from resolve)
 * - Source count (signal breadth)
 * - Signal quality (score + grade from selected signal)
 * - Risk flags count (safety issues)
 */
export function calculateConfidenceVerdict(
  identityConfidence: "HIGH" | "MEDIUM" | "LOW",
  sourceCount: number,
  selectedSignal: SelectedSignal | undefined,
  riskFlagCount: number,
): ConfidenceTier {
  // Base confidence from identity resolution
  let score = 0;
  if (identityConfidence === "HIGH") score += 3;
  else if (identityConfidence === "MEDIUM") score += 2;
  else score += 1;

  // Source breadth bonus
  if (sourceCount >= 10) score += 3;
  else if (sourceCount >= 5) score += 2;
  else if (sourceCount >= 3) score += 1;

  // Signal quality (if we have a selected signal)
  if (selectedSignal) {
    if (selectedSignal.grade === "A") score += 3;
    else if (selectedSignal.grade === "B") score += 2;
    else if (selectedSignal.grade === "C") score += 1;
    // D grade adds nothing

    // Score threshold bonus
    if (selectedSignal.score >= 25) score += 2;
    else if (selectedSignal.score >= 20) score += 1;
  }

  // Risk penalty
  if (riskFlagCount >= 2) score -= 2;
  else if (riskFlagCount >= 1) score -= 1;

  // Determine tier with balanced strictness
  if (
    score >= 7 &&
    selectedSignal?.grade &&
    ["A", "B"].includes(selectedSignal.grade)
  ) {
    return "HIGH";
  }
  if (score >= 5 && selectedSignal && selectedSignal.score >= 12) {
    return "MEDIUM";
  }
  return "SKIP";
}

type ArchetypeTier = "T1" | "T2" | "T3" | "T4" | "T5";

function daysOld(publishedAt?: string): number | null {
  if (!publishedAt) return null;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function gradeFromTotal(total: number): "A" | "B" | "C" | "D" {
  if (total >= RANKING_CONFIG.gradeThresholds.A) return "A";
  if (total >= RANKING_CONFIG.gradeThresholds.B) return "B";
  if (total >= RANKING_CONFIG.gradeThresholds.C) return "C";
  return "D";
}

function detectSafety(text: string): SafetyClassification {
  if (text.includes("unverified") || text.includes("rumor"))
    return "disqualifying";
  if (
    text.includes("different acme") ||
    text.includes("different company") ||
    text.includes("wrong person") ||
    text.includes("namesake")
  )
    return "disqualifying";
  if (
    text.includes("scandal") ||
    text.includes("litigation") ||
    text.includes("fraud")
  )
    return "disqualifying";
  if (
    text.includes("layoff") ||
    text.includes("workforce reduction") ||
    text.includes("restructuring")
  ) {
    return "usable_but_do_not_mention";
  }
  return "mentionable";
}

function detectArchetypeTier(text: string): ArchetypeTier {
  if (
    /\b(new cfo|new ceo|new coo|appointed|hired|joined as|series [a-e]|raised \$|funding round)\b/.test(
      text,
    )
  )
    return "T1";
  if (
    /\b(acquisition|acquired|merger|m&a|finance hiring|accounts payable hiring|ap hiring)\b/.test(
      text,
    )
  )
    return "T2";
  if (
    /\b(earnings|product launch|expansion|regulatory|press release|announced)\b/.test(
      text,
    )
  )
    return "T3";
  if (/\b(conference|summit|webinar|speaker)\b/.test(text)) return "T4";
  if (/\b(podcast|linkedin post|tweet|x post)\b/.test(text)) return "T5";
  return "T3";
}

function archetypeMultiplier(tier: ArchetypeTier): number {
  return RANKING_CONFIG.archetypeMultipliers[tier];
}

function scoreCandidate(
  candidate: SignalCandidate,
  prospect: Prospect,
): { safety: SafetyClassification; breakdown: ScoreBreakdown; total: number } {
  const joined =
    `${candidate.summary} ${candidate.sources.map((s) => s.snippet).join(" ")}`.toLowerCase();
  const sourceNames = candidate.sources
    .map((s) => s.sourceName.toLowerCase())
    .join(" ");
  const minAge = candidate.sources
    .map((s) => daysOld(s.publishedAt))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)[0];

  const freshness =
    minAge == null
      ? 2
      : minAge <= 14
        ? 5
        : minAge <= 45
          ? 4
          : minAge <= 90
            ? 3
            : minAge <= 180
              ? 2
              : 1;
  const specificity = clampScore(
    (/\$\d|series|hiring|launch|announced|%|\d+/.test(joined) ? 4 : 2) +
      (candidate.sources.length > 1 ? 1 : 0),
  );
  const personaRelevance = clampScore(
    (prospect.title &&
    joined.includes(prospect.title.toLowerCase().split(" ")[0])
      ? 3
      : 1) +
      (joined.includes("sales") ||
      joined.includes("go-to-market") ||
      joined.includes("revenue") ||
      joined.includes("finance")
        ? 2
        : 1),
  );
  const businessPainFit = clampScore(
    joined.includes("hiring") ||
      joined.includes("funding") ||
      joined.includes("acquisition") ||
      joined.includes("merger")
      ? 5
      : joined.includes("unverified")
        ? 1
        : 3,
  );
  const isCredible = RANKING_CONFIG.credibleSources.some((s) =>
    sourceNames.includes(s),
  );
  const isForum = RANKING_CONFIG.forumIndicators.some((s) =>
    sourceNames.includes(s),
  );
  const sourceCredibility = clampScore(
    isCredible ? 5 : joined.includes("unverified") || isForum ? 1 : 3,
  );

  const safety = detectSafety(joined);
  const mentionSafety =
    safety === "mentionable"
      ? 5
      : safety === "usable_but_do_not_mention"
        ? 2
        : 0;

  const breakdown: ScoreBreakdown = {
    freshness,
    specificity,
    personaRelevance,
    businessPainFit,
    sourceCredibility,
    mentionSafety,
  };

  const weightedBase =
    freshness * RANKING_CONFIG.dimensions.freshness +
    specificity * RANKING_CONFIG.dimensions.specificity +
    personaRelevance * RANKING_CONFIG.dimensions.personaRelevance +
    businessPainFit * RANKING_CONFIG.dimensions.businessPainFit +
    sourceCredibility * RANKING_CONFIG.dimensions.sourceCredibility +
    mentionSafety * RANKING_CONFIG.dimensions.mentionSafety;

  const tier = detectArchetypeTier(joined);
  const tierBoosted = weightedBase * archetypeMultiplier(tier);
  const stalePenalty =
    minAge != null && minAge > RANKING_CONFIG.thresholds.staleDays
      ? RANKING_CONFIG.thresholds.stalePenalty
      : 1;
  const total = Math.max(
    0,
    Math.min(
      30,
      Math.round(
        tierBoosted * stalePenalty * RANKING_CONFIG.thresholds.normalizedScale,
      ),
    ),
  );

  return {
    safety,
    breakdown,
    total,
  };
}

export async function judgeCandidates(
  candidates: SignalCandidate[],
  prospect: Prospect,
): Promise<JudgeResult> {
  if (candidates.length === 0) {
    return {
      selectedSignal: undefined,
      rankedSignals: [],
      rejectedAlternatives: [],
      riskFlags: [],
      fallbackNotes: [
        "No strong, specific public signal found. Draft withheld.",
      ],
    };
  }

  const rejectedAlternatives: RejectedSignal[] = [];
  const rankedSignals = candidates
    .map((candidate) => {
      const s = scoreCandidate(candidate, prospect);
      return {
        candidate,
        safety: s.safety,
        breakdown: s.breakdown,
        score: s.total,
        grade: gradeFromTotal(s.total),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({
      rank: idx + 1,
      summary: item.candidate.summary,
      score: item.score,
      grade: item.grade,
      safety: item.safety,
      breakdown: item.breakdown,
    }));

  const selectedRank = rankedSignals.find(
    (r) =>
      r.safety !== "disqualifying" &&
      r.score >= RANKING_CONFIG.thresholds.selectMinScore,
  );

  for (const r of rankedSignals) {
    if (r !== selectedRank) {
      const reason =
        r.safety === "disqualifying"
          ? `Rejected as unsafe or likely wrong-person/conflicting evidence (rank #${r.rank}, grade ${r.grade}).`
          : r.score < RANKING_CONFIG.thresholds.selectMinScore
            ? `Rejected because it scored below the outreach threshold (rank #${r.rank}, grade ${r.grade}).`
            : `Ranked #${r.rank} with grade ${r.grade}; lower priority.`;
      rejectedAlternatives.push({
        summary: r.summary,
        reason,
      });
    }
  }

  const riskFlags: string[] = [];
  if (selectedRank?.safety === "usable_but_do_not_mention") {
    riskFlags.push(
      "Sensitive context: use indirect wording and avoid explicit mention.",
    );
  }
  if (rankedSignals.some((r) => r.safety === "disqualifying")) {
    riskFlags.push("At least one disqualifying/risky signal was filtered out.");
  }

  if (!selectedRank) {
    return {
      selectedSignal: undefined,
      rankedSignals,
      rejectedAlternatives,
      riskFlags,
      fallbackNotes: [
        "All candidates scored below outreach threshold or were unsafe.",
      ],
    };
  }

  const chosenCandidate =
    candidates.find((c) => c.summary === selectedRank.summary) ?? candidates[0];

  const selectedSignal: SelectedSignal = {
    summary: selectedRank.summary,
    relevanceReason: `Selected as top-ranked signal (${selectedRank.score}/30, grade ${selectedRank.grade}).`,
    personaFitReason: `${prospect.company} context aligns with ${prospect.title ?? "target persona"} priorities based on rubric ranking.`,
    safety: selectedRank.safety,
    sources: chosenCandidate.sources,
    score: selectedRank.score,
    grade: selectedRank.grade,
  };

  return {
    selectedSignal,
    rankedSignals,
    rejectedAlternatives,
    riskFlags,
    fallbackNotes: [],
  };
}
