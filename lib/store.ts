import { v7 as uuidv7 } from "uuid";
import type { ResearchDossier, RunRecord } from "@/lib/types";
import { compileMetrics, determineSignalStrength } from "@/lib/metrics";

const RUN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_RUNS = 200;

const runsById = new Map<string, { record: RunRecord; expiresAt: number }>();
const runOrder: string[] = [];

function pruneExpired() {
  const now = Date.now();
  for (const [id, row] of runsById.entries()) {
    if (row.expiresAt <= now) runsById.delete(id);
  }
  for (let i = runOrder.length - 1; i >= 0; i -= 1) {
    if (!runsById.has(runOrder[i])) runOrder.splice(i, 1);
  }
}

function confidenceTier(dossier: ResearchDossier): "HIGH" | "MEDIUM" | "SKIP" {
  const grade = dossier.selectedSignal?.grade;
  if (!grade) return "SKIP";
  if (grade === "A") return "HIGH";
  if (grade === "B" || grade === "C") return "MEDIUM";
  return "SKIP";
}

export function saveRun(
  dossier: ResearchDossier,
  durationMs: number,
  signalTypes: { signalType?: "person" | "company" | "generic" }[] = [],
): RunRecord {
  pruneExpired();
  const id = `run_${Date.now()}_${uuidv7().replace(/-/g, "").slice(0, 16)}`;
  const tier = confidenceTier(dossier);

  // Compile metrics
  const metrics = compileMetrics(dossier, durationMs, tier, signalTypes);

  const record: RunRecord = {
    id,
    createdAt: new Date().toISOString(),
    durationMs,
    confidenceTier: tier,
    draftProduced: Boolean(dossier.draft),
    hookSummary: dossier.selectedSignal?.summary ?? "No safe hook selected",
    dossier,
    metrics,
  };
  runsById.set(id, { record, expiresAt: Date.now() + RUN_TTL_MS });
  runOrder.unshift(id);
  if (runOrder.length > MAX_RUNS) {
    const trim = runOrder.splice(MAX_RUNS);
    for (const oldId of trim) runsById.delete(oldId);
  }
  return record;
}

export function listRuns(limit = 50): RunRecord[] {
  pruneExpired();
  return runOrder
    .slice(0, Math.max(1, Math.min(limit, MAX_RUNS)))
    .map((id) => runsById.get(id)?.record)
    .filter((v): v is RunRecord => Boolean(v));
}

export function getRun(id: string): RunRecord | undefined {
  pruneExpired();
  return runsById.get(id)?.record;
}
