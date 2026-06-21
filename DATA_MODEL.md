# Data Model - AI Investment Workspace

The product is now a local-first AI Investment Committee workspace. The central
object remains `Analysis`, but an analysis is now a saved thesis-detail record:
it carries investment committee memory, deterministic valuation figures or
manual asset metadata, context sources, first-class evidence, saved-review
lifecycle state, AI debate/chat where applicable, and append-only decision
history.

Persistence: Dexie / IndexedDB in the browser. The app stores everything locally
behind repository helpers so a server-backed implementation can be added later
without rewriting the UI.

## Core Distinctions

```ts
type Vertical = "stocks" | "startups" | "conventional";

type AssetType =
  | "public_equity"
  | "conventional_business"
  | "startup"
  | "real_estate"
  | "crypto"
  | "macro_view"
  | "other";

type ValuationMode = "engine" | "manual";
type AnalysisReviewMode = "kickoff" | "fact_check" | null;
```

- `vertical` routes the deterministic valuation engine and field set.
- `assetType` is the IC/product classification. It is broader than the current
  valuation engine and is the bridge toward manual private/alternative assets.
- `valuationMode` distinguishes deterministic engine-backed reviews from
  manual/private saved work.
- `reviewMode` tracks whether a saved review is still in kickoff or fact-check
  before grounded review is ready.

## Explore And Saved Review Boundary

The app now has an explicit boundary between temporary exploration and saved
workspace state.

Temporary Explore state is not persisted as an `Analysis`. Broad, private, and
business prompts stay temporary through guided exploration and a deeper
follow-up stage before save actions appear.

Relevant temporary contracts:

```ts
type TriageMode = "casual" | "broad_screen" | "direct_asset";

interface ExploreDirection {
  id: string;
  title: string;
  assetName: string;
  assetType: AssetType;
  ticker?: string;
  thesisAngle: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  nextQuestions: string[];
}

interface ExploreResult {
  summary: string;
  directions: ExploreDirection[];
}

interface ExploreDeeperResult {
  directionId: string;
  summary: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  evidenceToCheck: string[];
  decisionQuestions: string[];
}
```

Save boundary rules:

- first direction pick is still temporary
- only deeper exploration unlocks `Start review` / `Save to watchlist`
- saving from Explore creates a normal `Analysis` record
- the raw Explore prompt is carried forward as one unverified
  `Imported from Exploration` evidence item
- selected direction framing seeds thesis summary, risks, and open questions
- Explore output does not write directly into `chat`

## IC Thesis Memory

Each analysis carries `ic: ICState`.

```ts
type ReviewCadence = "weekly" | "monthly" | "quarterly" | "event_driven";
type ConvictionLabel = "low" | "medium" | "high";
type EvidenceRelation = "supporting" | "contradictory" | "neutral" | "unresolved";
type EvidenceReliability = "official" | "third_party" | "user_provided" | "unknown";

interface ThesisMemory {
  summary: string;
  assumptions: ThesisAssumption[];
  thesisBreakers: ThesisBreaker[];
  watchItems: WatchItem[];
  valuationAssumptions: ValuationAssumption[];
  catalysts: Catalyst[];
  openQuestions: OpenQuestion[];
  evidenceCandidates: EvidenceCandidate[];
  conviction: ConvictionLabel | null;
}

interface ReviewState {
  cadence: ReviewCadence;
  lastReviewedAt: number | null;
  nextReviewDue: number | null;
}

interface ICState {
  thesis: ThesisMemory;
  review: ReviewState;
}
```

Current scope:

- Thesis memory is first-class on `Analysis`.
- Evidence Locker records are first-class on `Analysis`, with legacy thesis
  `evidenceCandidates` normalized for compatibility.
- Review cadence feeds the implemented IC Agenda and assumption-monitoring
  read model.
- Explore-originated kickoff seeding can prefill thesis summary, risks, and
  open questions, but that carry-forward stays unverified until fact-checking.

## Analysis

```ts
type DecisionAction = "APPROVE" | "HOLD" | "REJECT"; // legacy
type AnalysisStatus = "draft" | "decided" | "watching" | "archived";
type ICAction =
  | "no_action"
  | "watch"
  | "research_more"
  | "increase_conviction"
  | "decrease_conviction"
  | "add_increase_position"
  | "trim_reduce_position"
  | "exit"
  | "archive";

interface Decision {
  action: DecisionAction;
  rationale: string;
  decidedAt: number;
}

interface DecisionEntry {
  id: string;
  decidedAt: number;
  action: ICAction | null;
  legacyAction?: DecisionAction;
  rationale: string;
  preMortem?: string;
  trigger: { dueAt: number; note: string } | null;
  snapshot: DecisionSnapshot;
  review: DecisionOutcomeReview | null;
}

interface Analysis {
  id: string;
  title: string;
  valuationMode: ValuationMode;
  vertical: Vertical | null;
  assetType: AssetType;
  assetName: string;
  assetMeta: AssetMeta;
  manualMeta: AnalysisManualMeta | null;
  stockFields?: StockFieldRecord[];
  tags: string[];
  folderId: string | null;

  ic: ICState;

  parameters: AssetParameters;
  metrics: ComputedMetrics | null;

  debate: DebateResult | null;
  advisory: AdvisoryResult | null;
  persona: PersonaRef | null;
  stance: Stance | null;
  expertReview: ExpertReview | null;

  sources: ContextSource[];
  evidence: EvidenceItem[];
  allowWebSearch: boolean;
  chat: ChatMessage[];
  reviewMode?: AnalysisReviewMode;

  decision: Decision | null;
  decisionHistory: DecisionEntry[];
  model: string;
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
}
```

Current analysis-state rules:

- engine-backed public-equity reviews usually progress through
  `kickoff -> fact_check -> review`
- direct asset starts can open directly in `fact_check`
- Explore-originated broad/private/business saves open in `kickoff`
- when a grounded debate is ready, `reviewMode` returns to `null`
- manual/private analyses use the same `Analysis` record but keep
  `valuationMode: "manual"`, `vertical: null`, and `metrics: null`

`Decision` is legacy read-compatibility only. The user-facing workflow writes
`decisionHistory`. Legacy approve/hold/reject records normalize into a
legacy-only history entry without inventing decision-time snapshots.

Analysis status is derived from the newest decision history entry:

- no entries -> `draft`
- latest `watch` -> `watching`
- latest `archive` -> `archived`
- any other current IC action -> `decided`

## Saved Review Lifecycle

Saved reviews have a visible lifecycle even though only `kickoff` and
`fact_check` persist directly on the record.

```ts
type ReviewSurfaceMode = "kickoff" | "fact_check" | "review";
```

Lifecycle behavior:

- `kickoff`: saved handoff state that explains what Explore carried forward and
  what the user should do next
- `fact_check`: concrete notes/ticker/evidence intake plus explicit
  `ConfirmCard` review of extracted facts
- `review`: grounded saved-analysis mode after required fact-checking / debate

`ConfirmCard` is user-triggered. It appears only after explicit `Check the
facts` action or concrete submission, not from passive screen state alone.

## Deterministic Metrics

```ts
interface Metric {
  key: string;
  label: string;
  value: number;
  display: string;
  verdict?: string;
}

interface ComputedMetrics {
  vertical: Vertical;
  metrics: Metric[];
}
```

All valuation figures used by debate/chat originate from deterministic engine
functions, not from the model:

- Single-asset metrics: `computeMetrics(vertical, parameters)`.
- Portfolio metrics: `computePortfolioMetrics(members, byId)`.

Model outputs may interpret and challenge locked figures; they must not author
lockable numbers.

Manual/private analyses are intentionally outside this deterministic engine
path. They preserve thesis memory, evidence, cadence, and decisions without
pretending to have computed valuation metrics.

## Context Sources

```ts
type ContextSource =
  | {
      id: string;
      kind: "file";
      name: string;
      mime: string;
      fileKind: "image" | "pdf";
      blobId: string;
      extractedText?: string;
      createdAt: number;
    }
  | {
      id: string;
      kind: "link";
      url: string;
      title?: string;
      createdAt: number;
    };
```

Files are stored as blobs in IndexedDB. Links and web research use native provider
tools where available or the app's server-side `/api/web-fetch` and
`/api/web-search` routes.

Explore-originated saved reviews can also begin with one transcript-style
evidence item:

```ts
EvidenceItem {
  title: "Imported from Exploration";
  type: "transcript";
  relation: "unresolved";
  reliability: "user_provided";
  note: string; // raw Explore prompt
}
```

## Portfolio

```ts
interface PortfolioMember {
  analysisId: string;
  capital: number;
}

interface PortfolioAnalysis {
  id: string;
  title: string;
  members: PortfolioMember[];
  tags: string[];
  folderId: string | null;
  chat: ChatMessage[];
  allowWebSearch: boolean;
  persona: PersonaRef | null;
  stance: Stance | null;
  debate: DebateResult | null;
  advisory: LensResult[] | null;
  decisionHistory: DecisionEntry[];
  createdAt: number;
  updatedAt: number;
}
```

Portfolio metrics are derived from member capital and referenced analyses. The
portfolio record stores composition and AI outputs, while metrics are recomputed
for grounding. Portfolio decision/status badges are derived from
`decisionHistory`; `PortfolioAnalysis` does not store a separate `status` field.

## Dexie Tables

| Table | Primary key | Indexes |
|---|---|---|
| `analyses` | `id` | `updatedAt`, `vertical`, `folderId`, `status`, `*tags` |
| `portfolios` | `id` | `updatedAt`, `folderId`, `*tags` |
| `folders` | `id` | `parentId` |
| `blobs` | `id` | file bytes referenced by `ContextSource.blobId` |

The repository normalizes older records on read, so newer fields like
`assetType`, `ic`, `manualMeta`, `evidence`, `decisionHistory`, `reviewMode`,
portfolio members, persona, stance, and expert review can backfill without a
Dexie version bump.

Decision history is also normalized on read. Old single-decision analyses expose
a one-entry legacy history in memory, while persistent write-back happens only
through explicit save/import flows.

Saved-review lifecycle state is also normalized on read:

- `reviewMode` accepts only `"kickoff"` or `"fact_check"`
- any unknown persisted value normalizes to `null`

## Eval Harness And Improvement Loop

The self-improvement loop is developer-facing and fixture-driven. It is not a
runtime product table yet.

```ts
interface ImprovementLogEntry {
  id: string;
  createdAt: string;
  area: "intake" | "grounding" | "decision" | "portfolio";
  caseId: string;
  status: "new" | "fixed" | "accepted-risk";
  observedFailure: string;
  expectedBehavior: string;
  guardedBy: string[];
  notes?: string;
}
```

Current implementation:

- Intake eval cases live in code fixtures and describe expected ticker detection,
  research quality, allowed/forbidden fields, expected values, and evidence URLs.
- Intake scoring is pure and checks extraction, no-fabrication behavior,
  evidence relevance, and scoping-vs-figures mode.
- The improvement log links observed failures to eval cases and tests.
- Optional live eval reuses the same cases against Gemini when a provider key is
  available.

The harness is intentionally not autonomous. It records and guards failures, but
does not modify prompts, code, or persisted user data.

## Current Gaps

- Eval/self-improvement is fixture-based only; there is no in-app feedback inbox
  or persisted user-facing improvement queue.
- The in-app browser helper repair is deferred; product QA currently uses the
  fallback Edge/CDP harness.
- M7 is implemented and verified. The next active milestone is M8: BYOK Trust, Validation, And Local Provider Setup.
