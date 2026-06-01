import { notFound } from "next/navigation";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { getRun } from "@/lib/store";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return notFound();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Run {run.id}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {run.confidenceTier} · {new Date(run.createdAt).toLocaleString()} · {run.durationMs}ms
      </p>
      <div className="mt-4">
        <ResearchDossierView dossier={run.dossier} />
      </div>
    </main>
  );
}

