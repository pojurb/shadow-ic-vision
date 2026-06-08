# CODE ANATOMY — app/

> Read this when you return after time away and need to re-orient quickly.
> It covers what the product is, where to find things in the code, and why key decisions were made.
> Last updated: 2026-05-31

---

## What This Is

This is the production version of the JP Family Office investment cockpit. It runs as a Next.js web application — you start it with `npm run dev` and open it in a browser at `localhost:3000`. Unlike the static demo in `web/`, this version connects to real AI models, stores all your work permanently in your browser's database, and is designed for actual daily use.

**What it does:** You create a new "analysis" for an asset (a stock, startup, or conventional business), adjust financial parameters using sliders, then click "RUN AI" to generate a live Bull vs Bear debate and three advisory perspectives. The AI receives your locked financial figures as grounding — it cannot invent numbers. You can upload supporting documents (PDFs, images), paste links, enable web research, and ask follow-up questions in a grounded chat panel. When you reach a conviction, you commit a APPROVE / HOLD / REJECT decision with a rationale.

**Bring Your Own Key (BYOK):** There is no subscription. You supply an API key (Anthropic, OpenAI, or Google Gemini) in the Settings panel. The key is stored only in your browser and sent directly to the provider — it never touches the server. The only server-side secret the operator needs is a free Tavily key for web search (used as a fallback for providers that lack native web access).

---

## File Map

```
app/
├── src/
│   ├── app/                    Next.js routing root
│   │   ├── layout.tsx          HTML shell, fonts, metadata
│   │   ├── page.tsx            "/" route — renders <Workspace />
│   │   ├── globals.css         CSS resets and base rules
│   │   ├── workspace.css       Workspace layout styles
│   │   └── api/
│   │       ├── web-search/
│   │       │   └── route.ts    POST /api/web-search (Tavily proxy)
│   │       └── web-fetch/
│   │           └── route.ts    POST /api/web-fetch (CORS-bypass URL fetcher)
│   ├── components/
│   │   ├── Workspace.tsx       Root container — analysis list, new/delete, settings
│   │   ├── AnalysisView.tsx    Main editor — all panels for one open analysis
│   │   ├── Library.tsx         Sidebar — search, filter, analysis list
│   │   ├── Settings.tsx        Modal — provider / API key / model selector
│   │   └── charts.tsx          Retro SVG charts (one per vertical)
│   ├── data/
│   │   └── presets.ts          6 seeded presets (2 per vertical) with curated debate text
│   └── lib/
│       ├── ai/
│       │   ├── registry.ts     Provider registry — single resolution point
│       │   ├── types.ts        AIProvider interface, Capabilities flags
│       │   ├── analyze.ts      Two-pass orchestration: research → debate
│       │   ├── chat.ts         Streamed follow-up chat (SSE parsing)
│       │   ├── prompts.ts      System/user prompt builders, grounding text
│       │   ├── schemas.ts      JSON Schema for structured debate output
│       │   ├── content.ts      Anthropic content block builder (files/PDFs)
│       │   ├── pdf.ts          PDF text extraction via pdfjs-dist
│       │   ├── client.ts       Anthropic fetch helpers, model list
│       │   └── providers/
│       │       ├── anthropic.ts  Claude adapter (all capabilities native)
│       │       ├── openai.ts     GPT-4o adapter (PDF/web via fallbacks)
│       │       └── gemini.ts     Gemini adapter (PDF native, web via fallback)
│       ├── domain/
│       │   └── types.ts        All core types: Analysis, DebateResult, Decision, etc.
│       ├── finance/
│       │   ├── compute.ts      computeMetrics() — bridges engine to UI and AI prompts
│       │   ├── equities.ts     calcPE, calcDCF, calcIRR (Stocks vertical)
│       │   ├── ventures.ts     calcLTV, calcCAC, calcRunway (Startups vertical)
│       │   ├── operating.ts    calcBEP (Conventional vertical)
│       │   ├── format.ts       formatIDR, formatNum display helpers
│       │   ├── index.ts        Export barrel
│       │   └── *.test.ts       Vitest unit tests per module
│       ├── repo/
│       │   ├── db.ts           Dexie schema — WorkspaceDB, table definitions
│       │   └── index.ts        Async repository: listAnalyses, saveAnalysis, etc.
│       └── storage/
│           └── index.ts        localStorage adapter for Settings and Ledger
├── public/
│   └── pdf.worker.min.mjs      pdfjs worker (served statically, needed for PDF extraction)
├── .env.local.example          One required env var: TAVILY_API_KEY
├── next.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── CLAUDE.md
└── AGENTS.md
```

---

## Architecture in One Sentence

The app is a single-page workspace where your financial figures are computed deterministically on the client, then passed as locked facts to whichever AI provider you configured — so the AI can only interpret numbers you already verified, not invent them.

---

## Data Flow

Two separate flows run in this app. The first is triggered every time you move a slider. The second is triggered when you click RUN AI or send a chat message. Read each diagram top to bottom — each arrow means "triggers" or "feeds into".

### Flow 1 — Slider changes a parameter

```
User moves a slider
      │
      ▼
analysis.parameters (updated in React state)
      │
      ▼
computeMetrics(vertical, parameters)    ← deterministic math only, no AI
      │
      ├──► analysis.metrics updated     ← locked figures, shown in metric boxes
      └──► SVG chart re-renders         ← chart visuals update immediately
```

### Flow 2 — RUN AI (two-pass orchestration)

```
User clicks RUN AI
      │
      ▼
getProvider(settings.provider)          ← picks Anthropic, OpenAI, or Gemini adapter
      │
      ▼
Pass 1: runResearch()                   ← only if allowWebSearch=true or link sources present
      │   Provider uses web_fetch / web_search tools (native or via /api/web-*)
      │   Handles tool-use loop (up to 6 rounds)
      │
      └──► analyst notes (free-form text)
                  │
                  ▼
Pass 2: runAnalysis()
      │   Locked figures from computeMetrics() injected into user prompt
      │   Structured output enforced via JSON Schema (debate format)
      │
      └──► DebateOutput {
                confidence %, bull[], bear[],
                advisory { operator, risk, predator }
           }
                  │
                  ▼
analysis.debate + analysis.advisory updated → UI re-renders debate/advisory panels
      │
      ▼
saveAnalysis() → Dexie/IndexedDB        ← persisted automatically
```

### Flow 3 — Chat follow-up

```
User types a message and sends
      │
      ▼
streamChat()
      │   Preamble: locked figures + prior debate injected for grounding
      │   Streams SSE delta tokens from provider API
      │
      └──► onDelta(text) fires per chunk → chat panel renders incrementally
                  │
                  ▼
ChatMessage appended to analysis.chat → saveAnalysis()
```

---

## Source Directory Index

*Where to go when you need to change something.*

| Directory / File | Touch when… |
|---|---|
| `src/app/page.tsx` + `layout.tsx` | Changing the root HTML shell, fonts, or page metadata |
| `src/components/Workspace.tsx` | Changing the overall layout, how analyses are created/deleted, or the new-analysis dialog |
| `src/components/AnalysisView.tsx` | Changing any panel within an open analysis — parameters, debate, advisory, context, chat |
| `src/components/Library.tsx` | Changing the sidebar — search, filter, list items |
| `src/components/Settings.tsx` | Changing the provider/key/model configuration UI |
| `src/components/charts.tsx` | Editing the SVG charts (one component per vertical) |
| `src/data/presets.ts` | Adding or editing the seeded presets — their parameters and curated debate/advisory text |
| `src/lib/ai/providers/anthropic.ts` | Changing how Claude is called — model, tools, content blocks, structured output |
| `src/lib/ai/providers/openai.ts` | Changing GPT-4o behaviour, tool loop, fallback handling |
| `src/lib/ai/providers/gemini.ts` | Changing Gemini behaviour, PDF handling, fallback handling |
| `src/lib/ai/registry.ts` | Adding a new provider, or changing which provider is the default |
| `src/lib/ai/types.ts` | Adding a new capability flag, or changing the AIProvider interface |
| `src/lib/ai/analyze.ts` | Changing the research/debate orchestration logic, tool-use loop depth, pass count |
| `src/lib/ai/chat.ts` | Changing how the chat stream works or how grounding is built for chat |
| `src/lib/ai/prompts.ts` | Editing system prompts, user prompts, or the grounding block injected before AI calls |
| `src/lib/ai/schemas.ts` | Changing the JSON Schema that enforces structured debate output |
| `src/lib/finance/compute.ts` | Changing which metrics are computed and how they are formatted for the UI and AI prompt |
| `src/lib/finance/equities.ts` | Changing P/E, DCF, or IRR formulas for the Stocks vertical |
| `src/lib/finance/ventures.ts` | Changing LTV, CAC, or Runway formulas for the Startups vertical |
| `src/lib/finance/operating.ts` | Changing BEP formula for the Conventional vertical |
| `src/lib/domain/types.ts` | Adding a new field to Analysis, Decision, ContextSource, or any other core type |
| `src/lib/repo/db.ts` | Changing the Dexie database schema — adding tables or indexes |
| `src/lib/repo/index.ts` | Changing how analyses are read, saved, listed, or deleted |
| `src/lib/storage/index.ts` | Changing what gets saved in localStorage (Settings or Ledger) |
| `src/app/api/web-search/route.ts` | Changing the Tavily integration — result count, search depth, error handling |
| `src/app/api/web-fetch/route.ts` | Changing URL fetching — content length cap, HTML stripping, error handling |

---

## State and Storage

This app has three layers of storage. Each stores different things for different reasons.

### 1. React component state (in-memory, resets on refresh)
Held directly in `Workspace.tsx` and `AnalysisView.tsx` via `useState`. This is the live session state — which analysis is open, what the current slider values are, whether a modal is showing. It is not persisted anywhere on its own; it is the working copy of data loaded from Dexie.

Key values in `Workspace.tsx`:
```ts
analyses        // Analysis[]  — full list loaded from IndexedDB
activeAnalysis  // Analysis | null  — the one currently open
showNew         // boolean  — whether the new-analysis dialog is visible
showSettings    // boolean  — whether the settings modal is open
settings        // Settings  — provider + API keys + model (loaded from localStorage)
```

### 2. localStorage (persists across refresh, per browser)
Managed by `src/lib/storage/index.ts`. Stores small config objects only.

| Key | Contents |
|---|---|
| `jp_settings` | `{ provider, apiKeys: { anthropic, openai, gemini }, model }` |
| `jp_ledger` | Legacy ledger entries (superseded by `Analysis.decision` in Dexie) |

### 3. Dexie / IndexedDB (persists across refresh and sessions, per browser)
Managed by `src/lib/repo/`. This is the main database. All analyses, their parameters, AI-generated debate content, attached file blobs, chat history, and decisions live here. The database name is `"jp-workspace"`.

| Dexie Table | Stores | Key fields for querying |
|---|---|---|
| `analyses` | Analysis objects | `id`, `updatedAt`, `vertical`, `folderId`, `status`, `tags[]` |
| `portfolios` | Portfolio groupings | `id`, `updatedAt`, `folderId`, `tags[]` |
| `folders` | Folder hierarchy | `id`, `parentId` |
| `blobs` | Binary file attachments (PDFs, images) | `id` |

The Dexie instance is created lazily on the first `getDB()` call — it only runs in the browser (not during Next.js server-side rendering), which is why it is wrapped in a lazy singleton check.

---

## Domain Data Schema

The central type is `Analysis`. Every piece of data the app stores for a single investment analysis lives inside this object. When you need to add a field (e.g. a new metadata attribute or a new panel), `Analysis` in `src/lib/domain/types.ts` is the starting point.

```ts
Analysis {
  id           // unique identifier (UUID)
  title        // user-editable analysis title
  vertical     // "stocks" | "startups" | "conventional"
  assetName    // e.g. "Bank Central Asia"
  assetMeta {
    ticker?    // e.g. "BBCA"
    sector?
    currency?
    region?
    dataAsOf?  // date string — when the input data was sourced
    source?    // e.g. "annual report 2024"
  }
  tags         // string[]
  folderId?

  parameters   // vertical-specific sliders (see below)
  metrics      // ComputedMetrics — output of computeMetrics(), locked for AI

  debate       // DebateResult { confidence %, bull[], bear[] }
  advisory     // AdvisoryResult { operator, risk, predator }

  sources      // ContextSource[] — uploaded files and pasted links
  allowWebSearch  // boolean — whether AI may run web research

  chat         // ChatMessage[] — follow-up conversation history

  decision?    // Decision { action, rationale, decidedAt }
  model?       // which model was used for the last AI run
  status       // "draft" | "decided"
  createdAt    // ISO string
  updatedAt    // ISO string
}
```

Parameters by vertical:

| Vertical | Parameter Keys |
|---|---|
| `stocks` | `price, eps, pb, roe, discountRate, terminalMult, invested, cashflows[]` |
| `startups` | `cash, burn, cac, arpu, margin, churn` |
| `conventional` | `fixed, price, variable, invested` |

The structured AI output follows this schema (enforced by JSON Schema in `schemas.ts`):

```ts
DebateOutput {
  confidence   // integer 20–90
  bull         // DebateLine[] — { agent, text }
  bear         // DebateLine[] — { agent, text }
  advisory {
    operator   // { title, text }
    risk       // { title, text }
    predator   // { title, text }
  }
}
```

---

## Finance Engine

The finance engine is the layer that turns raw slider values into computed metrics — before any AI is involved. All calculations are deterministic: the same inputs always produce the same outputs. These outputs are called "locked figures" because once computed, they are passed to the AI as facts it cannot override.

`computeMetrics(vertical, parameters)` is the single entry point. It returns a `ComputedMetrics` object with a flat `metrics[]` array where each entry has a `key`, `label`, human-readable `display` value, and an optional `verdict` badge (e.g. `"DISCOUNT"`, `"CRITICAL"`, `"STRONG"`).

| File | Formulas | Used in vertical |
|---|---|---|
| `equities.ts` | P/E ratio, DCF (Net Present Value + margin of safety), IRR | Stocks |
| `ventures.ts` | LTV:CAC ratio, CAC payback period, cash runway months | Startups |
| `operating.ts` | Break-even point (units and revenue) | Conventional |

Each formula function is self-contained: it takes numbers in, returns numbers out, and has no side effects. They can be tested and debugged in isolation. Unit tests live in `*.test.ts` files in `lib/finance/` and run via Vitest.

---

## AI Provider System

The AI layer is built around an adapter pattern. Each provider (Anthropic, OpenAI, Gemini) has its own adapter file that implements the same `AIProvider` interface. The rest of the app only calls `getProvider(id)` and never imports provider-specific code directly.

### The AIProvider Interface (`lib/ai/types.ts`)

```ts
interface AIProvider {
  id            // "anthropic" | "openai" | "gemini"
  label         // display name for Settings UI
  models        // ModelOption[] — list shown in model selector
  capabilities(modelId)  // returns Capabilities flags for the chosen model
  runAnalysis(req)        // two-pass research + debate → DebateOutput
  streamChat(req)         // streamed follow-up conversation → string
}

Capabilities {
  vision           // can receive images directly
  pdfNative        // can receive PDF bytes directly (no client extraction needed)
  webFetchNative   // can call web_fetch tool without server relay
  webSearchNative  // can call web_search tool without server relay
}
```

### Capability Flags and Fallbacks

Not every provider supports every feature natively. The capability flags determine what happens when a feature is needed:

| Provider | Vision | PDF | Web Fetch | Web Search |
|---|---|---|---|---|
| Anthropic (Claude) | Native | Native | Native (tool) | Native (tool) |
| OpenAI (GPT-4o) | Native | **pdfjs fallback** | **`/api/web-fetch`** | **`/api/web-search`** |
| Gemini | Native | Native | **`/api/web-fetch`** | **`/api/web-search`** |

"Native" means the provider's API handles it directly. "Fallback" means the client does the work before calling the provider:
- **pdfjs fallback:** `lib/ai/pdf.ts` extracts PDF text in the browser, then sends the text as a string.
- **`/api/web-fetch`:** The backend route fetches the URL, strips HTML, returns plain text — bypassing browser CORS restrictions.
- **`/api/web-search`:** The backend route calls Tavily using the operator's API key, returns structured search results.

The operator's Tavily key (`TAVILY_API_KEY` in `.env.local`) is only used for the web-search backend route. It never leaves the server. The user's AI provider key is only used in the browser and never reaches the server.

### Adding a New Provider

1. Create `lib/ai/providers/yourprovider.ts` implementing `AIProvider`
2. Add the provider ID to `ProviderId` in `lib/ai/types.ts`
3. Register it in `lib/ai/registry.ts`
4. Add its models to the Settings UI in `components/Settings.tsx`

---

## CSS Design System (quick ref)

The visual identity is defined as CSS custom properties (variables) at the top of `globals.css`. To change a colour across the whole app, update it in one place there.

| Token | Colour | Used for |
|---|---|---|
| `--cyan-active` | `#06b6d4` | AI-related elements, live/active values, highlights |
| `--yellow-caution` | `#d97706` | Primary accent — buttons, borders, important labels |
| `--bull-green` | `#22c55e` | Positive / profit / APPROVE indicators |
| `--bear-red` | `#ef4444` | Negative / risk / REJECT indicators |
| `--font-mono` | JetBrains Mono | Body text, data values, labels (fixed-width, terminal feel) |
| `--font-heading` | Space Grotesk | Headings, button labels, titles |

The overall theme class is `industrial-theme`, applied to the root `<body>` in `layout.tsx`. Workspace-level layout rules (the sidebar/main split, panel sizing) live in `workspace.css`. Component-specific styles are written as `className` strings using CSS utility classes — there is no CSS-in-JS library.

---

## Design Decisions (the "why")

**Locked figures prevent AI hallucination.**
The financial metrics are computed client-side from the user's own slider values, then passed into the AI prompt as a hardcoded block of facts. The AI is explicitly instructed to reason from those numbers, not compute its own. This means a DCF of Rp 14.200 in the debate was derived from your inputs — the AI cannot produce a different number on a different run.

**Two-pass analysis (research → debate) instead of one big call.**
The research pass uses open-ended tool use (web_fetch, web_search) to gather context. The debate pass uses structured JSON output to enforce the response format. These two modes are incompatible in a single call: structured output conflicts with tool-use loops. Separating them into two calls solves this cleanly.

**Provider adapters with capability flags instead of a single lowest-common-denominator API.**
Different providers have genuinely different strengths. Treating all of them as equivalent would mean every provider gets the weakest experience. Instead, each adapter declares what it can do natively, and the app uses those capabilities when available — degrading to fallbacks only when needed. Adding a new provider only requires implementing the adapter; nothing else changes.

**No global state library (no Redux, Zustand, or Jotai).**
The state tree is shallow enough that React's built-in `useState` and prop passing cover it without ceremony. `Workspace.tsx` holds the list and the active analysis; `AnalysisView.tsx` holds all the UI state for the open analysis. There are no deeply nested components that would justify a context or store.

**Dexie over raw IndexedDB.**
IndexedDB's native API is callback-based and verbose. Dexie wraps it in a clean promise/async API, adds indexing (needed for querying by vertical, status, or tags), and handles schema versioning. The lazy singleton pattern (`getDB()`) ensures the database is only opened in the browser — not during Next.js's server-side rendering step.

**BYOK with no server proxy for AI calls.**
The user's API key is stored in their own browser's localStorage and sent directly to the provider API. There is no server in the middle holding or proxying AI requests. This keeps the architecture simple and means the operator running the app never sees user keys. The only exception is web search / fetch, where a server route is genuinely needed (Tavily requires a server secret, and raw URL fetching from the browser is blocked by CORS).

**Seed content in presets so the app is usable without an API key.**
Every preset ships with curated Bull/Bear debate text and advisory content. This means a new user can open the app, explore all the panels, and understand the workflow before they have an API key. When they run live AI, the seed content is replaced.

**No UI component library.**
The cockpit uses hand-written CSS (oscilloscope/industrial aesthetic) and hand-drawn SVG charts. Bringing in a component library (shadcn, MUI, Tailwind UI) would impose its own design language on top of the custom theme, and most of its components would be overridden anyway. Keeping it DIY preserves full control over the visual identity.

---

## Roadmap Status

**What is already working:**
- Full three-vertical parameter sandbox (sliders, live metric recompute, SVG charts)
- Live AI debate via Anthropic Claude (all capabilities native)
- Live AI debate via OpenAI GPT-4o (PDF via pdfjs fallback, web via `/api/` routes)
- Live AI debate via Google Gemini (PDF native, web via `/api/` routes)
- Context sources: PDF upload, image upload, link paste
- Web research (Tavily-backed) with AI tool-use loop
- Grounded follow-up chat (streamed, SSE-parsed)
- APPROVE / HOLD / REJECT decision log with rationale
- Full persistence: analyses, debate content, chat history, decisions in IndexedDB
- Settings: provider + BYOK key + model selector, persisted in localStorage

**What is not yet built:**
- Portfolio-level view (grouping multiple analyses, aggregate exposure)
- Folder organisation (the Dexie schema has `folderId` and `folders` table, but the UI does not expose it yet)
- Data import (CSV or XLSX for populating parameters from a real financial statement)
- Export / share (PDF report, JSON snapshot)
- Auth or sync (everything is local-first; no user accounts or cloud backup exist yet)
