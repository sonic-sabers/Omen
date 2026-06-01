"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { DashboardTable } from "@/components/DashboardTable";
import { BatchUpload } from "@/components/BatchUpload";
import type { RunRecord } from "@/lib/types";
import { Loader2, ArrowLeft } from "lucide-react";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/runs?limit=100");
      if (res.ok) {
        const data = await res.json();
        const fetched: RunRecord[] = data.runs || [];
        setRuns(fetched);
        try { sessionStorage.setItem("omen_runs_cache", JSON.stringify(fetched)); } catch { /* quota */ }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const drafted = runs.filter((r) => r.draftProduced).length;
  const skipRate = runs.length ? Math.round(((runs.length - drafted) / runs.length) * 100) : 0;
  const avgDuration = runs.length
    ? Math.round(runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length)
    : 0;
  const runsWithMetrics = runs.filter((r) => r.metrics);
  const avgGrounding = runsWithMetrics.length
    ? Math.round(runsWithMetrics.reduce((sum, r) => sum + (r.metrics?.groundingFidelity || 0), 0) / runsWithMetrics.length)
    : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_45%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.32))]">
      <div className="mx-auto max-w-7xl p-4 md:p-8">

        {/* ── Header ── */}
        <header className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/20" />
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
                <span className="text-sm font-black tracking-tighter text-primary-foreground">O</span>
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold tracking-tight">Run Dashboard</h1>
                  <span className="hidden rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                    Sales Intelligence
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">All research runs and batch results</p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Link>
          </div>
        </header>

        {/* ── Stats row (only with data) ── */}
        {runs.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total runs" value={runs.length} />
            <StatCard label="Drafts produced" value={drafted} sub={`${100 - skipRate}% draft rate`} />
            <StatCard label="Avg duration" value={`${(avgDuration / 1000).toFixed(1)}s`} />
            <StatCard label="Avg grounding" value={avgGrounding > 0 ? `${avgGrounding}%` : "—"} sub="citation fidelity" />
          </div>
        )}

        {/* ── Table + Upload ── */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading runs...
          </div>
        ) : runs.length > 0 ? (
          <div className="space-y-4">
            <DashboardTable runs={runs} onRefresh={loadRuns} />
            <div className="flex justify-end">
              <BatchUpload onBatchComplete={loadRuns} />
            </div>
          </div>
        ) : (
          /* Empty state with Upload prominent */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold">No runs yet</h3>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Research a prospect from the main page, or upload a CSV to process multiple people at once.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <BatchUpload onBatchComplete={loadRuns} />
              <p className="text-[10px] text-muted-foreground">or go back and research a single prospect</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
