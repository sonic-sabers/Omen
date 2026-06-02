export type RuntimeMode = "fixture" | "live";

export interface SalesContext {
  sellerCompany: string;
  offering: string;
  icp: string;
  targetPersona: string;
  painHypotheses: string[];
  proofPoints: string[];
  tone: "direct" | "consultative" | "formal";
}

export interface Prospect {
  name: string;
  company: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
  location?: string;
}

export type StageName = "resolve" | "research" | "extract" | "judge" | "draft";

export interface StageUpdateEvent {
  type: "stage";
  stage: StageName;
  status: "running" | "complete" | "error";
  note?: string;
}

export interface EvidenceSource {
  sourceName: string;
  url: string;
  publishedAt?: string;
  snippet: string;
}

export type SafetyClassification =
  | "mentionable"
  | "usable_but_do_not_mention"
  | "disqualifying";

export interface SelectedSignal {
  summary: string;
  relevanceReason: string;
  personaFitReason: string;
  safety: SafetyClassification;
  sources: EvidenceSource[];
  score: number;
  grade: "A" | "B" | "C" | "D";
}

export interface RejectedSignal {
  summary: string;
  reason: string;
}

export interface DraftOutput {
  emailSubject: string;
  emailBody: string;
  linkedinBody: string;
  warning?: string;
}

export interface ResearchDossier {
  prospect: Prospect;
  salesContext: SalesContext;
  selectedSignal?: SelectedSignal;
  rankedSignals: RankedSignal[];
  rejectedAlternatives: RejectedSignal[];
  riskFlags: string[];
  draft?: DraftOutput;
  fallbackNotes: string[];
}

export interface RunRecord {
  id: string;
  createdAt: string;
  durationMs: number;
  confidenceTier: "HIGH" | "MEDIUM" | "SKIP";
  draftProduced: boolean;
  hookSummary: string;
  dossier: ResearchDossier;
  metrics?: {
    hookSpecificityRate: number;
    groundingFidelity: number;
    honestAbstentionRate: number;
    timeToDraftMs: number;
    signalCount: number;
    personSignalCount: number;
    companySignalCount: number;
    sourcesCount: number;
    claimsWithCitation: number;
    totalClaims: number;
    skipped: boolean;
    skipReason?: string;
  };
}

export interface DossierEvent {
  type: "dossier";
  dossier: ResearchDossier;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface DoneEvent {
  type: "done";
}

export interface MetricsEvent {
  type: "metrics";
  signalTypes: { signalType?: "person" | "company" | "generic" }[];
  confidenceTier: "HIGH" | "MEDIUM" | "SKIP";
  durationMs: number;
}

export type PipelineEvent =
  | StageUpdateEvent
  | DossierEvent
  | ErrorEvent
  | DoneEvent
  | MetricsEvent;

export interface RunInput {
  mode: RuntimeMode;
  fixtureId?: string;
  prospect: Prospect;
  salesContext: SalesContext;
}

export interface ResolvedProspect extends Prospect {
  warnings: string[];
}

export interface RawSource {
  sourceName: string;
  url: string;
  publishedAt?: string;
  snippet: string;
}

export interface SignalCandidate {
  summary: string;
  sources: RawSource[];
  signalType?: "person" | "company" | "generic";
}

export interface ScoreBreakdown {
  freshness: number;
  specificity: number;
  personaRelevance: number;
  businessPainFit: number;
  sourceCredibility: number;
  mentionSafety: number;
}

export interface RankedSignal {
  rank: number;
  summary: string;
  score: number;
  grade: "A" | "B" | "C" | "D";
  safety: SafetyClassification;
  breakdown: ScoreBreakdown;
}
