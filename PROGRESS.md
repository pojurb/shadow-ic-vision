# Progress Tracker — AI Investment Workspace

**Goal:** Turn the investment-cockpit concept into a real, production-ready **BYOK AI analysis workspace**
(IDE-like: saved analyses, history, chat, droppable context, composition). Repo owner: Johannes Purba (AI PM).

- **Repo:** github.com/pojurb/demo1 · branch `main`
- **Old demo (still live):** `web/` → https://demo-vercel-nu-peach.vercel.app/ (untouched until cutover)
- **New product:** `app/` → Next.js 16 + TypeScript + Dexie
- **Data model (locked):** see `DATA_MODEL.md`
- **Build plan (locked):** see `~/.claude/plans/ethereal-popping-zebra.md`

---

## Status

| Phase | State |
|---|---|
| Node.js LTS install (v24.16, permanent user PATH) | ✅ |
| **P0** Scaffold Next.js 16 + TS (`app/`) | ✅ build clean |
| **P1** Finance engine → typed TS (`src/lib/finance`) | ✅ 23 Vitest tests pass |
| **P2** Cockpit UI shell (React, deterministic calc) | ✅ runs at localhost:3000 |
| Data model locked (`DATA_MODEL.md`) | ✅ |
| **P3a** Data layer: domain types + Dexie repo + `computeMetrics` | ✅ build clean |
| **P3b** Library sidebar + analysis-backed cockpit + tags/folders | ✅ |
| **P4** Live AI + chat (BYOK) | ✅ build clean |
| **P5a** Context sources — PDF/image as native blocks + links UI | ✅ build clean |
| **P5b** Live `web_fetch` / `web_search` server tools | ⬜ NEXT — see design note |
| **P6** Composition (portfolio cross-analysis) | ⬜ |
| **P7** Guardrails + eval harness | ⬜ |
| **P8** Polish, export/import, Vercel cutover | ⬜ |

Key files added in `app/src`: `lib/finance/*` (engine + tests + `compute.ts`), `lib/domain/types.ts`,
`lib/repo/{db,index}.ts`, `lib/storage/index.ts`, `data/presets.ts`, `components/{Cockpit,charts}.tsx`,
`components/{Workspace,Library,AnalysisView,Settings}.tsx`, `lib/ai/{client,prompts,schemas,analyze,chat}.ts`.

### P4 — live AI (BYOK), as built
- `lib/ai/client.ts` — raw `fetch` to `api.anthropic.com` (no SDK — SDK pulls node-only deps that
  can't bundle for the browser). Uses the `anthropic-dangerous-direct-browser-access` header. Model list.
- `lib/ai/analyze.ts` — grounded red-team debate via **structured outputs** (`output_config.format`,
  `json_schema`). Numbers come only from `computeMetrics`; the model may not invent figures.
- `lib/ai/chat.ts` — streamed follow-up chat, manual SSE parse (`content_block_delta`/`text_delta`).
- `Settings.tsx` — BYOK key (localStorage only, never leaves the browser) + model picker.
- `AnalysisView.tsx` — ⚡ RUN AI button, LIVE/SEED badge, grounded chat panel.
- API shapes spot-checked against the current Anthropic spec (structured-output param, SSE event names).
  Prompt caching was intentionally **not** used — payloads are far below the ~4096-token cacheable
  minimum, so `cache_control` would be an inert no-op.

### P5a — context sources, as built
- `lib/ai/content.ts` — `buildFileBlocks()` reads each file source's blob and emits a native
  `image` block (base64) or `document` block (PDF base64). Wired into both `analyze` and `chat`
  as the leading content blocks before the grounding text.
- `prompts.ts` — `attachedContextText()` lists attached files/links + web-research intent so the
  model is oriented (file bytes still travel as real content blocks).
- `AnalysisView.tsx` — CONTEXT SOURCES panel: add/remove PDF+image files and links, WEB RESEARCH
  toggle. Blob bytes persist immediately via `putBlob`; source metadata rides the debounced save.

### ⚠️ P5b design tension to resolve before building
The locked data model wants `web_fetch` (links) and `web_search` (web research) **during analysis**.
But the analysis call uses **structured outputs** (`output_config.format`), and structured outputs are
**incompatible with citations**, which the web tools emit → the combined request would 400. So web tools
can't sit on the structured-output analyze path as-is. Options (pick before P5b):
- **A** — web tools only on the *chat* path (free-form, no schema); analysis stays structured. Simplest.
- **B** — analysis does a free-form web-tool pass, then a second structured pass to format the debate.
- **C** — drop structured output for the debate; parse JSON from a free-form response by hand.
P5b also needs `pause_turn` handling in the streamed SSE loop (server-tool continuation), which is the
one part that really wants a live API key to verify — flagging since this runs in the user's browser.

## Key decisions
- **Local-first BYOK** now; architected for multi-user later (async repo + AI-client seams).
- **Stack:** Next.js (App Router) + TypeScript; ported industrial-grunge CSS; Dexie (IndexedDB).
- **Analysis is the core object**; Ledger is a derived view; Portfolio is first-class for composition.
- **Numbers are deterministic** (`computeMetrics`), locked into the AI prompt as facts (no numeric hallucination).
- Attachments v1: **PDF + image** (native Claude blocks). Links + web research via Anthropic
  `web_fetch` / `web_search` server tools (no CORS, no backend).

---

## ▶️ How to resume (after a reboot / new session)

1. Open a terminal — `node -v` should work (Node is on the permanent user PATH).
2. Start the dev server:
   ```powershell
   cd D:\jp-invest\app
   npm run dev      # → http://localhost:3000
   npm test         # finance engine tests
   ```
3. Re-open Claude Code in `D:\jp-invest`. Context to reload: this file, `DATA_MODEL.md`,
   the plan file above, `git log`, and the saved memory (`ai-pm-portfolio-demo` /
   `ai-pm-portfolio-workspace`). Next task: **P5** (context sources — PDF/image attachments + links).
   To run live AI: open ⚙ SETTINGS in the app, paste an Anthropic key, pick a model, then ⚡ RUN AI.
4. Everything is committed **and pushed** to `origin/main`, so it also survives disk loss.
