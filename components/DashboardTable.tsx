"use client";

import { useState, useEffect, useCallback } from "react";
import type { RunRecord } from "@/lib/types";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { RefreshCw, FileText, Mail, X, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

interface DashboardTableProps {
  runs: RunRecord[];
  onRefresh?: () => void;
}

function TierBadge({ tier }: { tier: string }) {
  const styles =
    tier === "HIGH"   ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    tier === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                        "border-border bg-muted/40 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles}`}>
      {tier}
    </span>
  );
}

function RunDrawer({ run, onClose }: { run: RunRecord; onClose: () => void }) {
  const tierStyles =
    run.confidenceTier === "HIGH"   ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    run.confidenceTier === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                                      "border-border bg-muted/40 text-muted-foreground";

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 bottom-0 z-40 bg-black/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed top-0 bottom-0 right-0 z-50 flex w-full max-w-xl flex-col bg-background shadow-2xl border-l border-border animate-slide-in-right">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-bold tracking-tight">{run.dossier.prospect.name}</p>
              <span className="text-muted-foreground">·</span>
              <p className="truncate text-sm text-muted-foreground">{run.dossier.prospect.company}</p>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierStyles}`}>
                {run.confidenceTier}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">
              {new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              {" · "}{(run.durationMs / 1000).toFixed(1)}s
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {run.dossier ? (
            <ResearchDossierView dossier={run.dossier} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">No dossier data for this run.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Pagination({
  page, totalPages, total, pageSize,
  onPrev, onNext, onPage,
}: {
  page: number; totalPages: number; total: number; pageSize: number;
  onPrev: () => void; onNext: () => void; onPage: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build page number list: always show first, last, current ±1, with ellipsis
  const pages: (number | "…")[] = [];
  const add = new Set<number>();
  [1, totalPages, page - 1, page, page + 1].forEach((p) => {
    if (p >= 1 && p <= totalPages) add.add(p);
  });
  const sorted = Array.from(add).sort((a, b) => a - b);
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push("…");
    pages.push(p);
  });

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
      <p className="text-[11px] text-muted-foreground">
        {from}–{to} of {total} {total === 1 ? "run" : "runs"}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-[11px] text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-1.5 text-[11px] font-medium transition-colors ${
                p === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DashboardTable({ runs, onRefresh }: DashboardTableProps) {
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [page, setPage] = useState(1);

  // Reset to page 1 when runs list changes
  useEffect(() => { setPage(1); }, [runs]);

  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRuns = runs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handlePrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  if (!runs.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">No runs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Research a prospect from the main page or upload a CSV batch.
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="mt-5 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Table header bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Prospect</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Company</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Tier</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Hook</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Specificity</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Grounding</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Draft</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pageRuns.map((run) => (
                <tr
                  key={run.id}
                  className="group cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedRun(run)}
                >
                  <td className="px-4 py-3 font-medium">
                    {run.dossier?.prospect?.name ?? <span className="italic text-muted-foreground opacity-50">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {run.dossier?.prospect?.company ?? <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={run.confidenceTier ?? "SKIP"} />
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <span className="block truncate text-muted-foreground" title={run.hookSummary}>
                      {run.hookSummary || <span className="italic opacity-50">No hook</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {run.metrics ? `${run.metrics.hookSpecificityRate}%` : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {run.metrics ? `${run.metrics.groundingFidelity}%` : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {typeof run.durationMs === "number" ? `${(run.durationMs / 1000).toFixed(1)}s` : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {run.createdAt
                      ? new Date(run.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedRun(run)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      <Mail className="h-3 w-3" />
                      View draft
                    </button>
                  </td>
                </tr>
              ))}

              {/* Fill empty rows to keep table height stable */}
              {pageRuns.length < PAGE_SIZE && runs.length > PAGE_SIZE && Array.from({ length: PAGE_SIZE - pageRuns.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td colSpan={9} className="px-4 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination — only show when needed */}
        {totalPages > 1 && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={runs.length}
            pageSize={PAGE_SIZE}
            onPrev={handlePrev}
            onNext={handleNext}
            onPage={setPage}
          />
        )}
      </div>

      {selectedRun && (
        <RunDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </>
  );
}
