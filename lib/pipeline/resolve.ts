import { RESOLVE_CONFIG } from "@/lib/config";
import type { Prospect, ResolvedProspect } from "@/lib/types";

export type IdentityConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ResolutionResult {
  prospect: ResolvedProspect;
  confidence: IdentityConfidence;
  isAmbiguous: boolean;
  gate1Note?: string;
}

function isAmbiguousName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  // Single-token name (no surname) is inherently ambiguous
  if (parts.length < RESOLVE_CONFIG.minNameParts) return true;
  // Very short full name (e.g. "Al Go") is likely ambiguous without a disambiguator
  if (name.trim().replace(/\s+/g, "").length <= 5) return true;
  return false;
}

function calculateIdentityConfidence(prospect: Prospect): IdentityConfidence {
  const hasCompany = !!prospect.company?.trim();
  const hasTitle = !!prospect.title?.trim();
  const hasLinkedIn = !!prospect.linkedinUrl?.trim();
  const hasLocation = !!prospect.location?.trim();
  const nameParts = prospect.name?.trim().split(" ").length || 0;

  // HIGH: Full name + company + at least one disambiguator (title/LinkedIn/location)
  if (
    nameParts >= RESOLVE_CONFIG.minNameParts &&
    hasCompany &&
    (hasTitle || hasLinkedIn || hasLocation)
  ) {
    if (!isAmbiguousName(prospect.name)) return "HIGH";
    if (hasLinkedIn) return "HIGH";
  }

  // MEDIUM: Name + company but missing disambiguators or common name
  if (nameParts >= RESOLVE_CONFIG.minNameParts && hasCompany) return "MEDIUM";

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
  const isAmbiguous = isAmbiguousName(normalized.name);

  // Gate 1: Identity resolution check
  if (isAmbiguous && !normalized.linkedinUrl) {
    warnings.push(
      "Gate 1: Ambiguous name (no surname or very short). LinkedIn URL recommended for disambiguation.",
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
