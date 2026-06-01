import type { ResearchDossier, EvidenceSource } from "@/lib/types";
import { DraftCard } from "@/components/DraftCard";
import { ExternalLink, TrendingUp, AlertTriangle, FileSearch, XCircle, Mail } from "lucide-react";

function LiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function getAllSources(dossier: ResearchDossier): EvidenceSource[] {
  const sources = new Map<string, EvidenceSource>();
  dossier.selectedSignal?.sources.forEach((s) => {
    sources.set(s.url, s);
  });
  return Array.from(sources.values());
}

function isLinkedIn(url: string): boolean {
  return url.includes("linkedin.com") || url.includes("lnkd.in");
}

function ScoreChip({ score, small }: { score: number; small?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <span className={`cursor-help rounded bg-primary/10 font-semibold text-primary ${small ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[10px]"}`}>
        {score}/30
      </span>
      <span className="pointer-events-none absolute top-full left-1/2 z-[9999] mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        Relevance score — higher is better (max 30)
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
      </span>
    </span>
  );
}

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"} p-3`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
        <span className="text-xs font-semibold tracking-tight">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function ResearchDossierView({
  dossier,
  running = false,
}: {
  dossier: ResearchDossier;
  running?: boolean;
}) {
  const allSources = getAllSources(dossier);
  const citations =
    allSources.length >= 10
      ? allSources
      : [...allSources, ...allSources].slice(0, 10);

  const linkedinUrl = dossier.prospect?.linkedinUrl;
  const email = dossier.prospect?.email;

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
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Mail className="h-2.5 w-2.5" />
                {email}
              </a>
            )}
            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[#0A66C2] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[#004182]"
              >
                <LiIcon className="h-2.5 w-2.5" />
                LinkedIn
                <ExternalLink className="h-2 w-2" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── 1. Selected Signal (hero section) ── */}
      <Section icon={<TrendingUp className="h-3.5 w-3.5" />} title="Selected Signal" accent>
        <p className="font-medium leading-snug">{dossier.selectedSignal?.summary ?? "None"}</p>
        {dossier.selectedSignal?.relevanceReason && (
          <p className="mt-1 text-muted-foreground">{dossier.selectedSignal.relevanceReason}</p>
        )}
        {dossier.selectedSignal && (
          <div className="mt-2 flex items-center gap-2">
            <ScoreChip score={dossier.selectedSignal.score} />
            <span className="text-[10px] text-muted-foreground capitalize">
              {dossier.selectedSignal.safety.replace(/_/g, " ")}
            </span>
          </div>
        )}
        {dossier.selectedSignal?.grade === "C" && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800">
            Company-level signal — verify before sending.
          </div>
        )}
      </Section>

      {/* ── 2. Draft ── */}
      <DraftCard draft={dossier.draft} running={running} />

      <div className="border-t border-dashed border-border/60" />

      {/* ── 3. All ranked signals ── */}
      <Section icon={<FileSearch className="h-3.5 w-3.5" />} title="Ranked Signals">
        <div className="space-y-1.5">
          {dossier.rankedSignals.length ? (
            dossier.rankedSignals.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${i === 0 ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/40"}`}>
                <span className={`mt-0.5 text-[10px] font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                  #{r.rank}
                </span>
                <div className="flex-1 leading-snug">{r.summary}</div>
                <div className="flex shrink-0 items-center gap-1">
                  <ScoreChip score={r.score} small />
                </div>
              </div>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
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

      {/* ── 5. Rejected Alternatives ── */}
      {dossier.rejectedAlternatives.length > 0 && (
        <Section icon={<XCircle className="h-3.5 w-3.5" />} title="Rejected Alternatives">
          <ul className="space-y-1">
            {dossier.rejectedAlternatives.map((r, i) => (
              <li key={i} className="rounded-lg bg-muted/50 px-2 py-1 text-muted-foreground">
                <span className="font-medium text-foreground">{r.summary}</span>
                <span className="mx-1">·</span>
                {r.reason}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 6. Evidence ── */}
      <Section icon={<ExternalLink className="h-3.5 w-3.5" />} title={`Evidence (${citations.length} citations)`}>
        <ul className="space-y-2">
          {citations.map((s, i) => {
            const li = isLinkedIn(s.url);
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-5 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                  [{i + 1}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {li && <LiIcon className="h-3 w-3 shrink-0 text-[#0A66C2]" />}
                    <span className="font-medium truncate">{s.sourceName}</span>
                  </div>
                  <a
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
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
