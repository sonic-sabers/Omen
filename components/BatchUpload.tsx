"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, Loader2, CheckCircle2, XCircle, Clock, Square } from "lucide-react";

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

const MAX_BATCH_SIZE = 50;
const MAX_CONSECUTIVE_ERRORS = 5;
const CONCURRENCY = 3; // parallel workers

export function BatchUpload({ onBatchComplete }: BatchUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const abortedRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateJob = useCallback((id: string, patch: Partial<BatchJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const parseCSV = (text: string): { name: string; company: string; title?: string }[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const companyIdx = headers.findIndex((h) => h.includes("company"));
    const titleIdx = headers.findIndex((h) => h.includes("title"));
    if (nameIdx === -1 || companyIdx === -1) return [];
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return { name: cols[nameIdx] || "", company: cols[companyIdx] || "", title: titleIdx >= 0 ? cols[titleIdx] : undefined };
    }).filter((r) => r.name && r.company);
  };

  const processJob = useCallback(async (job: BatchJob) => {
    if (abortedRef.current) return;
    updateJob(job.id, { status: "running" });
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect: { name: job.name, company: job.company, title: job.title } }),
      });
      if (abortedRef.current) return;
      if (res.ok) {
        const result = await res.json();
        updateJob(job.id, { status: "complete", result });
        consecutiveErrorsRef.current = 0;
      } else {
        const err = await res.text();
        updateJob(job.id, { status: "error", result: { error: err.slice(0, 120) } });
        consecutiveErrorsRef.current++;
      }
    } catch (err) {
      updateJob(job.id, { status: "error", result: { error: String(err).slice(0, 120) } });
      consecutiveErrorsRef.current++;
    }
  }, [updateJob]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const text = await file.text();
    const prospects = parseCSV(text);

    if (prospects.length === 0) {
      alert("No valid prospects. CSV needs 'name' and 'company' columns.");
      return;
    }
    if (prospects.length > MAX_BATCH_SIZE) {
      alert(`Max ${MAX_BATCH_SIZE} prospects. Your file has ${prospects.length}.`);
      return;
    }

    abortedRef.current = false;
    consecutiveErrorsRef.current = 0;

    const batchJobs: BatchJob[] = prospects.map((p, i) => ({
      id: `batch_${Date.now()}_${i}`, ...p, status: "pending",
    }));

    setJobs(batchJobs);
    setIsUploading(true);

    // Process with CONCURRENCY parallel workers using a queue
    const queue = [...batchJobs];
    async function worker() {
      while (queue.length > 0) {
        if (abortedRef.current) break;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) break;
        const job = queue.shift();
        if (!job) break;
        await processJob(job);
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, batchJobs.length) }, () => worker());
    await Promise.all(workers);

    setIsUploading(false);
    onBatchComplete?.();
  }, [processJob, onBatchComplete]);

  const stopBatch = useCallback(() => {
    abortedRef.current = true;
    setIsUploading(false);
    setJobs((prev) => prev.map((j) => j.status === "pending" || j.status === "running"
      ? { ...j, status: "error", result: { error: "Stopped by user" } } : j));
  }, []);

  const downloadResults = useCallback(() => {
    const completed = jobs.filter((j) => j.status === "complete" && j.result);
    if (!completed.length) return;
    const csv = [
      ["Name", "Company", "Title", "Confidence", "Hook", "Draft"].join(","),
      ...completed.map((j) => [
        j.name, j.company, j.title || "",
        j.result?.confidenceTier || "",
        `"${(j.result?.hookSummary || "").replace(/"/g, '""')}"`,
        j.result?.draftProduced ? "Yes" : "No",
      ].join(",")),
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
  const runningCount = jobs.filter((j) => j.status === "running").length;

  // Idle
  if (!isUploading && jobs.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
        >
          <Upload className="h-4 w-4" />
          Upload CSV
        </button>
        <span className="text-[10px] text-muted-foreground">name, company, title</span>
      </div>
    );
  }

  const pct = jobs.length ? Math.round(((completedCount + errorCount) / jobs.length) * 100) : 0;

  return (
    <Card className="w-80">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Batch Processing</CardTitle>
          {isUploading && (
            <button onClick={stopBatch} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive">
              <Square className="h-2.5 w-2.5" /> Stop
            </button>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              {isUploading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  {runningCount} running · {completedCount} done · {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
                </span>
              ) : (
                <span>{completedCount} done{errorCount > 0 && `, ${errorCount} failed`}</span>
              )}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-0 p-0">
        {/* Per-job list, scrollable */}
        <div className="max-h-48 overflow-y-auto divide-y divide-border/50 px-4 pb-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center gap-2 py-1.5">
              {job.status === "complete" && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
              {job.status === "error"    && <XCircle className="h-3 w-3 shrink-0 text-red-400" />}
              {job.status === "running"  && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />}
              {job.status === "pending"  && <Clock className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
              <div className="flex-1 min-w-0">
                <div className="truncate text-[11px] font-medium">{job.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{job.company}{job.title ? ` · ${job.title}` : ""}</div>
              </div>
              {job.status === "complete" && job.result?.confidenceTier && (
                <span className="shrink-0 text-[9px] font-medium uppercase text-muted-foreground">{job.result.confidenceTier}</span>
              )}
              {job.status === "error" && job.result?.error && (
                <span className="shrink-0 text-[9px] text-red-400 truncate max-w-[80px]" title={job.result.error}>
                  {job.result.error.slice(0, 30)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        {!isUploading && (
          <div className="flex gap-2 border-t border-border px-4 py-2">
            <Button size="sm" variant="outline" onClick={downloadResults} disabled={completedCount === 0} className="text-xs h-7">
              <Download className="mr-1 h-3 w-3" /> Download
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setJobs([])} className="text-xs h-7">
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
