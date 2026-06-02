import { DEFAULT_SALES_CONTEXT, SOURCE_BUDGETS } from "@/lib/config";
import type { PipelineEvent, ResearchDossier, RunInput } from "@/lib/types";
import { resolveProspect } from "@/lib/pipeline/resolve";
import { researchSignals } from "@/lib/pipeline/research";
import { extractCandidates } from "@/lib/pipeline/extract";
import {
  judgeCandidates,
  calculateConfidenceVerdict,
} from "@/lib/pipeline/judge";
import { buildDraft } from "@/lib/pipeline/draft";
import { reviewDraft } from "@/lib/pipeline/review";

export async function* runPipeline(
  input: RunInput,
  signal: AbortSignal,
): AsyncGenerator<PipelineEvent> {
  const salesContext = input.salesContext ?? DEFAULT_SALES_CONTEXT;
  const cancelled = () => signal.aborted;
  const startedAt = Date.now();
  const timedOut = () =>
    Date.now() - startedAt > SOURCE_BUDGETS.maxRunDurationMs;
  const shouldStop = () => cancelled() || timedOut();
  const stopReason = () =>
    cancelled()
      ? "Request cancelled by client."
      : "Run exceeded maximum duration. Please retry with narrower inputs.";

  if (shouldStop()) {
    yield { type: "error", message: stopReason() };
    yield { type: "done" };
    return;
  }

  // Stage 1: Resolve (R4 - Gate 1 identity resolution)
  yield { type: "stage", stage: "resolve", status: "running" };
  const resolution = resolveProspect(input.prospect);
  const resolved = resolution.prospect;

  // Gate 1: Block if identity confidence is too low
  if (resolution.confidence === "LOW") {
    yield {
      type: "stage",
      stage: "resolve",
      status: "error",
      note:
        resolution.gate1Note ||
        "Gate 1: Identity resolution failed. Provide company, title, or LinkedIn URL.",
    };
    yield {
      type: "error",
      message:
        "Gate 1 BLOCKED: Cannot resolve prospect identity. Add LinkedIn URL, title, or company details.",
    };
    yield { type: "done" };
    return;
  }

  yield {
    type: "stage",
    stage: "resolve",
    status: "complete",
    note:
      resolution.gate1Note || `Identity confidence: ${resolution.confidence}`,
  };

  if (shouldStop()) {
    yield { type: "error", message: stopReason() };
    yield { type: "done" };
    return;
  }

  // Stage 2: Research (R5 - Gate 2 insufficient signal)
  yield { type: "stage", stage: "research", status: "running" };
  const { sources, notes: researchNotes } = await researchSignals(
    input,
    signal,
  );

  // Gate 2: Branch to insufficient-signal if no sources found
  if (sources.length === 0) {
    yield {
      type: "stage",
      stage: "research",
      status: "error",
      note: "Gate 2: Insufficient signal - no sources found",
    };

    const dossier: ResearchDossier = {
      prospect: resolved,
      salesContext,
      selectedSignal: undefined,
      rankedSignals: [],
      rejectedAlternatives: [],
      riskFlags: resolved.warnings,
      draft: undefined,
      fallbackNotes: [
        ...researchNotes,
        "Gate 2: Insufficient signal - no sources found",
      ],
    };

    yield { type: "dossier", dossier };
    yield {
      type: "error",
      message:
        "Gate 2 SKIP: No signals found for this prospect. Try different search terms or verify prospect details.",
    };
    yield { type: "done" };
    return;
  }

  yield {
    type: "stage",
    stage: "research",
    status: "complete",
    note: researchNotes.join(" | ") || `Found ${sources.length} sources`,
  };

  // Stage 3: Extract (R6 - structured signal extraction)
  yield { type: "stage", stage: "extract", status: "running" };
  const candidates = await extractCandidates(sources, input.mode, resolved);

  // Drop noise: filter out candidates with wrong person, stale, or irrelevant
  const validCandidates = input.mode === "fixture"
    ? candidates
    : candidates.filter((c) => {
        const text = c.summary.toLowerCase();
        // Drop if clearly wrong person (unverified, rumor)
        if (text.includes("unverified") || text.includes("rumor")) return false;
        return true;
      });

  // Track signal types for metrics (person vs company specificity)
  const signalTypes = validCandidates.map((c) => {
    const text = c.summary.toLowerCase();
    if (
      text.includes("executive") ||
      text.includes("appointed") ||
      text.includes("hired") ||
      text.includes("joined") ||
      text.includes("promoted") ||
      text.includes("ceo") ||
      text.includes("cto") ||
      text.includes("cfo") ||
      text.includes("vp ")
    ) {
      return { signalType: "person" as const };
    }
    return { signalType: "company" as const };
  });

  yield {
    type: "stage",
    stage: "extract",
    status: "complete",
    note: `Extracted ${validCandidates.length} valid signal(s) from ${candidates.length} candidate(s).`,
  };

  // Stage 4: Judge (R7 - scoring with safety veto)
  yield { type: "stage", stage: "judge", status: "running" };
  const judged = await judgeCandidates(validCandidates, resolved);
  yield {
    type: "stage",
    stage: "judge",
    status: "complete",
    note: judged.selectedSignal
      ? `Selected signal: ${judged.selectedSignal.score}/30 (${judged.selectedSignal.grade})`
      : "No safe signal selected",
  };

  // Stage 5: Draft (R8 - confidence verdict gating)
  yield { type: "stage", stage: "draft", status: "running" };

  // Calculate final confidence verdict
  const confidenceTier = calculateConfidenceVerdict(
    resolution.confidence,
    sources.length,
    judged.selectedSignal,
    judged.riskFlags.length,
  );

  // Gate 3: Balanced strictness - only draft for HIGH/MEDIUM
  let rawDraft = undefined;
  if (confidenceTier === "HIGH" || confidenceTier === "MEDIUM") {
    rawDraft = await buildDraft(judged.selectedSignal, salesContext, input.mode, resolved);
  }

  yield {
    type: "stage",
    stage: "draft",
    status: "complete",
    note: rawDraft
      ? `Draft generated. Confidence: ${confidenceTier}`
      : confidenceTier === "SKIP"
        ? `Gate 3 SKIP: Confidence too low (${confidenceTier})`
        : "No draft generated",
  };

  // Stage 6: Review (self-improving loop, bounded by review config)
  yield { type: "stage", stage: "review", status: "running" };
  let draft = rawDraft;
  if (rawDraft && judged.selectedSignal) {
    draft = await reviewDraft(rawDraft, judged.selectedSignal, resolved, salesContext, input.mode);
  }
  yield {
    type: "stage",
    stage: "review",
    status: draft && draft.reviewPassed === false ? "error" : "complete",
    note: draft
      ? draft.reviewPassed === false
        ? `Draft did not pass review after ${draft.reviewAttempts ?? 0} attempt(s) — best effort used`
        : `Draft passed review in ${draft.reviewAttempts ?? 0} attempt(s)`
      : "No draft to review",
  };

  const dossier: ResearchDossier = {
    prospect: resolved,
    salesContext,
    selectedSignal: judged.selectedSignal,
    rankedSignals: judged.rankedSignals,
    rejectedAlternatives: judged.rejectedAlternatives,
    riskFlags: [
      ...resolved.warnings,
      ...judged.riskFlags,
      `Confidence tier: ${confidenceTier}`,
    ],
    draft,
    fallbackNotes: [
      ...researchNotes,
      ...judged.fallbackNotes,
      `Final confidence: ${confidenceTier}`,
    ],
    researchSources: sources,
  };

  yield { type: "dossier", dossier };

  // Yield metrics for tracking (signal types, confidence, etc.)
  yield {
    type: "metrics",
    signalTypes,
    confidenceTier,
    durationMs: Date.now() - startedAt,
  };

  // Final gate message
  if (confidenceTier === "SKIP") {
    yield {
      type: "error",
      message: `Gate 3 SKIP: Confidence verdict is ${confidenceTier}. ${judged.selectedSignal ? "Signal scored below threshold." : "No usable signal found."}`,
    };
  }

  yield { type: "done" };
}
