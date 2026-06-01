"use client";

import { useState } from "react";
import type { DraftOutput } from "@/lib/types";
import { Mail, Copy, Check } from "lucide-react";

function LiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function DraftCard({
  draft,
  running = false,
}: {
  draft?: DraftOutput;
  running?: boolean;
}) {
  const [copied, setCopied] = useState<"" | "subject" | "body" | "linkedin">("");

  async function copy(text: string, key: "subject" | "body" | "linkedin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className={`rounded-xl border bg-card p-3 ${draft ? "border-primary/30 shadow-sm shadow-primary/5" : "border-border"}`}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Mail className={`h-3.5 w-3.5 ${draft ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs font-semibold tracking-tight">Draft</span>
        {draft && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700">Ready</span>}
      </div>

      {draft ? (
        <div className="space-y-2">
          {/* Subject */}
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Subject
              </span>
              <CopyButton
                onClick={() => copy(draft.emailSubject, "subject")}
                copied={copied === "subject"}
                disabled={running}
              />
            </div>
            <p className="text-xs font-medium">{draft.emailSubject}</p>
          </div>

          {/* Body */}
          <div className="rounded-lg border border-border bg-muted/30 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Email Body
              </span>
              <CopyButton
                onClick={() => copy(draft.emailBody, "body")}
                copied={copied === "body"}
                disabled={running}
              />
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">{draft.emailBody}</pre>
          </div>

          {/* LinkedIn */}
          <div className="rounded-lg border border-[#0A66C2]/20 bg-[#0A66C2]/5 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <LiIcon className="h-3 w-3 text-[#0A66C2]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#0A66C2]">
                  LinkedIn Message
                </span>
              </div>
              <CopyButton
                onClick={() => copy(draft.linkedinBody, "linkedin")}
                copied={copied === "linkedin"}
                disabled={running}
                blue
              />
            </div>
            <p className="text-xs leading-relaxed">{draft.linkedinBody}</p>
          </div>

          {draft.warning && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              {draft.warning}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No draft generated.</p>
      )}
    </div>
  );
}

function CopyButton({
  onClick,
  copied,
  disabled,
  blue,
}: {
  onClick: () => void;
  copied: boolean;
  disabled: boolean;
  blue?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
        blue
          ? "text-[#0A66C2] hover:bg-[#0A66C2]/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {copied ? (
        <>
          <Check className="h-2.5 w-2.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-2.5 w-2.5" />
          Copy
        </>
      )}
    </button>
  );
}
