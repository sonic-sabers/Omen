import type { Prospect, ResolvedProspect } from "@/lib/types";

export type IdentityConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ResolutionResult {
  prospect: ResolvedProspect;
  confidence: IdentityConfidence;
  isAmbiguous: boolean;
  gate1Note?: string;
}

const COMMON_NAMES = new Set([
  "john smith",
  "jane smith",
  "michael smith",
  "david smith",
  "robert smith",
  "john johnson",
  "michael johnson",
  "david johnson",
  "robert johnson",
  "james smith",
  "william smith",
  "mary smith",
  "jennifer smith",
  "john brown",
  "michael brown",
  "david brown",
  "john williams",
  "chris",
  "alex",
  "jordan",
  "taylor",
  "morgan",
  "casey",
  "jamie",
]);

function isCommonName(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  const firstName = normalized.split(" ")[0];
  return COMMON_NAMES.has(normalized) || COMMON_NAMES.has(firstName);
}

function calculateIdentityConfidence(prospect: Prospect): IdentityConfidence {
  const hasCompany = !!prospect.company?.trim();
  const hasTitle = !!prospect.title?.trim();
  const hasLinkedIn = !!prospect.linkedinUrl?.trim();
  const hasLocation = !!prospect.location?.trim();
  const nameParts = prospect.name?.trim().split(" ").length || 0;

  // HIGH: Full name + company + at least one disambiguator (title/LinkedIn/location)
  if (
    nameParts >= 2 &&
    hasCompany &&
    (hasTitle || hasLinkedIn || hasLocation)
  ) {
    if (!isCommonName(prospect.name)) return "HIGH";
    if (hasLinkedIn) return "HIGH"; // LinkedIn URL resolves ambiguity
  }

  // MEDIUM: Name + company but missing disambiguators or common name
  if (nameParts >= 2 && hasCompany) return "MEDIUM";

  // LOW: Missing critical info or very ambiguous
  return "LOW";
}

export function resolveProspect(prospect: Prospect): ResolutionResult {
  const warnings: string[] = [];
  const normalized: ResolvedProspect = {
    ...prospect,
    name: prospect.name.trim(),
    company: prospect.company.trim(),
    title: prospect.title?.trim(),
    location: prospect.location?.trim(),
    linkedinUrl: prospect.linkedinUrl?.trim(),
    warnings,
  };

  const confidence = calculateIdentityConfidence(normalized);
  const isAmbiguous = isCommonName(normalized.name);

  // Gate 1: Identity resolution check
  if (isAmbiguous && !normalized.linkedinUrl) {
    warnings.push(
      "Gate 1: Common-name ambiguity detected. LinkedIn URL recommended for disambiguation.",
    );
  }

  if (confidence === "LOW") {
    warnings.push(
      "Gate 1: Low identity confidence. Provide company, title, or LinkedIn URL.",
    );
  }

  if (!normalized.title) {
    warnings.push("Missing title reduces persona-relevance scoring.");
  }

  let gate1Note: string | undefined;
  if (confidence === "LOW" || (isAmbiguous && !normalized.linkedinUrl)) {
    gate1Note = `Gate 1: Identity confidence ${confidence}${isAmbiguous ? " (ambiguous name)" : ""}`;
  }

  return {
    prospect: normalized,
    confidence,
    isAmbiguous,
    gate1Note,
  };
}
