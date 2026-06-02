import { askAnthropicJsonFast } from "@/lib/anthropic";
import { buildDraft } from "@/lib/pipeline/draft";
import { REVIEW_CONFIG } from "@/lib/config";
import { ReviewResponseSchema } from "@/lib/schemas";
import type { DraftOutput, Prospect, SalesContext, SelectedSignal } from "@/lib/types";

async function reviewOnce(
  draft: DraftOutput,
  signal: SelectedSignal,
  prospect: Prospect,
): Promise<{ pass: boolean; issues: string[] }> {
  const prompt = [
    "You are a strict quality reviewer for B2B sales outreach drafts.",
    "Check the DRAFT against the SIGNAL and PROSPECT. Return JSON only.",
    'Format: {"pass": true|false, "issues": ["issue1", "issue2"]}',
    "",
    "FAIL if ANY of these are true:",
    "1. Raw artifacts: ### markdown headers, bullet points, raw date ranges like 'Nov 2015 - Sep 2017', LinkedIn profile fragments",
    "2. Fabricated facts: claims not supported by SIGNAL sources",
    "3. Wrong person: wrong name or company referenced",
    "4. Broken structure: fewer than 3 paragraphs, missing CTA, body under 100 words",
    "5. Tone violations: exclamation marks, em dashes (—), en dashes (–), jargon (synergy, leverage, scalable, paradigm, game-changer)",
    "6. Generic opener: Para 1 does not name the actual signal event from SIGNAL",
    "",
    `PROSPECT: ${JSON.stringify({ name: prospect.name, company: prospect.company, title: prospect.title })}`,
    `SIGNAL: ${JSON.stringify({ summary: signal.summary, sources: signal.sources.map(s => s.snippet) })}`,
    `DRAFT: ${JSON.stringify(draft)}`,
  ].join("\n");

  try {
    const llm = await askAnthropicJsonFast<unknown>(prompt, REVIEW_CONFIG.maxTokens);
    const parsed = ReviewResponseSchema.safeParse(llm);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return { pass: false, issues: ["Review call failed or returned invalid JSON"] };
}

export async function reviewDraft(
  draft: DraftOutput,
  signal: SelectedSignal,
  prospect: Prospect,
  salesContext: SalesContext,
  mode: "fixture" | "live",
  maxRetries: number = REVIEW_CONFIG.maxRetries,
): Promise<DraftOutput> {
  if (mode === "fixture") {
    return { ...draft, reviewAttempts: 0 };
  }

  let current = draft;
  let bestAttempt = draft;
  let bestIssueCount = Infinity;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const { pass, issues } = await reviewOnce(current, signal, prospect);

    if (issues.length < bestIssueCount) {
      bestIssueCount = issues.length;
      bestAttempt = { ...current, reviewAttempts: attempt };
    }

    if (pass) {
      return { ...current, reviewAttempts: attempt, reviewPassed: true };
    }

    if (attempt >= maxRetries) {
      break;
    }

    const retry = await buildDraft(
      signal,
      salesContext,
      "live",
      prospect,
      issues,
    );

    if (retry) {
      current = retry;
    }
  }

  return { ...bestAttempt, reviewAttempts: attempt, reviewPassed: false };
}
