"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardTable } from "@/components/DashboardTable";
import { BatchUpload } from "@/components/BatchUpload";
import type { RunRecord } from "@/lib/types";
import { Loader2, ArrowLeft } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load runs on client side
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

  const drafted = runs.filter((r) => r.draftProduced).length;
  const skipRate = runs.length
    ? Math.round(((runs.length - drafted) / runs.length) * 100)
    : 0;
  const avgDuration = runs.length
    ? Math.round(runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length)
    : 0;

  // Aggregate metrics
  const runsWithMetrics = runs.filter((r) => r.metrics);
  const avgSpecificity = runsWithMetrics.length
    ? Math.round(
        runsWithMetrics.reduce(
          (sum, r) => sum + (r.metrics?.hookSpecificityRate || 0),
          0,
        ) / runsWithMetrics.length,
      )
    : 0;
  const avgGrounding = runsWithMetrics.length
    ? Math.round(
        runsWithMetrics.reduce(
          (sum, r) => sum + (r.metrics?.groundingFidelity || 0),
          0,
        ) / runsWithMetrics.length,
      )
    : 0;
  const abstentionRate = runsWithMetrics.length
    ? Math.round(
        (runsWithMetrics.filter((r) => r.metrics?.skipped).length /
          runsWithMetrics.length) *
          100,
      )
    : 0;

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* Header Section - compact aligned */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <h1 className="text-base font-semibold">Run Dashboard</h1>
          {runs.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{runs.length} runs</span>
              <span>•</span>
              <span>{skipRate}% skip</span>
              <span>•</span>
              <span>{(avgDuration / 1000).toFixed(1)}s avg</span>
              {runsWithMetrics.length > 0 && (
                <>
                  <span>•</span>
                  <span>{avgSpecificity}% spec</span>
                  <span>•</span>
                  <span>{avgGrounding}% ground</span>
                </>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex-shrink-0">
          <BatchUpload onBatchComplete={loadRuns} />
        </div>
      </div>

      {/* Content Section */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <DashboardTable runs={runs} onRefresh={loadRuns} />
        )}
      </div>
    </main>
  );
}
