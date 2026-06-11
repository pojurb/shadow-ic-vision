# Data Model - AI Investment Workspace

The product is now a local-first AI Investment Committee workspace. The central
object remains `Analysis`, but an analysis is now a thesis detail record: it
carries investment committee memory, deterministic valuation figures, context
sources, AI debate, chat, and a legacy decision.

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
```

- `vertical` routes the deterministic valuation engine and field set.
- `assetType` is the IC/product classification. It is broader than the current
  valuation engine and is the bridge toward manual private/alternative assets.

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
- Evidence is currently stored as thesis `evidenceCandidates`, not yet as a
  first-class Evidence Locker table.
- Review cadence exists, but there is no IC Agenda or assumption-monitoring
  engine yet.

## Analysis

```ts
type DecisionAction = "APPROVE" | "HOLD" | "REJECT"; // legacy
type AnalysisStatus = "draft" | "decided" | "watching" | "archived";

interface Decision {
  action: DecisionAction;
  rationale: string;
  decidedAt: number;
}

interface Analysis {
  id: string;
  title: string;
  vertical: Vertical;
  assetType: AssetType;
  assetName: string;
  assetMeta: AssetMeta;
  tags: string[];
  folderId: string | null;

  ic: ICState;

  parameters: AssetParameters;
  metrics: ComputedMetrics;

  debate: DebateResult | null;
  advisory: LensResult[] | null;
  persona: PersonaRef | null;
  stance: Stance | null;
  expertReview: ExpertReview | null;

  sources: ContextSource[];
  allowWebSearch: boolean;
  chat: ChatMessage[];

  decision: Decision | null;
  model: string;
  status: AnalysisStatus;
  createdAt: number;
  updatedAt: number;
}
```

`Decision` is legacy. Milestone 6 will replace the user-facing
approve/hold/reject workflow with IC actions, pre-mortems, linked thesis/evidence
snapshots, review triggers, and outcome reviews.

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
  createdAt: number;
  updatedAt: number;
}
```

Portfolio metrics are derived from member capital and referenced analyses. The
portfolio record stores composition and AI outputs, while metrics are recomputed
for grounding.

## Dexie Tables

| Table | Primary key | Indexes |
|---|---|---|
| `analyses` | `id` | `updatedAt`, `vertical`, `folderId`, `status`, `*tags` |
| `portfolios` | `id` | `updatedAt`, `folderId`, `*tags` |
| `folders` | `id` | `parentId` |
| `blobs` | `id` | file bytes referenced by `ContextSource.blobId` |

The repository normalizes older records on read, so newer fields like
`assetType`, `ic`, portfolio members, persona, stance, and expert review can
backfill without a Dexie version bump.

## Current Gaps

- Manual private/alternative asset metadata is not yet modeled in full.
- Evidence Locker has candidates but no first-class evidence table.
- Stock figure provenance is not yet stored at field level.
- IC Agenda and assumption monitoring are not implemented.
- Decision Ledger / review loop is still legacy and is the recommended next
  implementation milestone.
