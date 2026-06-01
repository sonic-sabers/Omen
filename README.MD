# Omen — Smart Sales Research

**Omen** is an AI-powered B2B sales intelligence tool that researches a prospect online, scores the best outreach signal, and generates a ready-to-send personalised message — all in one pipeline run.

---

## How It Works

A single run flows through five sequential stages:

```
Resolve → Research → Extract → Judge → Draft
```

Each stage streams a real-time status event (`running` → `complete` | `error`) back to the browser via **Server-Sent Events (SSE)**, so the UI updates live as each stage finishes.

### Stage 1 — Resolve

Normalises and validates the prospect's identity before any external call is made.

- Trims whitespace from all fields
- Scores identity confidence as **HIGH**, **MEDIUM**, or **LOW** based on:
  - Full name + company + at least one disambiguator (title / LinkedIn URL / location) → **HIGH**
  - Full name + company only → **MEDIUM**
  - Missing company or only a first name → **LOW**
- Detects common/ambiguous names (e.g. "John Smith") and flags them unless a LinkedIn URL is present
- **Gate 1**: if confidence is `LOW`, the run stops here with a descriptive error. No API calls are made.

### Stage 2 — Research

Fires **10 parallel Tavily searches** across distinct signal categories to maximise coverage:

| Category           | Example query                                      |
| ------------------ | -------------------------------------------------- |
| News / press       | `{name} {company} news press release announcement` |
| Funding            | `{name} {company} funding investment series`       |
| M&A                | `{name} {company} acquisition merger partnership`  |
| Executive movement | `{name} {title} appointed hired joined promoted`   |
| Media / podcasts   | `{name} podcast interview keynote speaker`         |
| Conferences        | `{name} conference talk presentation webinar`      |
| Company hiring     | `{company} hiring expansion growth`                |
| Product signals    | `{company} product launch release announcement`    |
| LinkedIn (direct)  | `{name} {company} site:linkedin.com`               |
| LinkedIn (profile) | `{name} {company} linkedin profile`                |

Results are deduplicated by URL, then truncated to a max of 20 sources / 12,000 characters before being passed downstream (to keep LLM costs predictable).

**Gate 2**: if zero sources are found after deduplication, the pipeline yields a partial dossier with fallback notes and stops — no extract, judge, or draft stage runs.

### Stage 3 — Extract

Converts raw search snippets into structured **signal candidates**.

- In **live mode**: Claude is asked to identify concrete, outreach-worthy events from the source snippets and return them as JSON (`summary`, `sourceIndexes`, `signalType`).
- Each candidate is classified as one of:
  - `person` — about the specific individual (highest value)
  - `company` — about their organisation (useful but lower specificity)
  - `generic` — industry noise (dropped immediately)
- Candidates flagged as `unverified` or `rumor` are filtered out before Claude sees them (stale content older than 2 years is also dropped).
- In **fixture mode**: the LLM call is skipped; a deterministic keyword-based fallback extracts candidates directly from snippets.

### Stage 4 — Judge

Scores every candidate and picks the single best safe signal.

Each candidate receives a score out of **30** across six weighted dimensions, then an archetype-tier multiplier is applied (see [Signal Scoring](#signal-scoring) below). Signals older than 180 days receive a 0.74× stale penalty.

Safety classification happens before selection:

| Classification              | Meaning                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `mentionable`               | Safe to reference directly in outreach                      |
| `usable_but_do_not_mention` | Context is useful but must not be cited (e.g. layoffs)      |
| `disqualifying`             | Contains scandal, fraud, unverified rumor — vetoed entirely |

In **live mode** Claude also performs a final relevance + persona-fit check to confirm the selection. The chosen signal must score ≥ 13 and not be `disqualifying`.

A **confidence verdict** (`HIGH` / `MEDIUM` / `SKIP`) is then calculated from:

- Identity confidence (from Stage 1)
- Number of sources found
- Selected signal grade and score
- Count of risk flags

### Stage 5 — Draft

Generates three pieces of personalised copy grounded **only** in the selected signal:

- **Email subject** (≤ 140 chars)
- **Email body** (≤ 1,600 chars)
- **LinkedIn message** (≤ 500 chars)

**Gate 3**: drafts are only produced when confidence is `HIGH` or `MEDIUM`. A `SKIP` verdict yields a dossier with no draft and a clear explanation of why.

If the signal's safety is `usable_but_do_not_mention`, the draft avoids referencing it directly and a warning is attached to the output.

---

## Pipeline Outcome Flows

Not every run follows the happy path. Here are all the flows the pipeline handles:

```
Input
  │
  ▼
[Resolve]
  ├─ LOW confidence ──────────────────────────────► Gate 1 BLOCKED (no further stages)
  │
  ▼
[Research]
  ├─ 0 sources found ─────────────────────────────► Gate 2 SKIP  (partial dossier, no draft)
  │
  ▼
[Extract]
  │  (all candidates filtered as noise/generic)
  ├─ 0 valid candidates ──────────────────────────► Judge returns empty → Gate 3 SKIP
  │
  ▼
[Judge]
  ├─ All candidates disqualifying / below threshold ► Gate 3 SKIP (dossier, no draft)
  ├─ Best signal is usable_but_do_not_mention ─────► Draft generated, warning attached
  │
  ▼
[Draft]
  ├─ Confidence = HIGH ────────────────────────────► Full draft  (email + LinkedIn)
  ├─ Confidence = MEDIUM ──────────────────────────► Full draft  (email + LinkedIn)
  └─ Confidence = SKIP ────────────────────────────► Gate 3 SKIP (dossier only, no draft)
```

Every path — including all gate failures — produces a **dossier** event with whatever was found, so the UI always has something to render and the user understands what happened.

---

## Batch Processing

Beyond the single-prospect UI, Omen supports bulk runs via `POST /api/batch`.

Each request processes **one prospect** (name + company + optional fields) through the full live pipeline and returns a compact summary:

```json
{
  "id": "run_1717..._abc123",
  "confidenceTier": "HIGH",
  "hookSummary": "Recent Series B funding signals active growth...",
  "draftProduced": true
}
```

The dashboard's **CSV upload** feature uses this endpoint — it reads a CSV file, fires one `/api/batch` request per row, and refreshes the run table when all complete.

---

## Metrics

Every completed run automatically compiles the following metrics, visible in the dashboard:

| Metric                     | What it measures                                                             |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Hook Specificity Rate**  | % of signals that are person-level (vs company-level)                        |
| **Grounding Fidelity**     | % of claims in the selected signal that trace back to a cited source         |
| **Honest Abstention Rate** | Whether the pipeline correctly skipped thin-signal runs (vs drafting anyway) |
| **Time to Draft**          | End-to-end wall-clock duration for the run                                   |
| **Signal Breakdown**       | Count of person / company signals extracted                                  |

---

## Storage

Run records are kept **in-memory** on the server (no database required):

- Max **200 runs** stored at once; oldest are evicted when the cap is hit.
- Each record expires after **30 days**.
- Records survive as long as the Next.js server process is running. A server restart clears all history.

---

## Rate Limiting

All API routes are protected by a **sliding-window IP-based rate limiter** (no external dependency):

| Route             | Window | Max requests | Block duration |
| ----------------- | ------ | ------------ | -------------- |
| `POST /api/run`   | 60s    | 10           | 60s            |
| `POST /api/batch` | 60s    | 60           | 30s            |
| `GET /api/runs`   | 60s    | 60           | 30s            |

Blocked responses return HTTP 429 with a `Retry-After` header. The `?limit` parameter on `/api/runs` is also capped at 200 to prevent bulk data scraping.

`/api/run` additionally enforces a **per-session concurrency lock** — only one active pipeline run per browser session at a time.

---

## Tech Stack

- **Framework** — [Next.js](https://nextjs.org/) 16 (App Router, React 19)
- **AI** — [Anthropic Claude](https://www.anthropic.com/) (`claude-sonnet-4-6` by default) via `@anthropic-ai/sdk`
- **Web search** — [Tavily](https://tavily.com/) search API
- **Validation** — [Zod](https://zod.dev/) for all LLM response parsing
- **UI** — Tailwind CSS, shadcn/ui, Lucide icons
- **Testing** — [Vitest](https://vitest.dev/)

---

## Project Structure

```
app/
  page.tsx              # Main prospect form + live dossier view
  dashboard/page.tsx    # Run history dashboard
  api/
    run/                # POST /api/run   — starts a pipeline run (SSE stream)
    runs/               # GET  /api/runs  — fetches run history
    batch/              # POST /api/batch — batch-process multiple prospects

lib/
  pipeline/
    index.ts            # Orchestrates all five stages
    resolve.ts          # Stage 1 — identity resolution & Gate 1
    research.ts         # Stage 2 — Tavily web search & Gate 2
    extract.ts          # Stage 3 — LLM signal extraction
    judge.ts            # Stage 4 — scoring, ranking, Gate 3 verdict
    draft.ts            # Stage 5 — outreach copy generation
  anthropic.ts          # Shared Claude client wrapper
  config.ts             # Scoring weights, budgets, default sales context
  types.ts              # All shared TypeScript types
  schemas.ts            # Zod schemas for LLM responses

components/
  ProspectForm.tsx      # Prospect input form
  SalesContextForm.tsx  # Editable sales context (offering, ICP, tone…)
  ResearchDossier.tsx   # Dossier result viewer
  StatusTimeline.tsx    # Real-time stage progress
  DashboardTable.tsx    # Run history table
  BatchUpload.tsx       # CSV batch upload UI

tests/
  lib/pipeline/         # Unit tests for pipeline stages
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- An **Anthropic API key**
- A **Tavily API key**

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd omen
npm install

# 2. Configure environment
cp .env.example .env
# Fill in your keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   TAVILY_API_KEY=tvly-...
#   ANTHROPIC_MODEL=claude-sonnet-4-6   (optional, this is the default)

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable            | Required | Description                                        |
| ------------------- | -------- | -------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Yes      | Anthropic API key for Claude                       |
| `TAVILY_API_KEY`    | Yes      | Tavily search API key                              |
| `ANTHROPIC_MODEL`   | No       | Claude model to use (default: `claude-sonnet-4-6`) |

---

## Running Modes

The UI exposes two modes selectable in the prospect form:

- **Live** — performs real Tavily searches and Claude LLM calls (consumes API credits).
- **Fixture** — uses pre-recorded search results from `tests/fixtures/` for fast, free development and testing.

---

## Signal Scoring

Signals are scored out of **30 points** across six dimensions with the following weights:

| Dimension          | Weight |
| ------------------ | ------ |
| Persona Relevance  | 27%    |
| Business Pain Fit  | 21%    |
| Specificity        | 19%    |
| Freshness          | 17%    |
| Source Credibility | 9%     |
| Mention Safety     | 7%     |

An **archetype multiplier** (T1–T5) rewards high-intent events and discounts weak ones:

| Tier | Signal Example                          | Multiplier | Why                                                                                               |
| ---- | --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| T1   | New exec hire, funding round            | **2.0×**   | Strongest buying trigger — new leadership and fresh capital directly create new vendor decisions. |
| T2   | Acquisition, M&A, AP hiring             | **1.5×**   | High-urgency structural change that surfaces budget and tooling needs within weeks.               |
| T3   | Product launch, earnings, press release | **1.0×**   | Baseline signal — public and relevant but common enough to be table stakes.                       |
| T4   | Conference / speaking engagement        | **0.75×**  | Soft signal — shows industry engagement but no clear purchase intent.                             |
| T5   | Podcast, LinkedIn post, tweet           | **0.5×**   | Weakest signal — thought leadership activity with no direct business-change indicator.            |

Final grades: **A** ≥ 24, **B** ≥ 18, **C** ≥ 12, **D** < 12. Signals below 13 points are not selected.

---

## Confidence & Gates

Three gates prevent low-quality drafts from being produced:

- **Gate 1 (Resolve)** — blocks if prospect identity confidence is `LOW` (no company + no disambiguator).
- **Gate 2 (Research)** — skips draft if no web sources are found for the prospect.
- **Gate 3 (Draft)** — only generates outreach copy when the overall confidence verdict is `HIGH` or `MEDIUM`.

---

## Research Foundation — InterDeepResearch

Omen's dossier UX is informed by the principles in:

> **InterDeepResearch: Enabling Human-Agent Collaborative Information Seeking through Interactive Deep Research**
> Bo Pan, Lunke Pan, Yitao Zhou, Qi Jiang, Zhen Wen, Minfeng Zhu, Wei Chen
> arXiv:2603.12608 · CC BY 4.0
> https://arxiv.org/abs/2603.12608

The paper argues against the "autonomous query-to-report" paradigm — where an AI agent silently produces a finished output and the user is left as a passive consumer. Instead it proposes embedding the user as an **active collaborator** who can observe, inspect, and steer the research process at every step.

### How Omen implements these principles

| InterDeepResearch principle | How Omen implements it |
| --- | --- |
| **Transparency in reasoning** | Every signal displays a 6-dimension score breakdown (persona fit, business trigger, specificity, freshness, source credibility, mention safety) so the user understands *why* a signal scored the way it did |
| **Evidence provenance** | Each source shows its name, publication date with a freshness colour (green < 2 weeks, amber < 3 months, red older), a snippet preview, and a direct link to the original URL |
| **Steering / human override** | Any ranked signal can be **pinned** by the user to override the agent's selection — the dossier and draft regenerate against the pinned signal |
| **Rejected alternatives with reasons** | Every signal that was considered but not chosen is shown with its score and the specific reason it was not selected (rank, grade, safety classification) |
| **Honest abstention** | Pipeline explicitly skips draft generation when evidence is thin, identity is ambiguous, or all signals are below threshold — with a plain-language explanation |
| **Process observability** | The real-time stage timeline (Resolve → Research → Extract → Judge → Draft) is visible and expandable while the pipeline runs, so the user sees the research path, not just the final output |
| **Safety classification** | Every signal is classified (`mentionable` / `usable_but_do_not_mention` / `disqualifying`) and the draft copy is constrained by that classification |

### Key design takeaway from the paper

> *"Do not just show the final outreach copy. Show the research path: what was found, what was selected, what was rejected, and why."*

This is why the Omen dossier exposes five distinct sections — Selected Signal, Draft, All Ranked Signals, Rejected Signals, and Evidence Sources — rather than surfacing only the generated message.

---

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm run test       # Run tests (Vitest)
npm run test:watch # Run tests in watch mode
```
