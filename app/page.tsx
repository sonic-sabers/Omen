"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEFAULT_SALES_CONTEXT } from "@/lib/config";
import type { Prospect, SalesContext } from "@/lib/types";
import { loadSession, usePageSession } from "@/lib/usePageSession";
import { useRunPipeline } from "@/lib/useRunPipeline";
import { DossierFallback } from "@/components/DossierFallback";
import { ProspectForm } from "@/components/ProspectForm";
import { StatusTimeline } from "@/components/StatusTimeline";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { SalesContextForm } from "@/components/SalesContextForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const saved = useMemo(() => loadSession(), []);

  const [mode, setMode] = useState<"fixture" | "live">(saved?.mode ?? "live");
  const [fixtureId, setFixtureId] = useState(saved?.fixtureId ?? "funding-success");
  const [prospect, setProspect] = useState<Prospect>(saved?.prospect ?? {
    name: "Satya Nadella",
    company: "Microsoft",
    title: "Chairman and CEO",
  });
  const [salesContext, setSalesContext] = useState<SalesContext>(
    saved?.salesContext ?? DEFAULT_SALES_CONTEXT,
  );

  const { events, running, startRun, setEvents } = useRunPipeline(mode, fixtureId, prospect, salesContext, saved?.events ?? []);

  usePageSession({ mode, fixtureId, prospect, salesContext, events });

  const dossier = useMemo(() => {
    const d = events.find((e) => e.type === "dossier");
    return d && d.type === "dossier" ? d.dossier : undefined;
  }, [events]);

  const stageEvents = events.filter((e) => e.type === "stage");
  const hasError = events.some((e) => e.type === "error");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_45%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.32))]">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Top accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/20" />

          <div className="flex items-center justify-between gap-4 px-5 py-4">
            {/* Brand */}
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
                  Research any prospect online and get a personalised message.
                </p>
              </div>
            </div>

            {/* Status + nav */}
            <div className="flex items-center gap-2.5">
              {/* Status pill */}
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                running
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : hasError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : dossier
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  running ? "animate-pulse bg-blue-500"
                  : hasError ? "bg-red-500"
                  : dossier ? "bg-emerald-500"
                  : "bg-muted-foreground/40"
                }`} />
                {running ? "Researching" : hasError ? "Error" : dossier ? "Ready" : "Idle"}
              </div>

              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                View Runs
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[420px_1fr]">
          <p className="text-sm font-medium text-muted-foreground">
            Step 1: Fill in the details
          </p>
          <p className="text-sm font-medium text-muted-foreground">Step 2: See results here</p>

          <section className="space-y-4">
            <ProspectForm
              mode={mode}
              fixtureId={fixtureId}
              prospect={prospect}
              running={running}
              onModeChange={(nextMode) => {
                setMode(nextMode);
                setEvents([]);
              }}
              onFixtureChange={(nextFixtureId) => {
                setFixtureId(nextFixtureId);
                setEvents([]);
              }}
              onProspectChange={setProspect}
              onRun={startRun}
            />
            <SalesContextForm
              salesContext={salesContext}
              onChange={setSalesContext}
              running={running}
            />
          </section>

          <section className="space-y-6">
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Dossier</CardTitle>
                </div>
                {!dossier && !running && !hasError && (
                  <p className="text-xs text-muted-foreground">Results appear here after you run.</p>
                )}
                <StatusTimeline events={stageEvents} running={running} />
              </CardHeader>
              <CardContent>
                {dossier ? (
                  <ResearchDossierView dossier={dossier} running={running} />
                ) : hasError && !running ? (
                  <DossierFallback events={events} />
                ) : running ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="relative flex h-10 w-10 items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                      <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Building your dossier</p>
                      <p className="text-xs text-muted-foreground/60">Scanning signals across the web</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">Ready to research</p>
                    <p className="text-xs text-muted-foreground">Fill in the person&apos;s details and hit the button.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
