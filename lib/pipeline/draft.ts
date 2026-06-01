import { askAnthropicJson } from "@/lib/anthropic";
import { DraftResponseSchema } from "@/lib/schemas";
import type { DraftOutput, SalesContext, SelectedSignal } from "@/lib/types";

export async function buildDraft(
  signal: SelectedSignal | undefined,
  salesContext: SalesContext,
  mode: "fixture" | "live",
): Promise<DraftOutput | undefined> {
  if (!signal) return undefined;

  if (mode === "live") {
    const prompt = [
      "Create concise outreach copy in strict JSON.",
      "Return: {\"emailSubject\":\"...\",\"emailBody\":\"...\",\"linkedinBody\":\"...\"}",
      "Ground statements only in SIGNAL. Do not invent facts.",
      `SALES_CONTEXT: ${JSON.stringify(salesContext)}`,
      `SIGNAL: ${JSON.stringify(signal)}`,
    ].join("\n");
    const llm = await askAnthropicJson<unknown>(prompt);
    const parsed = DraftResponseSchema.safeParse(llm);
    if (parsed.success) {
      return {
        emailSubject: parsed.data.emailSubject.slice(0, 140),
        emailBody: parsed.data.emailBody.slice(0, 1600),
        linkedinBody: parsed.data.linkedinBody.slice(0, 500),
        warning:
          signal.safety === "usable_but_do_not_mention"
            ? "Sensitive signal detected. Do not reference layoffs/crisis directly in outreach."
            : undefined,
      };
    }
  }

  const safeLine =
    signal.safety === "mentionable"
      ? signal.summary
      : "I noticed your team is navigating meaningful change, and timing matters.";

  return {
    emailSubject: "Quick thought on improving outbound relevance",
    emailBody: [
      `Hi there,`,
      `I reached out because ${safeLine}`,
      `We help teams like yours with ${salesContext.offering.toLowerCase()} by grounding outreach in real buyer signals and safer personalization.`,
      `If useful, I can share a short teardown of where evidence-backed messaging can raise reply quality without adding rep overhead.`,
    ].join("\n\n"),
    linkedinBody:
      signal.safety === "mentionable"
        ? `Saw recent momentum at your team. We help revenue orgs personalize outbound using source-backed signals. Open to a brief exchange?`
        : `Your team context stood out. We help revenue orgs improve outbound relevance with evidence-backed personalization. Open to a quick exchange?`,
    warning:
      signal.safety === "usable_but_do_not_mention"
        ? "Sensitive signal detected. Do not reference layoffs/crisis directly in outreach."
        : undefined,
  };
}
