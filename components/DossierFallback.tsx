"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { PipelineEvent } from "@/lib/types";

export function DossierFallback({ events }: { events: PipelineEvent[] }) {
  const errorEvent = [...events].reverse().find((e): e is Extract<PipelineEvent, { type: "error" }> => e.type === "error");
  const isTimeout = errorEvent?.message?.includes("Timed out") || errorEvent?.message?.includes("2 minutes");
  const isNoSignal = errorEvent?.message?.includes("Gate 2") || errorEvent?.message?.includes("Gate 3") || errorEvent?.message?.includes("No signal");
  const isIdentity = errorEvent?.message?.includes("Gate 1") || errorEvent?.message?.includes("identity");

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isTimeout ? "bg-amber-100" : "bg-red-50"}`}>
        {isTimeout
          ? <Clock className="h-5 w-5 text-amber-600" />
          : <AlertTriangle className="h-5 w-5 text-red-400" />}
      </div>
      <div>
        <p className="text-sm font-medium">
          {isTimeout ? "Research timed out" : isIdentity ? "Could not verify identity" : isNoSignal ? "No usable signal found" : "Something went wrong"}
        </p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {isTimeout
            ? "The search took longer than 2 minutes. Try again, searches can vary in speed."
            : isIdentity
            ? "Add a LinkedIn URL, job title, or company name to help confirm the right person."
            : isNoSignal
            ? "No recent public signals found for this person. Try a different prospect or check the spelling."
            : errorEvent?.message ?? "An unexpected error occurred. Please try again."}
        </p>
      </div>
    </div>
  );
}
