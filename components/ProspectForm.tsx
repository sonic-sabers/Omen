import type { Prospect } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fixtureOptions = [
  "funding-success",
  "ambiguous-namesake",
  "stale-conflict",
  "layoffs-sensitive",
  "no-signal",
];

interface ProspectFormProps {
  mode: "fixture" | "live";
  fixtureId: string;
  prospect: Prospect;
  running: boolean;
  onModeChange: (mode: "fixture" | "live") => void;
  onFixtureChange: (fixtureId: string) => void;
  onProspectChange: (prospect: Prospect) => void;
  onRun: () => void;
}

// ── Self-check guardrails ────────────────────────────────────────────────────

const COMMON_NAMES = new Set(["john smith","jane smith","michael smith","david smith","chris","alex","jordan","taylor","morgan","casey","jamie"]);

function selfCheck(prospect: Prospect, mode: "fixture" | "live"): {
  errors: string[];
  warnings: string[];
  hints: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hints: string[] = [];

  if (mode === "live") {
    const name = prospect.name.trim();
    const company = prospect.company.trim();

    if (!name) errors.push("Name is required.");
    else if (name.split(" ").length < 2) errors.push("Enter a full name (first + last).");

    if (!company) errors.push("Company is required.");

    if (name && COMMON_NAMES.has(name.toLowerCase())) {
      warnings.push("Common name detected. Add a LinkedIn URL to avoid wrong-person results.");
    }

    if (!prospect.title && !prospect.linkedinUrl) {
      hints.push("Add a job title or LinkedIn URL to improve match accuracy.");
    }

    if (prospect.linkedinUrl && !prospect.linkedinUrl.includes("linkedin.com")) {
      warnings.push("LinkedIn URL doesn't look right. Should contain linkedin.com.");
    }

    if (prospect.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospect.email)) {
      warnings.push("Email address format looks invalid.");
    }
  }

  return { errors, warnings, hints };
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProspectForm(props: ProspectFormProps) {
  const {
    mode,
    fixtureId,
    prospect,
    running,
    onModeChange,
    onFixtureChange,
    onProspectChange,
    onRun,
  } = props;

  const { errors, warnings, hints } = selfCheck(prospect, mode);
  const canRun = errors.length === 0;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <CardTitle>Who do you want to reach?</CardTitle>
        <CardDescription>
          Enter the person's details below and hit Run. Omen will research them and write a message for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="mode" className="text-xs">
            Mode
          </Label>
          <Select
            value={mode}
            onValueChange={(value) => onModeChange(value as "fixture" | "live")}
            disabled={running}
          >
            <SelectTrigger id="mode" className="h-8 text-xs">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixture">Demo mode (uses sample data)</SelectItem>
              <SelectItem value="live">Live mode (searches the web)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {mode === "fixture"
              ? "Uses pre-loaded sample data. Results are the same every time, good for testing."
              : "Searches the web for real info about this person. Results may differ each run."}
          </p>
        </div>

        {mode === "fixture" && (
          <div className="grid gap-1.5">
            <Label htmlFor="fixture" className="text-xs">
              Test scenario
            </Label>
            <Select
              value={fixtureId}
              onValueChange={(v) => v && onFixtureChange(v)}
              disabled={running}
            >
              <SelectTrigger id="fixture" className="h-8 text-xs">
                <SelectValue placeholder="Pick a scenario" />
              </SelectTrigger>
              <SelectContent>
                {fixtureOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="prospect-name" className="text-xs">
            Person's full name
          </Label>
          <Input
            id="prospect-name"
            value={prospect.name}
            placeholder="e.g. Satya Nadella"
            onChange={(e) =>
              onProspectChange({ ...prospect, name: e.target.value })
            }
            disabled={running}
            className="h-8 text-xs"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="prospect-company" className="text-xs">
            Company
          </Label>
          <Input
            id="prospect-company"
            value={prospect.company}
            placeholder="e.g. Microsoft"
            onChange={(e) =>
              onProspectChange({ ...prospect, company: e.target.value })
            }
            disabled={running}
            className="h-8 text-xs"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="prospect-title" className="text-xs">
            Job title <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="prospect-title"
            value={prospect.title ?? ""}
            placeholder="e.g. Chairman and CEO"
            onChange={(e) =>
              onProspectChange({ ...prospect, title: e.target.value })
            }
            disabled={running}
            className="h-8 text-xs"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="prospect-email" className="text-xs">
            Email <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="prospect-email"
            type="email"
            value={prospect.email ?? ""}
            placeholder="e.g. satya@microsoft.com"
            onChange={(e) =>
              onProspectChange({ ...prospect, email: e.target.value })
            }
            disabled={running}
            className="h-8 text-xs"
          />
        </div>

        {/* ── Guardrail feedback ── */}
        {!running && (errors.length > 0 || warnings.length > 0 || hints.length > 0) && (
          <div className="space-y-1">
            {errors.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {e}
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {w}
              </div>
            ))}
            {hints.map((h, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                {h}
              </div>
            ))}
          </div>
        )}

        <div className="sticky bottom-3 z-10 mt-4 rounded-lg border bg-background/95 p-2 shadow-md backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            {running ? (
              "Researching… sit tight"
            ) : canRun ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                All set, ready to run
              </>
            ) : (
              "Fix the issues above first"
            )}
          </div>
          <Button
            onClick={onRun}
            disabled={running || !canRun}
            className="h-9 w-full text-sm font-semibold"
          >
            {running ? "Researching..." : "Research & Write Message"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
