import Link from "next/link";
import type { RunRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface DashboardTableProps {
  runs: RunRecord[];
  onRefresh?: () => void;
}

export function DashboardTable({ runs, onRefresh }: DashboardTableProps) {
  if (!runs.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No runs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Submit a prospect from the main page or upload a CSV batch
        </p>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="mt-4"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="p-3">Prospect</th>
            <th className="p-3">Company</th>
            <th className="p-3">Tier</th>
            <th className="p-3">Hook</th>
            <th className="p-3 text-right">Specificity</th>
            <th className="p-3 text-right">Grounding</th>
            <th className="p-3 text-right">Time</th>
            <th className="p-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t">
              <td className="p-3">
                <Link className="underline" href={`/runs/${run.id}`}>
                  {run.dossier.prospect.name}
                </Link>
              </td>
              <td className="p-3">{run.dossier.prospect.company}</td>
              <td className="p-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    run.confidenceTier === "HIGH"
                      ? "bg-green-100 text-green-800"
                      : run.confidenceTier === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {run.confidenceTier}
                </span>
              </td>
              <td
                className="max-w-[300px] truncate p-3"
                title={run.hookSummary}
              >
                {run.hookSummary}
              </td>
              <td className="p-3 text-right text-xs">
                {run.metrics ? `${run.metrics.hookSpecificityRate}%` : "-"}
              </td>
              <td className="p-3 text-right text-xs">
                {run.metrics ? `${run.metrics.groundingFidelity}%` : "-"}
              </td>
              <td className="p-3 text-right text-xs">
                {(run.durationMs / 1000).toFixed(1)}s
              </td>
              <td className="p-3 text-xs">
                {new Date(run.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
