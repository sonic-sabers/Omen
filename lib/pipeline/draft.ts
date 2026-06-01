import { askAnthropicJson } from "@/lib/anthropic";
import { DraftResponseSchema } from "@/lib/schemas";
import type { DraftOutput, SalesContext, SelectedSignal } from "@/lib/types";

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

export async function buildDraft(
  signal: SelectedSignal | undefined,
  salesContext: SalesContext,
  mode: "fixture" | "live",
): Promise<DraftOutput | undefined> {
  if (!signal) return undefined;

  if (mode === "live") {
    const prompt = [
      "Write short, human outreach copy. Return strict JSON only.",
      'Format: {"emailSubject":"...","emailBody":"...","linkedinBody":"..."}',
      "",
      "TONE RULES:",
      "- Write like a real person talking to another real person. Warm, direct, never stiff.",
      "- Short sentences. No filler. No buzzwords.",
      "- Never use em dashes (—) or en dashes (–). Use commas or full stops instead.",
      "- No exclamation marks.",
      "- Do not start the email with 'I'. Start with the recipient's context.",
      "- Do not use: synergy, leverage, scalable, ecosystem, paradigm, circle back, deep dive, bandwidth, touch base, move the needle, game-changer, cutting-edge, best-in-class, world-class, revolutionary, disruptive.",
      "",
      "CONTENT RULES:",
      "- Ground every claim in the SIGNAL below. Do not invent facts.",
      "- Do not comment on the person's appearance, age, gender, ethnicity, religion, politics, or personal life.",
      "- Do not make assumptions about the person beyond what the signal states.",
      "- No pressure tactics, urgency manipulation, or guilt-tripping.",
      "- No NSFW, offensive, or sensitive personal content.",
      "- If the signal is about layoffs or workforce reduction: do NOT reference it directly. Acknowledge the company is in a period of change, nothing more.",
      "",
      "LENGTH:",
      "- Email subject: under 60 characters, no clickbait.",
      "- Email body: 3 short paragraphs, under 120 words total.",
      "- LinkedIn message: 1-2 sentences, under 300 characters.",
      "",
      `SIGNAL: ${JSON.stringify(signal)}`,
      `SALES_CONTEXT: ${JSON.stringify(salesContext)}`,
    ].join("\n");
    const llm = await askAnthropicJson<unknown>(prompt);
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

  const safeLine =
    signal.safety === "mentionable"
      ? signal.summary
      : "your team is going through a period of change and timing can matter.";

  const body = [
    `Hi there,`,
    `Reached out because ${safeLine}.`,
    `We help teams like yours with ${salesContext.offering.toLowerCase()}. The focus is on grounding outreach in real signals so messages land at the right moment.`,
    `Worth a quick chat to see if there's a fit?`,
  ].join("\n\n");

  const linkedin =
    signal.safety === "mentionable"
      ? `Noticed some recent momentum at your team. We help with ${salesContext.offering.toLowerCase()}. Open to a brief exchange?`
      : `Your team's context caught my eye. We help with ${salesContext.offering.toLowerCase()}. Open to a quick chat?`;

  return {
    emailSubject: "A thought on better outreach timing",
    emailBody: sanitizeDraft(body),
    linkedinBody: sanitizeDraft(linkedin),
    warning:
      signal.safety === "usable_but_do_not_mention"
        ? "Sensitive signal: do not reference layoffs or crisis directly."
        : undefined,
  };
}
