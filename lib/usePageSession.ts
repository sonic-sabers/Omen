"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { PipelineEvent, Prospect, SalesContext, RuntimeMode } from "@/lib/types";

const SESSION_KEY = "omen_page_state";

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

interface SessionState {
  mode: RuntimeMode;
  fixtureId: string;
  prospect: Prospect;
  salesContext: SalesContext;
  events: PipelineEvent[];
}

export function usePageSession(state: SessionState) {
  const { mode, fixtureId, prospect, salesContext, events } = state;

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode, fixtureId, prospect, salesContext, events }));
    } catch { /* quota exceeded, ignore */ }
  }, [mode, fixtureId, prospect, salesContext, events]);

  useEffect(() => { persist(); }, [persist]);
}
