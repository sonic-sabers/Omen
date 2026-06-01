"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ResearchDossierView } from "@/components/ResearchDossier";
import type { RunRecord } from "@/lib/types";
import { ArrowLeft, Loader2 } from "lucide-react";

const RUNS_CACHE_KEY = "omen_runs_cache";

function getCachedRun(id: string): RunRecord | null {
  try {
    const raw = sessionStorage.getItem(RUNS_CACHE_KEY);
    if (!raw) return null;
    const runs: RunRecord[] = JSON.parse(raw);
    return runs.find((r) => r.id === id) ?? null;
  } catch { return null; }
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Try cache first
    const cached = getCachedRun(id);
    if (cached) { setRun(cached); return; }

    // Fall back to API
    fetch(`/api/runs/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.run) setRun(data.run);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <main className="min-h-screen bg-[linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.3))]">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-sm font-semibold">Run not found</p>
            <p className="text-xs text-muted-foreground">This run may have expired or the server restarted.</p>
            <Link href="/dashboard" className="mt-2 text-xs text-primary underline-offset-2 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="min-h-screen bg-[linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.3))]">
        <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading run...
        </div>
      </main>
    );
  }

  const tierStyles =
    run.confidenceTier === "HIGH"   ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    run.confidenceTier === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                                      "border-border bg-muted/40 text-muted-foreground";

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.3))]">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/20" />
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                Dashboard
              </Link>
              <div className="h-4 w-px bg-border" />
              <div>
                <h1 className="text-sm font-bold tracking-tight">
                  {run.dossier.prospect.name}
                  <span className="ml-1.5 font-normal text-muted-foreground">· {run.dossier.prospect.company}</span>
                </h1>
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{(run.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tierStyles}`}>
              {run.confidenceTier}
            </span>
          </div>
        </div>

        <ResearchDossierView dossier={run.dossier} />
      </div>
    </main>
  );
}
