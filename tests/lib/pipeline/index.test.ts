import { describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/pipeline";
import type { RunInput, PipelineEvent } from "@/lib/types";
import { DEFAULT_SALES_CONTEXT } from "@/lib/config";

async function collect(input: RunInput): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  for await (const ev of runPipeline(input, new AbortController().signal)) {
    events.push(ev);
  }
  return events;
}

function baseInput(fixtureId: string): RunInput {
  return {
    mode: "fixture",
    fixtureId,
    prospect: { name: "Jane Smith", company: "Acme", title: "VP Sales" },
    salesContext: DEFAULT_SALES_CONTEXT,
  };
}

describe("pipeline fixtures", () => {
  it("generates a draft for funding-success", async () => {
    const events = await collect(baseInput("funding-success"));
    const dossier = events.find((e) => e.type === "dossier");
    expect(dossier && dossier.type === "dossier" ? dossier.dossier.draft : undefined).toBeTruthy();
  });

  it("withholds draft when no-signal", async () => {
    const events = await collect(baseInput("no-signal"));
    const dossier = events.find((e) => e.type === "dossier");
    expect(dossier && dossier.type === "dossier" ? dossier.dossier.draft : undefined).toBeUndefined();
  });

  it("flags sensitive layoffs signal", async () => {
    const events = await collect(baseInput("layoffs-sensitive"));
    const dossier = events.find((e) => e.type === "dossier");
    expect(dossier && dossier.type === "dossier" ? dossier.dossier.riskFlags.length : 0).toBeGreaterThan(0);
  });

  it("keeps ambiguity warning for namesake case", async () => {
    const events = await collect(baseInput("ambiguous-namesake"));
    const dossier = events.find((e) => e.type === "dossier");
    const flags = dossier && dossier.type === "dossier" ? dossier.dossier.riskFlags : [];
    expect(flags.some((f) => f.toLowerCase().includes("common-name risk"))).toBe(true);
  });

  it("rejects stale/conflicting alternatives", async () => {
    const events = await collect(baseInput("stale-conflict"));
    const dossier = events.find((e) => e.type === "dossier");
    const rejected = dossier && dossier.type === "dossier" ? dossier.dossier.rejectedAlternatives : [];
    expect(rejected.length).toBeGreaterThan(0);
  });
});
