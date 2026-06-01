import type { StageUpdateEvent } from "@/lib/types";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";

const stageOrder = [
  "resolve",
  "research",
  "extract",
  "judge",
  "draft",
] as const;

const stageDescriptions: Record<
  string,
  { label: string; description: string }
> = {
  resolve: {
    label: "Verify",
    description:
      "Confirming person-company match and checking for common-name risks",
  },
  research: {
    label: "Research",
    description: "Searching for recent news, signals, and relevant context",
  },
  extract: {
    label: "Extract",
    description: "Identifying outreach signals from gathered evidence",
  },
  judge: {
    label: "Score",
    description: "Ranking signals by relevance and checking safety",
  },
  draft: {
    label: "Draft",
    description: "Generating personalized outreach messaging",
  },
};

export function StatusTimeline({
  events,
  running,
}: {
  events: StageUpdateEvent[];
  running: boolean;
}) {
  const grouped = events.reduce<Record<string, StageUpdateEvent[]>>(
    (acc, event) => {
      if (!acc[event.stage]) acc[event.stage] = [];
      acc[event.stage].push(event);
      return acc;
    },
    {},
  );

  if (!events.length && !running) return <div className="h-10" />;

  const statuses = stageOrder.map((stage) => {
    const latest = grouped[stage]?.[grouped[stage].length - 1];
    return {
      stage,
      status: latest?.status ?? "pending",
      note: latest?.note,
    };
  });

  const isComplete = (idx: number) => {
    const status = statuses[idx]?.status;
    return status === "complete" || status === "error";
  };

  return (
    <details className="mt-2">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-3 rounded-md border px-3 marker:content-none hover:bg-muted/50">
        <div className="flex items-center gap-1">
          {stageOrder.map((stage, idx) => {
            const status = statuses[idx]?.status;
            const isLast = idx === stageOrder.length - 1;
            const completed = isComplete(idx);
            const active = status === "running";
            const desc = stageDescriptions[stage];

            return (
              <div key={idx} className="flex items-center">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/30 bg-background"
                  }`}
                  title={desc?.description}
                >
                  {completed ? (
                    <Check className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-2 w-2 text-muted-foreground/50" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`h-[2px] w-4 transition-colors ${
                      completed ? "bg-primary" : "bg-muted-foreground/20"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium">
            {(() => {
              const activeIdx = statuses.findIndex(
                (s) => s.status === "running",
              );
              if (activeIdx >= 0) {
                return stageDescriptions[stageOrder[activeIdx]]?.description;
              }
              const hasComplete = statuses.some(
                (s) => s.status === "complete" || s.status === "error",
              );
              if (!hasComplete) return "Ready to start";
              const allDone = statuses.every(
                (s) => s.status === "complete" || s.status === "error",
              );
              if (allDone) return "Complete";
              return "Processing...";
            })()}
          </span>
        </div>
      </summary>

      <div className="mt-2 rounded-md border bg-card p-3">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1">
            {statuses.map((item, idx) => {
              const completed = isComplete(idx);
              const active = item.status === "running";
              const hasError = item.status === "error";

              return (
                <div key={item.stage} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary bg-primary/10"
                            : "border-muted-foreground/25 bg-background"
                      }`}
                    >
                      {completed ? (
                        <Check className="h-3 w-3" />
                      ) : active ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : hasError ? (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      ) : (
                        <Circle className="h-2 w-2 text-muted-foreground/40" />
                      )}
                    </div>
                    {idx < stageOrder.length - 1 && (
                      <div
                        className={`mt-1 h-6 w-[2px] ${
                          completed ? "bg-primary/50" : "bg-muted-foreground/15"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${active ? "text-primary" : ""}`}
                      >
                        {stageDescriptions[item.stage]?.label}
                      </span>
                      <span
                        className={`text-[10px] uppercase ${
                          hasError
                            ? "text-destructive"
                            : completed
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70">
                      {stageDescriptions[item.stage]?.description}
                    </span>
                    {item.note && (
                      <span className="text-xs text-foreground/80">
                        → {item.note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}
