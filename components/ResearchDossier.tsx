"use client";

import { useState } from "react";
import type { ResearchDossier, EvidenceSource, ScoreBreakdown, RankedSignal } from "@/lib/types";
import { DraftCard } from "@/components/DraftCard";
import {
  ExternalLink, TrendingUp, AlertTriangle, FileSearch,
  XCircle, Mail, ChevronDown, Pin, BarChart2,
} from "lucide-react";

// ─── Icons ───────────────────────────────────────────────────────────────────

function LiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllSources(dossier: ResearchDossier): EvidenceSource[] {
  const sources = new Map<string, EvidenceSource>();
  dossier.selectedSignal?.sources.forEach((s) => sources.set(s.url, s));
  return Array.from(sources.values());
}

function isLinkedIn(url: string) {
  return url.includes("linkedin.com") || url.includes("lnkd.in");
}

function sourceAge(publishedAt?: string): string | null {
  if (!publishedAt) return null;
  const d = new Date(publishedAt);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 1) return "today";
  if (days <= 7) return `${days}d ago`;
  if (days <= 60) return `${Math.floor(days / 7)}w ago`;
  if (days <= 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function freshnessColor(publishedAt?: string): string {
  if (!publishedAt) return "text-muted-foreground/50";
  const days = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
  if (days <= 14) return "text-emerald-600";
  if (days <= 90) return "text-amber-600";
  return "text-red-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreChip({ score, small }: { score: number; small?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <span className={`cursor-help rounded bg-primary/10 font-semibold text-primary ${small ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[10px]"}`}>
        {score}/30
      </span>
      <span className="pointer-events-none absolute top-full right-0 z-[9999] mt-1.5 w-44 rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        Relevance score, higher is better (max 30)
        <span className="absolute bottom-full right-3 border-4 border-transparent border-b-gray-900" />
      </span>
    </span>
  );
}

/**
 * InterDeepResearch: "Transparency in reasoning" - show the rubric breakdown
 * so the user understands WHY this signal was scored the way it was.
 */
function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  const dims: { key: keyof ScoreBreakdown; label: string; description: string }[] = [
    { key: "personaRelevance",  label: "Persona fit",        description: "How relevant this is to the target's role and priorities" },
    { key: "businessPainFit",   label: "Business trigger",   description: "Strength as a buying trigger (funding, hiring, M&A = high)" },
    { key: "specificity",       label: "Specificity",        description: "Concrete numbers, names, or events vs. vague claims" },
    { key: "freshness",         label: "Freshness",          description: "How recently this happened (< 2 weeks = max score)" },
    { key: "sourceCredibility", label: "Source credibility", description: "Quality of the source (Reuters/TechCrunch = high)" },
    { key: "mentionSafety",     label: "Mention safety",     description: "Safe to reference directly in outreach?" },
  ];

  return (
    <div className="mt-2.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-1 mb-1">
        <BarChart2 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score breakdown</span>
      </div>
      {dims.map(({ key, label, description }) => {
        const val = breakdown[key];
        const pct = Math.round((val / 5) * 100);
        return (
          <div key={key} className="group/dim flex items-center gap-2">
            <span
              className="w-28 shrink-0 text-[10px] text-muted-foreground cursor-help"
              title={description}
            >
              {label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${val >= 4 ? "bg-emerald-500" : val >= 3 ? "bg-primary" : val >= 2 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${pct}%`, transitionDelay: `${dims.findIndex(d => d.key === key) * 60}ms` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[10px] font-medium text-muted-foreground">{val}/5</span>
          </div>
        );
      })}
    </div>
  );
}

function Section({
  icon, title, accent, collapsible, defaultOpen = true, children,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"} p-3`}>
      <div
        className={`flex items-center gap-1.5 ${collapsible ? "cursor-pointer select-none hover:opacity-80" : ""}`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        <span className="flex-1 text-xs font-semibold tracking-tight">{title}</span>
        {collapsible && (
          <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open || !collapsible ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * InterDeepResearch: "Steering mechanism" - user can pin a different signal
 * as the preferred one, overriding the agent's selection.
 */
function RankedSignalRow({
  signal,
  isSelected,
  isPinned,
}: {
  signal: RankedSignal;
  isSelected: boolean;
  isPinned: boolean;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div
      className={`group/row rounded-lg border transition-all cursor-pointer ${isSelected || isPinned ? "border-primary/30 bg-primary/5 shadow-sm" : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70 hover:shadow-sm"}`}
      onClick={() => setShowBreakdown((v) => !v)}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`text-[10px] font-bold shrink-0 ${isSelected || isPinned ? "text-primary" : "text-muted-foreground"}`}>
          #{signal.rank}
        </span>
        <div className="flex-1 min-w-0 leading-snug text-xs">{signal.summary}</div>
        <div className="flex shrink-0 items-center gap-2">
          <ScoreChip score={signal.score} small />
          <ChevronDown className={`h-3 w-3 shrink-0 transition-all duration-200 ${showBreakdown ? "rotate-180 text-primary" : "text-muted-foreground/40 group-hover/row:text-muted-foreground"}`} />
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showBreakdown ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-3 pb-3 pt-1">
          <ScoreBreakdownPanel breakdown={signal.breakdown} />
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ResearchDossierView({
  dossier,
  running = false,
}: {
  dossier: ResearchDossier;
  running?: boolean;
}) {
  const [pinnedSignalSummary, setPinnedSignalSummary] = useState<string | null>(null);
  const [showSelectedBreakdown, setShowSelectedBreakdown] = useState(false);

  const allSources = getAllSources(dossier);
  const citations = allSources.length >= 10 ? allSources : [...allSources, ...allSources].slice(0, 10);

  const linkedinUrl = dossier.prospect?.linkedinUrl;
  const email = dossier.prospect?.email;

  // Resolve the active signal: pinned signal overrides agent selection
  const activeSignal = pinnedSignalSummary
    ? dossier.rankedSignals.find((r) => r.summary === pinnedSignalSummary) ?? dossier.rankedSignals[0]
    : null;
  const displaySignal = activeSignal
    ? { ...dossier.selectedSignal, summary: activeSignal.summary, score: activeSignal.score, safety: activeSignal.safety }
    : dossier.selectedSignal;

  // Find breakdown for the selected signal from rankedSignals
  const selectedBreakdown = dossier.rankedSignals.find(
    (r) => r.summary === (pinnedSignalSummary ?? dossier.selectedSignal?.summary)
  )?.breakdown;

  return (
    <div className="mt-3 space-y-2.5 text-xs">

      {/* ── Prospect header ── */}
      {(linkedinUrl || email) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <span className="font-medium">{dossier.prospect.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{dossier.prospect.company}</span>
          <div className="ml-auto flex items-center gap-2">
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                <Mail className="h-2.5 w-2.5" />
                {email}
              </a>
            )}
            {linkedinUrl && (
              <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[#0A66C2] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#004182]">
                <LiIcon className="h-2.5 w-2.5" />
                LinkedIn
                <ExternalLink className="h-2 w-2" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── 1. Selected Signal ── */}
      <Section icon={<TrendingUp className="h-3.5 w-3.5" />} title="Selected Signal" accent>
        {pinnedSignalSummary && (
          <div className="mb-2 flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] text-primary">
            <Pin className="h-2.5 w-2.5" />
            You overrode the agent. Using your pinned signal
            <button onClick={() => setPinnedSignalSummary(null)} className="ml-auto underline hover:no-underline">
              Reset
            </button>
          </div>
        )}
        <p className="font-medium leading-snug">{displaySignal?.summary ?? "No signal found"}</p>
        {displaySignal?.relevanceReason && (
          <p className="mt-1 text-muted-foreground">{displaySignal.relevanceReason}</p>
        )}
        {displaySignal && (
          <div className="mt-2 flex items-center gap-2">
            <ScoreChip score={displaySignal.score ?? 0} />
            <span className="text-[10px] text-muted-foreground capitalize">
              {displaySignal.safety?.replace(/_/g, " ")}
            </span>
            {selectedBreakdown && (
              <button
                onClick={() => setShowSelectedBreakdown((v) => !v)}
                className={`ml-auto flex items-center gap-0.5 text-[10px] transition-colors ${showSelectedBreakdown ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart2 className="h-3 w-3" />
                {showSelectedBreakdown ? "Hide breakdown" : "Why this score?"}
              </button>
            )}
          </div>
        )}
        {showSelectedBreakdown && selectedBreakdown && (
          <ScoreBreakdownPanel breakdown={selectedBreakdown} />
        )}
        {displaySignal?.grade === "C" && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
            Company-level signal. Verify before sending.
          </div>
        )}
      </Section>

      {/* ── 2. Draft ── */}
      <DraftCard draft={dossier.draft} running={running} />

      <div className="border-t border-dashed border-border/60" />

      {/* ── 3. Ranked Signals (with steering pins + breakdowns) ── */}
      <Section icon={<FileSearch className="h-3.5 w-3.5" />} title="All Ranked Signals" collapsible defaultOpen={true}>
        <p className="mb-2 text-[10px] text-muted-foreground">
          Pin any signal to use it instead of the agent's selection.
        </p>
        <div className="space-y-1.5">
          {dossier.rankedSignals.length ? (
            dossier.rankedSignals.map((r, i) => (
              <RankedSignalRow
                key={i}
                signal={r}
                isSelected={i === 0 && !pinnedSignalSummary}
                isPinned={pinnedSignalSummary === r.summary}
              />
            ))
          ) : (
            <span className="text-muted-foreground">No signals found</span>
          )}
        </div>
      </Section>

      {/* ── 4. Risk Flags ── */}
      {dossier.riskFlags.length > 0 && (
        <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Risk Flags">
          <ul className="space-y-1">
            {dossier.riskFlags.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 5. Rejected Alternatives (with provenance: why each was rejected) ── */}
      {dossier.rejectedAlternatives.length > 0 && (
        <Section icon={<XCircle className="h-3.5 w-3.5" />} title="Rejected Signals" collapsible defaultOpen={false}>
          <p className="mb-2 text-[10px] text-muted-foreground">
            These signals were found but not selected. Reason shown for each.
          </p>
          <ul className="space-y-1.5">
            {dossier.rejectedAlternatives.map((r, i) => {
              const ranked = dossier.rankedSignals.find((rs) => rs.summary === r.summary);
              return (
                <li key={i} className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground leading-snug">{r.summary}</span>
                    {ranked && <ScoreChip score={ranked.score} small />}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{r.reason}</p>
                  {ranked && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60 capitalize">
                      Safety: {ranked.safety.replace(/_/g, " ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* ── 6. Evidence with source provenance ── */}
      <Section icon={<ExternalLink className="h-3.5 w-3.5" />} title={`Evidence: ${citations.length} sources`} collapsible defaultOpen={false}>
        <p className="mb-2 text-[10px] text-muted-foreground">
          All sources used to identify and verify the selected signal.
        </p>
        <ul className="space-y-2">
          {citations.map((s, i) => {
            const li = isLinkedIn(s.url);
            const age = sourceAge(s.publishedAt);
            const ageColor = freshnessColor(s.publishedAt);
            return (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-2 py-1.5">
                <span className="mt-0.5 w-5 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                  [{i + 1}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {li && <LiIcon className="h-3 w-3 shrink-0 text-[#0A66C2]" />}
                    <span className="font-medium truncate">{s.sourceName}</span>
                    {age && (
                      <span className={`ml-auto shrink-0 text-[10px] ${ageColor}`} title={s.publishedAt}>
                        {age}
                      </span>
                    )}
                  </div>
                  {s.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground leading-relaxed">
                      {s.snippet}
                    </p>
                  )}
                  <a
                    className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {li ? "LinkedIn profile" : "Source link"}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
