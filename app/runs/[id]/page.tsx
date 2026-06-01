"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const cached = getCachedRun(id);
    if (cached) { setRun(cached); return; }
    fetch(`/api/runs/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.run) setRun(data.run); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [id]);

  const tierStyles = !run ? "" :
    run.confidenceTier === "HIGH"   ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    run.confidenceTier === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                                      "border-border bg-muted/40 text-muted-foreground";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_45%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.32))]">
      <div className="mx-auto max-w-7xl p-4 md:p-8">

        {/* Header — matches main page exactly */}
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
                  <h1 className="text-sm font-bold tracking-tight">Omen</h1>
                  <span className="hidden rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                    Sales Intelligence
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {run ? `${run.dossier.prospect.name} · ${run.dossier.prospect.company}` : "Run detail"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {run && (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tierStyles}`}>
                  {run.confidenceTier}
                </span>
              )}
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        {notFound ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-sm font-semibold">Run not found</p>
            <p className="text-xs text-muted-foreground">This run may have expired or the server restarted.</p>
            <Link href="/dashboard" className="mt-2 text-xs text-primary underline-offset-2 hover:underline">
              Back to dashboard
            </Link>
          </div>
        ) : !run ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading run...
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[420px_1fr]">
            {/* Left col — prospect info */}
            <div className="space-y-4">
              <Card className="border-primary/20 shadow-sm">
                <CardHeader>
                  <CardTitle>{run.dossier.prospect.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {[run.dossier.prospect.title, run.dossier.prospect.company].filter(Boolean).join(" · ")}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Run date</span>
                    <span>{new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{(run.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className={`font-semibold ${run.confidenceTier === "HIGH" ? "text-emerald-600" : run.confidenceTier === "MEDIUM" ? "text-amber-600" : "text-muted-foreground"}`}>
                      {run.confidenceTier}
                    </span>
                  </div>
                  {run.metrics && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Specificity</span>
                        <span>{run.metrics.hookSpecificityRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Grounding</span>
                        <span>{run.metrics.groundingFidelity}%</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right col — dossier */}
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <CardTitle>Dossier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResearchDossierView dossier={run.dossier} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
