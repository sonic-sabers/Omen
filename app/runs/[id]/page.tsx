import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchDossierView } from "@/components/ResearchDossier";
import { getRun } from "@/lib/store";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return { title: "Run Not Found" };

  const name = run.dossier.prospect.name;
  const company = run.dossier.prospect.company;
  const title = `${name} · ${company}`;

  return {
    title,
    description: `Research dossier for ${name}, ${run.dossier.prospect.title ?? ""} at ${company}.`.replace(/,\s*,/, ",").trim(),
    openGraph: {
      title: `${title} | Omen`,
      description: `Research dossier for ${name} at ${company}.`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return notFound();

  const tierStyles =
    run.confidenceTier === "HIGH"   ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    run.confidenceTier === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-700" :
                                      "border-border bg-muted/40 text-muted-foreground";

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--muted)/0.3))]">
      <div className="mx-auto max-w-3xl px-6 py-8">

        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary to-primary/20" />
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                Dashboard
              </Link>
              <div className="h-4 w-px bg-border" />
              <div>
                <h1 className="text-sm font-bold tracking-tight">
                  {run.dossier.prospect.name}
                  <span className="ml-1.5 font-normal text-muted-foreground">· {run.dossier.prospect.company}</span>
                </h1>
                <p className="text-[11px] text-muted-foreground/70">
                  {new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{(run.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tierStyles}`}>
              {run.confidenceTier}
            </span>
          </div>
        </div>

        {/* Dossier */}
        <ResearchDossierView dossier={run.dossier} />
      </div>
    </main>
  );
}

