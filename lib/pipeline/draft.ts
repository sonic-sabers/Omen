import { askAnthropicJson } from "@/lib/anthropic";
import { DraftResponseSchema } from "@/lib/schemas";
import type { DraftOutput, Prospect, SalesContext, SelectedSignal } from "@/lib/types";

const EM_DASH_RE = /\s*—\s*/g;
const EN_DASH_RE = /\s*–\s*/g;
const JARGON_RE = /\b(synergy|leverage[sd]?|scalable|ecosystem|paradigm|circle back|deep dive|bandwidth|touch base|move the needle|game.changer|cutting.edge|best.in.class|world.class|revolutionary|disruptive)\b/gi;
const EXCLAMATION_RE = /!/g;

function sanitizeDraft(text: string): string {
  return text
    .replace(EM_DASH_RE, ", ")
    .replace(EN_DASH_RE, ", ")
    .replace(EXCLAMATION_RE, ".")
    .replace(JARGON_RE, (match) => {
      const replacements: Record<string, string> = {
        synergy: "alignment", leverage: "use", leveraged: "used", leverages: "uses",
        scalable: "flexible", ecosystem: "platform", paradigm: "approach",
        "circle back": "follow up", "deep dive": "look closely", bandwidth: "capacity",
        "touch base": "connect", "move the needle": "make a difference",
        "game-changer": "big shift", "game changer": "big shift",
        "cutting-edge": "modern", "cutting edge": "modern",
        "best-in-class": "strong", "best in class": "strong",
        "world-class": "strong", "world class": "strong",
        revolutionary: "new", disruptive: "new",
      };
      return replacements[match.toLowerCase()] ?? match;
    })
    .trim();
}

function sanitizeSummary(summary: string): string {
  return summary
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\b[A-Za-z]+ \d{4}\s*[-–—]\s*([A-Za-z]+ \d{4}|Present)\b/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

export async function buildDraft(
  signal: SelectedSignal | undefined,
  salesContext: SalesContext,
  mode: "fixture" | "live",
  prospect?: Pick<Prospect, "name" | "company" | "title">,
  reviewIssues?: string[],
  timeoutMs?: number,
): Promise<DraftOutput | undefined> {
  if (!signal) return undefined;

  if (mode === "live") {
    const firstName = prospect?.name?.split(" ")[0] ?? "there";
    const prompt = [
      "Write short, human outreach copy. Return strict JSON only.",
      'Format: {"emailSubject":"...","emailBody":"...","linkedinBody":"..."}',
      "",
      "TONE RULES:",
      "- Write like a real person talking to another real person. Warm, direct, never stiff.",
      "- Short sentences. No filler. No buzzwords.",
      "- Never use em dashes (—) or en dashes (–). Use commas or full stops instead.",
      "- No exclamation marks.",
      `- Address the recipient by their first name: ${firstName}.`,
      "- Do not start the email with 'I'. Start with the recipient's context.",
      "- Do not use: synergy, leverage, scalable, ecosystem, paradigm, circle back, deep dive, bandwidth, touch base, move the needle, game-changer, cutting-edge, best-in-class, world-class, revolutionary, disruptive.",
      "",
      "CONTENT RULES:",
      "- Ground every claim in the SIGNAL below. Do not invent facts.",
      "- Reference the prospect's company and role naturally where relevant.",
      "- Do not comment on the person's appearance, age, gender, ethnicity, religion, politics, or personal life.",
      "- Do not make assumptions about the person beyond what the signal states.",
      "- No pressure tactics, urgency manipulation, or guilt-tripping.",
      "- No NSFW, offensive, or sensitive personal content.",
      "- If the signal is about layoffs or workforce reduction: do NOT reference it directly. Acknowledge the company is in a period of change, nothing more.",
      "",
      "STRUCTURE:",
      "- Para 1 (2-3 sentences): Open with the specific signal — name the actual event, announcement, or trigger. Make it clear you did real research.",
      "- Para 2 (2-3 sentences): Explain what problem or opportunity this creates for them. Connect to SALES_CONTEXT offering concretely.",
      "- Para 3 (1-2 sentences): Soft CTA. No pressure.",
      "",
      "LENGTH:",
      "- Email subject: under 60 characters, no clickbait.",
      "- Email body: 3 paragraphs, 150-220 words total. Do NOT write fewer than 150 words.",
      "- LinkedIn message: 2-3 sentences, under 400 characters.",
      "",
      `PROSPECT: ${JSON.stringify({ name: prospect?.name, company: prospect?.company, title: prospect?.title })}`,
      `SIGNAL: ${JSON.stringify(signal)}`,
      `SALES_CONTEXT: ${JSON.stringify(salesContext)}`,
      ...(reviewIssues?.length
        ? ["", "REVISION REQUIRED. Fix ALL of the following issues from the previous attempt:", ...reviewIssues.map(i => `- ${i}`)]
        : []),
    ].join("\n");
    const llm = await askAnthropicJson<unknown>(prompt, { timeoutMs });
    const parsed = DraftResponseSchema.safeParse(llm);
    if (parsed.success) {
      const cleaned = {
        emailSubject: sanitizeDraft(parsed.data.emailSubject).slice(0, 140),
        emailBody: sanitizeDraft(parsed.data.emailBody).slice(0, 1600),
        linkedinBody: sanitizeDraft(parsed.data.linkedinBody).slice(0, 500),
      };
      return {
        ...cleaned,
        warning:
          signal.safety === "usable_but_do_not_mention"
            ? "Sensitive signal: do not reference layoffs or crisis directly."
            : undefined,
      };
    }
  }

  const mentionable = signal.safety === "mentionable";
  const sanitized = sanitizeSummary(signal.summary);
  const signalLine = mentionable
    ? sanitized
    : "your team is navigating a period of change";
  const relevanceLine = signal.relevanceReason
    ? signal.relevanceReason
    : `That kind of shift often means teams are rethinking how they find and engage the right buyers.`;
  const firstName = prospect?.name?.split(" ")[0] ?? "there";

  const body = [
    `Hi ${firstName},`,
    `Reached out because ${signalLine}. ${relevanceLine}`,
    `We help teams like yours with ${salesContext.offering.toLowerCase()}. The idea is to ground outreach in real, timely signals so your messages reach people at the right moment, not just on a generic cadence.`,
    `Would it make sense to connect for 15 minutes to see if there is a fit?`,
  ].join("\n\n");

  const linkedin = mentionable
    ? `Noticed ${sanitized.toLowerCase()}. We help with ${salesContext.offering.toLowerCase()} and thought there might be a connection. Open to a brief exchange?`
    : `Saw some interesting momentum at your team. We help with ${salesContext.offering.toLowerCase()}. Worth a quick chat?`;

  const subject = mentionable && sanitized.length < 55
    ? sanitized
    : "A thought on your outreach timing";

  return {
    emailSubject: subject,
    emailBody: sanitizeDraft(body),
    linkedinBody: sanitizeDraft(linkedin),
    warning:
      signal.safety === "usable_but_do_not_mention"
        ? "Sensitive signal: do not reference layoffs or crisis directly."
        : undefined,
  };
}
