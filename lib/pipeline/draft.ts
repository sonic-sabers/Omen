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

function buildPublicSignal(signal: SelectedSignal): Pick<SelectedSignal, "summary" | "safety" | "sources"> {
  return {
    summary: signal.summary,
    safety: signal.safety,
    sources: signal.sources,
  };
}

function buildSensitiveFixtureDraft(
  salesContext: SalesContext,
  prospect?: Pick<Prospect, "name" | "company" | "title">,
): DraftOutput {
  const firstName = prospect?.name?.split(" ")[0] ?? "there";
  const roleContext = prospect?.title
    ? `${prospect.title} teams`
    : "outbound teams";
  const offering = salesContext.offering.toLowerCase();

  const companyCtx = prospect?.company ? ` at ${prospect.company}` : "";

  return {
    emailSubject: `A thought on how ${prospect?.company ?? "your team"} approaches outreach`,
    emailBody: sanitizeDraft([
      `Hi ${firstName},`,
      `Reaching out because there are some account-level changes${companyCtx} that look relevant to how your team prioritizes outreach. I won't get into the specifics here, but the short version is it looked like a moment worth flagging.`,
      `We help ${roleContext} with ${offering}, grounding outreach in real account context so reps spend time on accounts that are actually moving. Given what I'm seeing${companyCtx}, it seemed worth a conversation.`,
      "Would a 15-minute call this week work?",
    ].join("\n\n")),
    linkedinBody: sanitizeDraft(
      `Noticed some movement${companyCtx} that seemed relevant to how your team runs outreach. We help with ${offering}. Worth a quick call?`,
    ),
    warning: "Sensitive signal: do not reference layoffs or crisis directly.",
  };
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
      ...(signal.safety === "usable_but_do_not_mention"
        ? [
            "- CRITICAL: The signal is sensitive (layoffs, workforce reduction, crisis, or similar). Do NOT reference the event, the signal topic, or anything that hints at it. Write as if you are reaching out based on general business context only. No indirect references either.",
          ]
        : [
            "- If the signal is about layoffs or workforce reduction: do NOT reference it directly. Use neutral business context only.",
          ]),
      "- Never mention internal ranking, score, grade, selected signal, relevance reason, persona fit, or rubric language.",
      "",
      "STRUCTURE:",
      `- Para 1 (2-3 sentences): ${signal.safety === "usable_but_do_not_mention" ? "Signal is sensitive. Open with neutral business context for their role. Do NOT name, hint at, or allude to the signal event in any way." : "Open with the specific event, announcement, or trigger from the signal."}`,
      "- Para 2 (2-3 sentences): Explain what problem or opportunity this creates for them. Connect to SALES_CONTEXT offering concretely.",
      "- Para 3 (1-2 sentences): Soft CTA. No pressure.",
      "",
      "LENGTH:",
      "- Email subject: under 60 characters, no clickbait.",
      "- Email body: 3 paragraphs, 150-220 words total. Do NOT write fewer than 150 words.",
      "- LinkedIn message: 2-3 sentences, under 400 characters.",
      "",
      `PROSPECT: ${JSON.stringify({ name: prospect?.name, company: prospect?.company, title: prospect?.title })}`,
      `SIGNAL: ${JSON.stringify(buildPublicSignal(signal))}`,
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
  if (!mentionable) {
    return buildSensitiveFixtureDraft(salesContext, prospect);
  }

  const sanitized = sanitizeSummary(signal.summary);
  const firstName = prospect?.name?.split(" ")[0] ?? "there";
  const roleCtx = prospect?.title ? `for someone in your role` : `for your team`;
  const companyCtx = prospect?.company ? ` at ${prospect.company}` : "";
  const offering = salesContext.offering.toLowerCase();

  const body = [
    `Hi ${firstName},`,
    `Saw that ${sanitized}. That caught my attention${companyCtx} because it often signals a push to grow faster or enter new markets, which puts more pressure on finding and reaching the right buyers quickly.`,
    `We work with teams on ${offering}. Given what is happening${companyCtx}, it might be worth seeing if there is a fit ${roleCtx}.`,
    `Open to a 15-minute call this week?`,
  ].join("\n\n");

  const linkedin = `Saw that ${sanitized.toLowerCase()}. We help with ${offering} and thought the timing might be relevant${companyCtx}. Worth a quick chat?`;

  const subject = sanitized.length < 55
    ? sanitized
    : `Quick thought on the ${prospect?.company ?? "next"} opportunity`;

  return {
    emailSubject: subject,
    emailBody: sanitizeDraft(body),
    linkedinBody: sanitizeDraft(linkedin),
    warning: undefined,
  };
}
