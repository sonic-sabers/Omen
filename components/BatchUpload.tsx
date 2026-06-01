"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, Loader2, Square } from "lucide-react";

interface BatchJob {
  id: string;
  name: string;
  company: string;
  title?: string;
  status: "pending" | "running" | "complete" | "error";
  result?: {
    confidenceTier?: string;
    hookSummary?: string;
    draftProduced?: boolean;
    error?: string;
  };
}

interface BatchUploadProps {
  onBatchComplete?: () => void;
}

const MAX_BATCH_SIZE = 50; // Prevent abuse
const RATE_LIMIT_MS = 1000; // 1 second between requests
const MAX_CONSECUTIVE_ERRORS = 3; // Circuit breaker

export function BatchUpload({ onBatchComplete }: BatchUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (
    text: string,
  ): { name: string; company: string; title?: string }[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0]
      .toLowerCase()
      .split(",")
      .map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const companyIdx = headers.findIndex((h) => h.includes("company"));
    const titleIdx = headers.findIndex((h) => h.includes("title"));

    if (nameIdx === -1 || companyIdx === -1) return [];

    return lines
      .slice(1)
      .map((line) => {
        const cols = line
          .split(",")
          .map((c) => c.trim().replace(/^["']|["']$/g, ""));
        return {
          name: cols[nameIdx] || "",
          company: cols[companyIdx] || "",
          title: titleIdx >= 0 ? cols[titleIdx] : undefined,
        };
      })
      .filter((r) => r.name && r.company);
  };

  const stopBatch = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsUploading(false);
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-selecting same file
      if (!file) return;

      // Reset state
      consecutiveErrorsRef.current = 0;
      abortControllerRef.current = new AbortController();

      setIsUploading(true);
      const text = await file.text();
      const prospects = parseCSV(text);

      if (prospects.length === 0) {
        alert(
          "No valid prospects found. CSV must have 'name' and 'company' columns.",
        );
        setIsUploading(false);
        return;
      }

      // Enforce max batch size
      if (prospects.length > MAX_BATCH_SIZE) {
        alert(
          `Batch size limit: ${MAX_BATCH_SIZE} prospects maximum. Your file has ${prospects.length}.`,
        );
        setIsUploading(false);
        return;
      }

      // Create batch jobs
      const batchJobs: BatchJob[] = prospects.map((p, i) => ({
        id: `batch_${Date.now()}_${i}`,
        ...p,
        status: "pending",
      }));

      setJobs(batchJobs);
      setProgress({ completed: 0, total: batchJobs.length });

      // Process sequentially with rate limiting and circuit breaker
      for (let i = 0; i < batchJobs.length; i++) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log("Batch processing aborted");
          break;
        }

        // Circuit breaker: too many consecutive errors
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          alert(
            `Stopping batch: ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Please check your API configuration.`,
          );
          // Mark remaining as cancelled
          setJobs((prev) =>
            prev.map((j, idx) =>
              idx >= i
                ? {
                    ...j,
                    status: "error",
                    result: { error: "Cancelled - circuit breaker" },
                  }
                : j,
            ),
          );
          break;
        }

        const job = batchJobs[i];
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: "running" } : j)),
        );

        const startTime = Date.now();
        let success = false;

        try {
          const res = await fetch("/api/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prospect: {
                name: job.name,
                company: job.company,
                title: job.title,
              },
            }),
            signal: abortControllerRef.current?.signal,
          });

          if (res.ok) {
            const result = await res.json();
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id ? { ...j, status: "complete", result } : j,
              ),
            );
            consecutiveErrorsRef.current = 0; // Reset error count on success
            success = true;
          } else {
            const error = await res.text();
            setJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      status: "error",
                      result: { error: error.slice(0, 100) },
                    }
                  : j,
              ),
            );
            consecutiveErrorsRef.current++;
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // User cancelled - mark remaining as cancelled
            setJobs((prev) =>
              prev.map((j, idx) =>
                idx >= i
                  ? {
                      ...j,
                      status: "error",
                      result: { error: "Cancelled by user" },
                    }
                  : j,
              ),
            );
            break;
          }
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: "error",
                    result: { error: String(err).slice(0, 100) },
                  }
                : j,
            ),
          );
          consecutiveErrorsRef.current++;
        }

        setProgress({
          completed: success ? i + 1 : i,
          total: batchJobs.length,
        });

        // Rate limiting: ensure minimum time between requests
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, RATE_LIMIT_MS - elapsed);
        if (delay > 0 && i < batchJobs.length - 1) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      setIsUploading(false);
      abortControllerRef.current = null;
      onBatchComplete?.();
    },
    [onBatchComplete],
  );

  const downloadResults = useCallback(() => {
    const completed = jobs.filter((j) => j.status === "complete" && j.result);
    if (completed.length === 0) return;

    const csv = [
      [
        "Name",
        "Company",
        "Title",
        "Confidence",
        "Hook",
        "Draft Available",
      ].join(","),
      ...completed.map((j) =>
        [
          j.name,
          j.company,
          j.title || "",
          j.result?.confidenceTier || "",
          `"${(j.result?.hookSummary || "").replace(/"/g, '""')}"`,
          j.result?.draftProduced ? "Yes" : "No",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jobs]);

  const completedCount = jobs.filter((j) => j.status === "complete").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;

  // Idle state: just a button, no card
  if (!isUploading && jobs.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
        >
          <Upload className="h-4 w-4" />
          Upload CSV
        </button>
        <span className="text-[10px] text-muted-foreground">
          name, company, title
        </span>
      </div>
    );
  }

  return (
    <Card className="w-72">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Batch Upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isUploading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                Processing {progress.completed}/{progress.total}...
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs">
              <span className="text-green-600">{completedCount} complete</span>
              {errorCount > 0 && (
                <span className="ml-2 text-red-600">{errorCount} errors</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadResults}
                className="text-xs"
              >
                <Download className="mr-1 h-3 w-3" />
                Download Results
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setJobs([])}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
