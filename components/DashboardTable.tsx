"use client";

import { useState } from "react";
import type { RunRecord } from "@/lib/types";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { RefreshCw, FileText, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 right-0 bottom-0 z-40 bg-black/20 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 bottom-0 right-0 z-50 flex w-full max-w-xl flex-col bg-background shadow-2xl border-l border-border animate-slide-in-right">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold tracking-tight">{run.dossier.prospect.name}</p>
              <span className="text-muted-foreground">·</span>
              <p className="truncate text-sm text-muted-foreground">{run.dossier.prospect.company}</p>
              <span className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierStyles}`}>
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
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ResearchDossierView dossier={run.dossier} />
        </div>
      </div>
    </>
  );
}

export function DashboardTable({ runs, onRefresh }: DashboardTableProps) {
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);

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
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="group cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedRun(run)}
                >
                  <td className="px-4 py-3 font-medium">{run.dossier.prospect.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{run.dossier.prospect.company}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={run.confidenceTier} />
                  </td>
                  <td className="max-w-[280px] px-4 py-3">
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
                    {(run.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(run.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
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
            </tbody>
          </table>
        </div>
      </div>

      {selectedRun && (
        <RunDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </>
  );
}
