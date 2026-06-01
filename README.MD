# Omen — Smart Sales Research

**Omen** is an AI-powered B2B sales intelligence tool that researches a prospect online, scores the best outreach signal, and generates a ready-to-send personalised message — all in one pipeline run.

---

## How It Works

A single run flows through five sequential stages:

```
Resolve → Research → Extract → Judge → Draft
```

| Stage        | What it does                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resolve**  | Normalises prospect identity and gates on confidence (HIGH / MEDIUM / LOW). Blocks runs with too little info (Gate 1).                                                                                                          |
| **Research** | Searches the web via Tavily for recent, relevant signals about the prospect and their company. Blocks if nothing found (Gate 2).                                                                                                |
| **Extract**  | Uses Claude to parse raw search snippets into structured signal candidates, classified as `person`, `company`, or `generic`. Generic signals are dropped as noise.                                                              |
| **Judge**    | Scores every candidate across six weighted dimensions (freshness, specificity, persona relevance, business-pain fit, source credibility, mention safety), applies archetype-tier multipliers, and selects the best safe signal. |
| **Draft**    | If the overall confidence verdict is HIGH or MEDIUM, Claude writes a personalised email subject + body + LinkedIn note grounded only in the selected signal (Gate 3).                                                           |

Events stream back to the UI in real-time via **Server-Sent Events (SSE)**.

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

An **archetype multiplier** (T1–T5) is applied based on signal type:

| Tier | Signal Example                          | Multiplier |
| ---- | --------------------------------------- | ---------- |
| T1   | New exec hire, funding round            | 1.32×      |
| T2   | Acquisition, M&A, AP hiring             | 1.14×      |
| T3   | Product launch, earnings, press release | 0.98×      |
| T4   | Conference / speaker                    | 0.79×      |
| T5   | Podcast, LinkedIn post                  | 0.67×      |

Final grades: **A** ≥ 24, **B** ≥ 18, **C** ≥ 12, **D** < 12. Signals below 13 points are not selected.

---

## Confidence & Gates

Three gates prevent low-quality drafts from being produced:

- **Gate 1 (Resolve)** — blocks if prospect identity confidence is `LOW` (no company + no disambiguator).
- **Gate 2 (Research)** — skips draft if no web sources are found for the prospect.
- **Gate 3 (Draft)** — only generates outreach copy when the overall confidence verdict is `HIGH` or `MEDIUM`.

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
