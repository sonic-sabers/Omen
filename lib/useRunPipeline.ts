"use client";

import { useState, useCallback } from "react";
import type { PipelineEvent, Prospect, SalesContext, RuntimeMode } from "@/lib/types";

let clientSessionId: string | null = null;

function getSessionId(): string {
  if (clientSessionId) return clientSessionId;
  clientSessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return clientSessionId;
}

export function useRunPipeline(
  mode: RuntimeMode,
  fixtureId: string,
  prospect: Prospect,
  salesContext: SalesContext,
  initialEvents: PipelineEvent[] = [],
) {
  const [events, setEvents] = useState<PipelineEvent[]>(initialEvents);
  const [running, setRunning] = useState(false);

  const startRun = useCallback(async () => {
    setRunning(true);
    setEvents([]);

    const sessionId = getSessionId();
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort("timeout"), 60_000);

    let response: Response;
    try {
      response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        body: JSON.stringify({ mode, fixtureId, prospect, salesContext }),
        signal: abortCtrl.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = abortCtrl.signal.aborted;
      setEvents([
        {
          type: "error",
          message: isTimeout
            ? "Timed out after 60 seconds. The research took too long. Try again or simplify the prospect details."
            : "Network error. Check your connection and try again.",
        },
        { type: "done" },
      ]);
      setRunning(false);
      return;
    }

    if (!response.ok || !response.body) {
      clearTimeout(timeoutId);
      let message = "Failed to start run.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch { /* ignore */ }
      if (response.status === 429) message = "Too many requests. Wait a moment and try again.";
      if (response.status === 503) message = "Service temporarily unavailable. Try again in a few seconds.";
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
            if (event.type === "done") {
              clearTimeout(timeoutId);
              setRunning(false);
            }
          } catch { /* ignore malformed SSE */ }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = abortCtrl.signal.aborted;
      setEvents((prev) => [
        ...prev,
        {
          type: "error",
          message: isTimeout
            ? "Timed out after 60 seconds. Partial results shown above."
            : "Stream interrupted. Partial results shown above.",
        },
        { type: "done" },
      ]);
    }

    clearTimeout(timeoutId);
    setRunning(false);
  }, [mode, fixtureId, prospect, salesContext]);

  return { events, running, startRun, setEvents };
}
