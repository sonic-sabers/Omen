"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/runs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useState(() => { loadRuns(); });

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
    <main className="min-h-screen bg-[linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.3))]">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/20" />
          <div className="flex items-center gap-3 px-5 py-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-sm font-bold tracking-tight">Run Dashboard</h1>
              <p className="text-[11px] text-muted-foreground/70">All research runs and batch results</p>
            </div>
          </div>
        </div>

        {/* ── Stats + Upload row ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          {runs.length > 0 && (
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total runs" value={runs.length} />
              <StatCard label="Drafts produced" value={drafted} sub={`${100 - skipRate}% draft rate`} />
              <StatCard label="Avg duration" value={`${(avgDuration / 1000).toFixed(1)}s`} />
              <StatCard label="Avg grounding" value={avgGrounding > 0 ? `${avgGrounding}%` : "—"} sub="citation fidelity" />
            </div>
          )}
          <div className="shrink-0">
            <BatchUpload onBatchComplete={loadRuns} />
          </div>
        </div>

        {/* ── Table ── */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading runs...
          </div>
        ) : (
          <DashboardTable runs={runs} onRefresh={loadRuns} />
        )}
      </div>
    </main>
  );
}
