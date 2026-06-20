# CODE ANATOMY - app/

> Read this when you return after time away and need to re-orient quickly.
> It covers what the product is, where to find things in the code, and why key decisions were made.
> Product strategy lives in `../PRODUCT_STRATEGY.md`; this file is the implementation map.
> Last updated: 2026-06-11

---

## What This Is

This app is evolving from a single-asset valuation cockpit into a local-first AI Investment Committee workspace. It runs as a Next.js web application, stores work in the browser, and uses BYOK provider keys for live AI calls.

The current "analysis cockpit" is now best understood as the thesis detail page. A user can paste rough investment notes, attach files or links, let the model extract a structured intake draft, confirm the extracted fields, and then save thesis memory into `analysis.ic`. If enough valuation figures exist, those confirmed figures also lock into the deterministic valuation engine and trigger the grounded bull/bear debate. If figures are missing, the thesis memory still persists for later.

The product surface now includes:

- Thesis memory: summary, assumptions, thesis breakers, watch items, valuation assumptions, catalysts, open questions, evidence candidates, and conviction.
- Deterministic valuation figures: computed locally from confirmed parameters and injected into prompts as locked facts.
- Decision memory: persisted decisions and rationale on the analysis record.
- Portfolio composition: local portfolio objects with manual holdings, capital weights, deterministic portfolio metrics, portfolio debate, and cross-asset chat.

BYOK still applies. Anthropic, OpenAI, and Gemini keys are stored only in browser localStorage and sent directly from the browser to the provider. Tavily is server-side only through `/api/web-search` when a provider needs the app fallback for search.

---

## File Map

```text
app/
|-- src/
|   |-- app/                         Next.js routing root
|   |   |-- layout.tsx               HTML shell, fonts, metadata
|   |   |-- page.tsx                 "/" route; renders <Workspace />
|   |   |-- globals.css              CSS tokens, component styles, base rules
|   |   |-- workspace.css            Workspace layout styles
|   |   |-- proto/page.tsx           Prototype route
|   |   `-- api/
|   |       |-- web-search/route.ts  POST /api/web-search (Tavily proxy)
|   |       `-- web-fetch/route.ts   POST /api/web-fetch (CORS-bypass URL fetcher)
|   |-- components/
|   |   |-- Workspace.tsx            Root container: analyses, portfolios, create/delete, settings
|   |   |-- AnalysisView.tsx         Thesis detail page: intake confirmation, thesis memory inspector, engine, debate, chat
|   |   |-- PortfolioView.tsx        Portfolio composition, weights, strategist debate, cross-asset chat
|   |   |-- Library.tsx              Sidebar search/filter/list for analyses and portfolios
|   |   |-- Settings.tsx             Provider/key/model config plus backup import/export
|   |   `-- charts.tsx               SVG charts per valuation vertical
|   |-- data/
|   |   |-- fields.ts                UI/intake field metadata for engine parameters
|   |   `-- presets.ts               Seeded presets and vertical parameter types
|   `-- lib/
|       |-- ai/
|       |   |-- registry.ts          Provider registry
|       |   |-- types.ts             AIProvider interface, including runIntake()
|       |   |-- analyze.ts           Research, thesis intake finalization, debate, expert review, portfolio debate
|       |   |-- chat.ts              Streamed grounded follow-up chat
|       |   |-- prompts.ts           Intake, research, debate, chat, and portfolio prompt builders
|       |   |-- schemas.ts           JSON Schemas for intake, debate, and expert review
|       |   |-- grounding.ts         Post-hoc numeric grounding checks
|       |   |-- intakeContext.ts     Intake conversation/link/web-evidence helpers
|       |   |-- report.ts            Templated written report after intake/debate
|       |   |-- personas.ts          Per-vertical and portfolio persona/lens definitions
|       |   |-- content.ts           File/PDF/image content block builder
|       |   |-- pdf.ts               PDF text extraction via pdfjs-dist
|       |   |-- client.ts            Anthropic fetch helpers and model list
|       |   |-- eval/                Offline/live eval fixtures, intake scorecards, improvement log
|       |   `-- providers/
|       |       |-- anthropic.ts      Claude adapter
|       |       |-- openai.ts         OpenAI adapter
|       |       `-- gemini.ts         Gemini adapter
|       |-- domain/
|       |   |-- types.ts            Core types: Analysis, IC primitives, PortfolioAnalysis, Decision, etc.
|       |   `-- ic.ts               IC defaults, asset-type labels, normalization/backfill helpers
|       |-- finance/
|       |   |-- compute.ts          computeMetrics(); single-analysis locked figures
|       |   |-- portfolio.ts        computePortfolioMetrics(); portfolio locked figures
|       |   |-- equities.ts         P/E, DCF, IRR
|       |   |-- ventures.ts         LTV, CAC, runway
|       |   |-- operating.ts        Break-even point
|       |   |-- format.ts           Display formatting
|       |   `-- *.test.ts           Vitest coverage
|       |-- repo/
|       |   |-- db.ts               Dexie schema
|       |   |-- index.ts            Repository API and normalization
|       |   `-- backup.ts           Workspace backup serialization/import parsing
|       |-- storage/index.ts        localStorage adapter for settings and legacy ledger
|       `-- ui/inspectorWidth.ts    Persisted inspector width helpers
|-- public/pdf.worker.min.mjs       pdfjs worker
|-- .env.local.example              TAVILY_API_KEY example
|-- package.json
|-- next.config.ts
|-- tsconfig.json
`-- vitest.config.ts
```

---

## Architecture In One Sentence

The app is a local-first single-page workspace where user-confirmed thesis memory and deterministic valuation figures are saved in IndexedDB, then passed to a configured AI provider as grounded context so the model can interpret and challenge the thesis without inventing lockable numbers.

---

## Data Flow

### Flow 0 - Intake: Messy Notes To Thesis Memory

```text
User pastes notes / links / attachment-backed context
      |
      v
AnalysisView.submitIntake()
      |
      |-- optional link/search enrichment via intakeContext.ts
      v
provider.runIntake()
      |
      v
Model returns structured intake:
  - detected vertical
  - extracted valuation fields
  - thesis draft
      |
      v
finalizeIntake() normalizes/sanitizes output
  - clamp vertical
  - drop unknown parameter keys
  - coerce finite numeric values
  - unit-guard percent_raw fields
  - sanitize thesis lists/evidence candidates
      |
      v
ConfirmCard lets user edit/confirm figures and thesis draft
      |
      v
confirmIntake()
      |
      |-- save confirmed thesis memory to analysis.ic
      |-- if figures exist: computeMetrics() -> locked figures -> runAnalysis()
      `-- if figures do not exist: save thesis memory only; debate waits
```

Intake output is not trusted directly. It is confirm-ready, not locked. Confirmed thesis memory is saved under `analysis.ic.thesis`; confirmed valuation numbers become `analysis.parameters` and `analysis.metrics`.

### Flow 1 - Parameter Changes

```text
User moves a slider or edits a confirmed value
      |
      v
analysis.parameters updated in React state
      |
      v
computeMetrics(vertical, parameters)
      |
      |-- analysis.metrics updated     deterministic locked figures
      `-- chart re-renders             visual only
```

All valuation figures used by debate/chat originate in `computeMetrics()` or `computePortfolioMetrics()`, not from the model.

### Flow 2 - Single-Asset AI Debate

```text
User clicks RUN AI or intake confirms enough figures
      |
      v
getProvider(settings.provider)
      |
      v
Pass 1: runResearch()
  only when allowWebSearch=true or link sources exist
  provider uses native tools or app fallback routes
      |
      v
qualitative research notes
      |
      v
Pass 2: runAnalysis()
  prompt includes locked figures + confirmed thesis memory
  structured output enforced by DEBATE_JSON_SCHEMA
      |
      v
finalizeDebate()
  zips advisory lenses to persona contract
  derives stance from engine metrics
      |
      v
analysis.debate / analysis.advisory / analysis.stance saved to Dexie
```

Research notes are qualitative context only. Locked figures remain the only authoritative numeric source for the debate.

### Flow 3 - Grounded Chat

```text
User sends follow-up
      |
      v
streamChat()
      |
      v
Prompt preamble:
  - locked figures
  - confirmed thesis memory
  - attached context summary
  - prior debate
      |
      v
SSE deltas render incrementally
      |
      v
ChatMessage appended to analysis.chat and saved
```

Portfolio chat mirrors this pattern, but grounds on portfolio metrics plus each member analysis' locked figures.

### Flow 4 - Eval Harness And Safe Self-Improvement

```text
Bad intake / grounding behavior is observed
      |
      v
Convert the failure into an eval case
      |
      v
Pure scorecard checks:
  - ticker detection
  - search query quality
  - search-result relevance
  - required vs forbidden fields
  - visible evidence support
  - scoping vs figures mode
      |
      v
npm test guards deterministic behavior
      |
      v
npm run eval optionally scores live provider behavior
```

The self-improvement loop is intentionally safe and reviewable. It does not
auto-edit prompts, code, or user data. Failed behavior becomes a fixture first;
prompt, retrieval, or parser changes must preserve or improve the scorecard
before they are promoted.

---

## Domain Data Schema

The central object is still `Analysis`, but it now carries IC memory alongside valuation-engine state.

Important distinction:

- `vertical` routes the valuation engine and field set: `"stocks" | "startups" | "conventional"`.
- `assetType` is the IC/product classification: `"public_equity" | "conventional_business" | "startup" | "real_estate" | "crypto" | "macro_view" | "other"`.

```ts
Analysis {
  id
  title
  valuationMode  // "engine" | "manual"
  vertical       // valuation-engine route, nullable
  assetType     // IC/product classification
  assetName
  assetMeta {
    ticker?
    sector?
    currency?
    region?
    dataAsOf?
    source?
  }
  manualMeta    // metadata for manual/private assets
  stockFields[] // provenance tracking for engine figures
  tags
  folderId

  ic {
    thesis {
      summary
      assumptions[]             // { id, text, status, monitor?, createdAt, updatedAt }
      thesisBreakers[]          // { id, text, severity, createdAt }
      watchItems[]              // { id, text, cadence?, createdAt }
      valuationAssumptions[]    // { id, text, source, createdAt }
      catalysts[]               // { id, text, timeframe?, createdAt }
      openQuestions[]           // { id, text, createdAt }
      evidenceCandidates[]      // title/url/note/type/relation/reliability
      conviction                // "low" | "medium" | "high" | null
    }
    review {
      cadence                   // weekly/monthly/quarterly/event_driven
      lastReviewedAt
      nextReviewDue
    }
  }

  parameters                    // vertical-specific engine inputs
  metrics                       // ComputedMetrics from computeMetrics() | null
  debate                        // DebateResult | null
  advisory                      // AdvisoryResult | null
  persona                       // visible expert persona | null
  stance                        // engine-derived stance | null
  expertReview                  // optional second-expert review | null

  sources                       // uploaded files and pasted links
  evidence[]                    // first-class Evidence Locker records
  allowWebSearch
  chat

  decision                      // legacy APPROVE/HOLD/REJECT decision memory
  decisionHistory[]             // append-only ICAction ledger
  model
  status                        // draft/decided/watching/archived
  createdAt
  updatedAt
}
```

`src/lib/domain/ic.ts` owns defaults and normalization for the IC portion:

- `assetTypeForVertical(vertical)` backfills the default asset type.
- `emptyThesisMemory()` creates empty thesis memory.
- `createDefaultICState()` sets default thesis and weekly review state.
- `normalizeICState()` makes old persisted analyses render safely.

Portfolio state is separate. Metrics are computed on demand from `members` plus the referenced analyses, not stored on the portfolio record.

```ts
PortfolioAnalysis {
  id
  title
  members[]       // { analysisId, capital }
  debate
  advisory
  chat
  persona
  stance
}
```

---

## AI Provider System

The AI layer uses provider adapters. UI code calls `getProvider(id)` and then the shared `AIProvider` interface; provider-specific API details stay inside `lib/ai/providers/*`.

```ts
interface AIProvider {
  id
  label
  models
  capabilities(modelId)

  runIntake(req)             // messy notes -> valuation fields + thesis draft
  runAnalysis(req)           // optional research pass -> structured debate
  runExpertReview(req)       // optional second-expert review
  streamChat(req)            // grounded single-asset chat
  runPortfolioAnalysis(req)  // structured portfolio debate
  streamPortfolioChat(req)   // grounded cross-asset chat
}
```

`runIntake()` returns an `IntakeResult` with both sides of the intake draft:

- Valuation setup: detected `vertical`, `mode`, `assetName`, `title`, `fields`, and engine-ready `params`.
- Thesis setup: `summary`, `assumptions`, `thesisBreakers`, `watchItems`, `valuationAssumptions`, `catalysts`, `openQuestions`, and `evidenceCandidates`.

Provider behavior is intentionally concise:

- Anthropic: native structured output, native PDF/image handling, native web tools where used.
- OpenAI: adapter implements the same interface; PDF/web needs app fallbacks where unsupported.
- Gemini: adapter implements the same interface; schema enums are guarded again in finalization because provider schema conversion can weaken enum enforcement.

Capability flags still decide native-vs-fallback paths:

```ts
Capabilities {
  vision
  pdfNative
  webFetchNative
  webSearchNative
}
```

### Eval Harness

`src/lib/ai/eval/` contains two layers:

- P8 grounding harness: fixture analyses, deterministic grounding tests, and an
  optional live debate/chat scorecard.
- Intake harness: fixture prompts such as MBMA/BBCA/GOTO, mocked web evidence,
  pure scoring rules, and a review-only improvement log.

Normal `npm test` runs the offline harness with no network/API keys.
`npm run eval` uses the optional live provider scorecard and soft-skips provider
environment limits.

---

## State And Storage

### React State

`Workspace.tsx` owns the live list of analyses, portfolios, the active item, settings modal state, and debounced saves. `AnalysisView.tsx` owns the active thesis-detail UI state: intake draft, confirmation card, chat streaming, inspector width, review/debate loading, source drafts, and decision form state.

### localStorage

Managed by `src/lib/storage/index.ts`.

| Key | Contents |
|---|---|
| `jp_settings` | Provider, API keys, selected model |
| `jp_ledger` | Legacy ledger entries; superseded by `Analysis.decision` |

### Dexie / IndexedDB

Managed by `src/lib/repo/`. Database name: `jp-workspace`.

| Table | Stores |
|---|---|
| `analyses` | Full `Analysis` records, including IC memory, debate, chat, sources, decision |
| `portfolios` | `PortfolioAnalysis` records |
| `folders` | Folder hierarchy data; schema exists but UI is not exposed |
| `blobs` | Uploaded file bytes |

The repository normalizes old records on read, so the Dexie schema has not needed a version bump for newer fields like `assetType`, `ic`, `persona`, `stance`, or current portfolio member shape.

---

## Finance Engine

The finance engine turns confirmed parameters into locked figures before any AI call.

`computeMetrics(vertical, parameters)` is the single-analysis entry point. It returns a serializable `ComputedMetrics` object with flat metric rows: `key`, `label`, numeric `value`, formatted `display`, and optional `verdict`.

| File | Formulas | Used by |
|---|---|---|
| `equities.ts` | P/E, DCF, IRR | Stocks vertical |
| `ventures.ts` | LTV:CAC, CAC payback, runway | Startups vertical |
| `operating.ts` | Break-even point | Conventional vertical |
| `portfolio.ts` | Total capital, weights, vertical allocation, concentration, stance mix | Portfolio view |

These functions are pure and testable. Their outputs are the numeric grounding layer for prompts and post-hoc grounding checks.

---

## Source Directory Index

| Directory / File | Touch when... |
|---|---|
| `src/components/Workspace.tsx` | Changing root layout, active item routing, new analysis/portfolio creation, persistence wiring |
| `src/components/AnalysisView.tsx` | Changing thesis intake, confirm card, thesis memory inspector, valuation controls, debate, chat, decision UI |
| `src/components/PortfolioView.tsx` | Changing portfolio composition, weights, portfolio debate, cross-asset chat |
| `src/components/Library.tsx` | Changing sidebar search/filter/list behavior |
| `src/components/Settings.tsx` | Changing provider settings or backup import/export UI |
| `src/data/fields.ts` | Changing engine field definitions shown in sliders/intake confirmation |
| `src/data/presets.ts` | Changing seeded examples or vertical parameter types |
| `src/lib/domain/types.ts` | Adding or changing Analysis, IC primitives, PortfolioAnalysis, Decision, source, or chat types |
| `src/lib/domain/ic.ts` | Changing IC defaults, asset-type labels, or persisted IC normalization |
| `src/lib/ai/types.ts` | Adding provider methods, request types, or capability flags |
| `src/lib/ai/analyze.ts` | Changing intake finalization, research/debate orchestration, expert review, or portfolio debate |
| `src/lib/ai/prompts.ts` | Editing intake, thesis-memory grounding, debate, chat, or portfolio prompts |
| `src/lib/ai/schemas.ts` | Changing structured intake/debate/review JSON schemas |
| `src/lib/ai/intakeContext.ts` | Changing link/search enrichment for intake |
| `src/lib/ai/grounding.ts` | Changing numeric grounding lint rules |
| `src/lib/ai/eval/*` | Adding regression cases, intake scorecards, grounding fixtures, or improvement-log entries |
| `src/lib/ai/providers/*` | Changing provider-specific API calls |
| `src/lib/finance/compute.ts` | Changing single-analysis locked metrics |
| `src/lib/finance/portfolio.ts` | Changing portfolio locked metrics |
| `src/lib/repo/db.ts` | Changing Dexie tables or indexes |
| `src/lib/repo/index.ts` | Changing create/read/save/delete behavior or normalization |
| `src/lib/repo/backup.ts` | Changing import/export envelope format |
| `src/app/api/web-search/route.ts` | Changing Tavily search behavior |
| `src/app/api/web-fetch/route.ts` | Changing URL fetch behavior |

---

## Design Decisions

**Locked figures remain deterministic.** The app still prevents numeric hallucination by computing valuation metrics locally and injecting those metrics into prompts as hard facts. The model may interpret, challenge, and contextualize; it must not author lockable figures.

**Intake is confirm-ready, not trusted.** `runIntake()` can read messy notes and produce a draft, but `finalizeIntake()` sanitizes it and the user confirms before anything becomes thesis memory or valuation input.

**Thesis memory is separate from lockable valuation facts.** `analysis.ic.thesis` can store user-confirmed beliefs, assumptions, breakers, and evidence candidates. Those items ground reasoning, but they are not treated as audited valuation figures.

**Provider adapters keep BYOK flexible.** Anthropic, OpenAI, and Gemini expose one interface even though their native PDF, web, and structured-output behavior differs.

**Dexie stays the local-first system of record.** IndexedDB stores analyses, portfolios, files, chat, decisions, and IC memory. Normalization code lets older records survive shape changes.

**Portfolio composition uses the same grounding philosophy.** Portfolio weights and concentration are computed from explicit capital inputs, then used to ground portfolio debate and chat.

**Self-improvement is fixture-first.** A bad model or retrieval result should be
captured as an eval case before changing prompts or parsers. The harness scores
candidate changes; it does not autonomously rewrite the system.

---

## Roadmap Status

**Already working:**

- Full three-vertical valuation sandbox with deterministic metrics and charts.
- Frictionless thesis intake: paste messy notes, extract figures plus thesis draft, confirm before saving.
- IC primitives in storage: `assetType`, thesis memory, assumptions, breakers, watch items, valuation assumptions, catalysts, open questions, evidence candidates, conviction, and review state.
- Thesis memory inspector in the analysis detail page.
- Live AI debate via Anthropic, OpenAI, and Gemini provider adapters.
- Context sources: PDF upload, image upload, link paste.
- Web research through native tools or `/api/` fallbacks.
- Grounded follow-up chat with numeric grounding checks.
- Optional second-expert review.
- Portfolio composition: manual holdings, capital weights, deterministic portfolio metrics, strategist debate, and cross-asset chat.
- Full local persistence for analyses, portfolios, chat, decisions, sources, blobs, and IC memory.
- Settings: provider, BYOK key, model selector, and workspace backup import/export.
- Offline intake/grounding eval harness plus optional live provider scorecards.
- Review-only improvement log linking observed failures to regression cases.
- Manual Private Asset IC Entry without pretending automated data coverage exists.
- Stock Intake Trust + Field Provenance with confirm-before-lock checking.
- Evidence Locker workflow with durable records and thesis linkage.
- Watchlist IC Agenda + Assumption Monitoring surfacing review-due, stale, contradiction, and drift signals.
- Append-only Decision Ledger + Review Loop.
- IC Chair Triage + Everyday-User Front Door to route temporary broad questions vs. saved review cases.

**Still incomplete / product gaps:**

- In-app feedback inbox / user-facing improvement queue; the current self-improvement loop is developer-facing fixtures only.
- Folder organization UI, despite the schema existing.
- Data import from CSV/XLSX or official financial statement extraction.
- Shareable investment memo/report export beyond workspace backup.
- Auth, sync, scheduled monitoring, and cloud backup.
