"use client";

import { useState, useEffect } from "react";
import type { StageUpdateEvent } from "@/lib/types";
import { Check, Loader2, AlertCircle, Circle, ChevronDown } from "lucide-react";

const stageOrder = ["resolve", "research", "extract", "judge", "draft"] as const;

const stageDescriptions: Record<string, { label: string; description: string }> = {
  resolve:  { label: "Verify",    description: "Confirming person–company match" },
  research: { label: "Research",  description: "Searching for recent news & signals" },
  extract:  { label: "Extract",   description: "Identifying outreach signals" },
  judge:    { label: "Score",     description: "Ranking signals by relevance" },
  draft:    { label: "Draft",     description: "Generating personalized messaging" },
};

export function StatusTimeline({ events, running }: { events: StageUpdateEvent[]; running: boolean }) {
  const [open, setOpen] = useState(false);

  const grouped = events.reduce<Record<string, StageUpdateEvent[]>>((acc, e) => {
    if (!acc[e.stage]) acc[e.stage] = [];
    acc[e.stage].push(e);
    return acc;
  }, {});

  const statuses = stageOrder.map((stage) => {
    const latest = grouped[stage]?.[grouped[stage].length - 1];
    return { stage, status: latest?.status ?? "pending", note: latest?.note };
  });

  const allDone = statuses.every((s) => s.status === "complete" || s.status === "error");
  const activeIdx = statuses.findIndex((s) => s.status === "running");

  // Auto-open while running, auto-close when done
  useEffect(() => {
    if (running) setOpen(true);
    if (allDone) setOpen(false);
  }, [running, allDone]);

  if (!events.length && !running) return null;

  const summaryLabel = (() => {
    if (activeIdx >= 0) return stageDescriptions[stageOrder[activeIdx]]?.description;
    if (allDone) return "Complete";
    return "Processing…";
  })();

  const completedCount = statuses.filter((s) => s.status === "complete" || s.status === "error").length;

  return (
    <div className={`mt-2 rounded-lg border overflow-hidden transition-colors ${allDone ? "border-border/30 bg-muted/20" : "border-border"}`}>
      {/* ── Compact header bar ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors"
      >
        {/* Mini bubbles */}
        <div className="flex items-center gap-0.5">
          {stageOrder.map((stage, idx) => {
            const s = statuses[idx]?.status;
            const done = s === "complete" || s === "error";
            const active = s === "running";
            return (
              <div key={idx} className="flex items-center">
                <div className={`flex h-3 w-3 items-center justify-center rounded-full border transition-colors ${
                  done && allDone ? "border-muted-foreground/30 bg-muted-foreground/20 text-muted-foreground/50" :
                  done            ? "border-primary bg-primary text-primary-foreground" :
                  active          ? "border-primary bg-primary/10" :
                                    "border-muted-foreground/20 bg-background"
                }`}>
                  {done   ? <Check className="h-1.5 w-1.5" /> :
                   active ? <Loader2 className="h-1.5 w-1.5 animate-spin text-primary" /> :
                            <Circle className="h-1 w-1 text-muted-foreground/30" />}
                </div>
                {idx < stageOrder.length - 1 && (
                  <div className={`h-px w-2 ${done && allDone ? "bg-muted-foreground/20" : done ? "bg-primary" : "bg-muted-foreground/15"}`} />
                )}
              </div>
            );
          })}
        </div>

        <span className={`text-[10px] flex-1 text-left truncate ${allDone ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
          {summaryLabel}
          {!allDone && <span className="ml-1 opacity-50">{completedCount}/{stageOrder.length}</span>}
        </span>

        <ChevronDown className={`h-2.5 w-2.5 text-muted-foreground/30 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* ── Animated expandable detail ── */}
      <div className={`transition-all duration-200 ease-in-out ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>
        <div className="border-t border-border px-3 py-2 space-y-1.5">
          {statuses.map((item, idx) => {
            const done = item.status === "complete" || item.status === "error";
            const active = item.status === "running";
            const hasError = item.status === "error";
            return (
              <div key={item.stage} className="flex items-start gap-2">
                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  done    ? "border-primary bg-primary text-primary-foreground" :
                  active  ? "border-primary bg-primary/10" :
                            "border-muted-foreground/25 bg-background"
                }`}>
                  {done    ? <Check className="h-2.5 w-2.5" /> :
                   active  ? <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> :
                   hasError ? <AlertCircle className="h-2.5 w-2.5 text-destructive" /> :
                              <Circle className="h-1.5 w-1.5 text-muted-foreground/40" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-medium leading-tight ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground/60"}`}>
                    {stageDescriptions[item.stage]?.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 leading-tight">
                    {stageDescriptions[item.stage]?.description}
                  </span>
                  {item.note && <span className="text-[10px] text-foreground/70 mt-0.5">→ {item.note}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
