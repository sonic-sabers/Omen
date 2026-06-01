"use client";

import { useMemo, useState } from "react";
import { DEFAULT_SALES_CONTEXT } from "@/lib/config";
import type { PipelineEvent, Prospect, SalesContext } from "@/lib/types";
import { ProspectForm } from "@/components/ProspectForm";
import { StatusTimeline } from "@/components/StatusTimeline";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { SalesContextForm } from "@/components/SalesContextForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function HomePage() {
  const [mode, setMode] = useState<"fixture" | "live">("live");
  const [fixtureId, setFixtureId] = useState("funding-success");
  const [prospect, setProspect] = useState<Prospect>({
    name: "Satya Nadella",
    company: "Microsoft",
    title: "Chairman and CEO",
  });
  const [salesContext, setSalesContext] = useState<SalesContext>(
    DEFAULT_SALES_CONTEXT,
  );
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [running, setRunning] = useState(false);

  const dossier = useMemo(() => {
    const d = events.find((e) => e.type === "dossier");
    return d && d.type === "dossier" ? d.dossier : undefined;
  }, [events]);

  async function startRun() {
    setRunning(true);
    setEvents([]);

    const sessionId = getSessionId();
    let response: Response;
    try {
      response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ mode, fixtureId, prospect, salesContext }),
      });
    } catch {
      setEvents([
        { type: "error", message: "Network error while starting run." },
        { type: "done" },
      ]);
      setRunning(false);
      return;
    }

    if (!response.ok || !response.body) {
      ``;
      let message = "Failed to start run.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        // ignore non-json error body
      }
      setEvents([{ type: "error", message }, { type: "done" }]);
      setRunning(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(6)) as PipelineEvent;
            setEvents((prev) => [...prev, event]);
            if (event.type === "done") setRunning(false);
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch {
      setEvents((prev) => [
        ...prev,
        { type: "error", message: "Stream interrupted before completion." },
        { type: "done" },
      ]);
    }

    setRunning(false);
  }

  const stageEvents = events.filter((e) => e.type === "stage");
  const latestStage = stageEvents.length
    ? stageEvents[stageEvents.length - 1]
    : null;
  const hasError = events.some((e) => e.type === "error");
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_45%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.32))]">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <header className="mb-6 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                O
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight">Omen</h1>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">Smart Sales Research</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enter a person's name, research them online, and get a ready-to-send message.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  running
                    ? "secondary"
                    : hasError
                      ? "destructive"
                      : dossier
                        ? "default"
                        : "outline"
                }
                className="text-xs"
              >
                {running
                  ? "Running"
                  : hasError
                    ? "Error"
                    : dossier
                      ? "Ready"
                      : "Idle"}
              </Badge>
              <Link
                href="/dashboard"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                View Runs
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[420px_1fr]">
          <p className="text-sm font-medium text-muted-foreground">
            Step 1 — Fill in the details
          </p>
          <p className="text-sm font-medium text-muted-foreground">Step 2 — See results here</p>

          <section className="space-y-4">
            <ProspectForm
              mode={mode}
              fixtureId={fixtureId}
              prospect={prospect}
              running={running}
              onModeChange={setMode}
              onFixtureChange={setFixtureId}
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
                <CardTitle>Dossier</CardTitle>
                {!dossier ? (
                  <p className="text-sm text-muted-foreground">
                    No dossier yet.
                  </p>
                ) : null}
                <StatusTimeline events={stageEvents} running={running} />
              </CardHeader>
              <CardContent>
                {dossier ? (
                  <ResearchDossierView dossier={dossier} running={running} />
                ) : (
                  <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <svg
                        className="h-5 w-5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">Ready to research</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Configure prospect details and run the pipeline to
                      generate an evidence-backed outreach dossier.
                    </p>
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

let clientSessionId: string | null = null;

function getSessionId(): string {
  if (clientSessionId) return clientSessionId;
  clientSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return clientSessionId;
}
