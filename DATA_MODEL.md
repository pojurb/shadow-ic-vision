# Data Model — AI Investment Workspace

The product evolves from a single-screen cockpit into an **analysis workspace** (IDE-like:
saved documents, history, chat, droppable context, composition). The unit of work is an
**Analysis**; everything else (ledger, history, portfolio) derives from it.

Persistence: **Dexie (IndexedDB)**, local-first, behind an async repository interface so a
server/DB implementation drops in later for multi-user without UI changes.

## Core entities

```ts
type Vertical = "stocks" | "startups" | "conventional";
type DecisionAction = "APPROVE" | "HOLD" | "REJECT";
type AnalysisStatus = "draft" | "decided" | "watching" | "archived";

interface AssetMeta {
  ticker?: string; sector?: string; currency?: string; // default "IDR"
  region?: string; dataAsOf?: string; source?: string;
}

// Deterministic engine output, normalized + serializable = the "locked facts" fed to the AI.
interface Metric { key: string; label: string; value: number; display: string; verdict?: string }
interface ComputedMetrics { vertical: Vertical; metrics: Metric[] }

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;              // markdown for assistant turns
  kind?: "debate" | "answer";   // first assistant turn = grounded red-team debate
  contextRefs?: string[];       // ids of other analyses pulled in (composition)
  createdAt: number;
}

interface Decision { action: DecisionAction; rationale: string; decidedAt: number }

// Droppable context. Files are native content blocks (image/pdf); for providers
// without native PDF support, pdf.js extracts text as a fallback. Links and web
// research use native server tools (Anthropic) or the thin backend (all others).
type ContextSource =
  | { id: string; kind: "file"; name: string; mime: string; fileKind: "image" | "pdf"; blobId: string; extractedText?: string; createdAt: number }
  | { id: string; kind: "link"; url: string; title?: string; createdAt: number };

interface Folder { id: string; name: string; parentId: string | null; createdAt: number }

interface Analysis {
  id: string; title: string;
  vertical: Vertical; assetName: string; assetMeta: AssetMeta;
  tags: string[]; folderId: string | null;
  parameters: AssetParameters;   // raw inputs
  metrics: ComputedMetrics;      // deterministic snapshot (grounded truth)
  sources: ContextSource[];      // dropped files + links
  allowWebSearch: boolean;       // let the model research the web
  chat: ChatMessage[];           // debate seed turn + follow-ups
  decision: Decision | null;
  model: string; status: AnalysisStatus;
  createdAt: number; updatedAt: number;
}

// Composition: combine A + B (the IDE "@-mention files" pattern).
interface PortfolioAnalysis {
  id: string; title: string;
  memberIds: string[];           // analyses included as grounded context
  tags: string[]; folderId: string | null;
  chat: ChatMessage[]; allowWebSearch: boolean;
  createdAt: number; updatedAt: number;
}
```

## Dexie tables

| Table | Primary key | Indexes |
|---|---|---|
| `analyses` | `id` | `updatedAt`, `vertical`, `folderId`, `status`, `*tags` |
| `portfolios` | `id` | `updatedAt`, `folderId`, `*tags` |
| `folders` | `id` | `parentId` |
| `blobs` | `id` | — (file bytes, referenced by `ContextSource.blobId`) |

Blobs live in their own table so the `Analysis` record stays light. The repository exposes an
async API (`listAnalyses / getAnalysis / saveAnalysis / deleteAnalysis / putBlob / getBlob /
folder + portfolio CRUD`). **Ledger = derived view** (`analyses` where `decision != null`),
not a separate store — single source of truth.

## How context reaches the model

| Source | Anthropic path | OpenAI / other path |
|---|---|---|
| image | native `image` content block (base64) | `image_url` content block (base64) |
| pdf | native `document` content block (base64) | pdf.js text extraction → text block |
| link | `web_fetch_20260209` server tool (native) | `/api/web-fetch` backend route + OpenAI function-tool loop |
| web research | `web_search_20260209` server tool (native) | `/api/web-search` (Tavily) + function-tool loop |
| metrics | text — locked facts in user turn | same |

**Backend routes** (`/api/web-fetch`, `/api/web-search`) run server-side (no CORS). The
provider's API key stays browser-only; only the Tavily operator key lives on the server.

## Data flows

**Single analysis:** set params → engine computes `metrics` (live) → "Run" → AI streams grounded
Bull/Bear/Orchestrator (first chat turn) → saved as `Analysis(draft)` → follow-up chat (re-grounded
each turn) → commit `Decision` → appears in derived Ledger.

**Composition:** New Portfolio → @-select member analyses → prompt injects each member's compact
**grounded summary** (asset + key metrics + decision + 1-line thesis), not full chat → cross-asset
answer saved to `portfolio.chat`.

**Local-first bonus:** everything in IndexedDB → trivial **JSON export/import**, and a clean
migration path to multi-user (swap the repo impl for server calls).

## Out of scope for v1 (designed-for, not built)
CSV/xlsx/docx parsing + CSV→parameter auto-fill (fast-follow), multi-user backend, real-time sync.
