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
| **P5b** Live `web_fetch` / `web_search` (two-pass analysis) | ✅ build clean · unverified w/o key |
| **P6** Multi-provider BYOK + thin backend | ✅ build clean · unverified w/o live keys |
| **P7** Composition (portfolio cross-analysis) | ⬜ |
| **P8** Guardrails + eval harness | ⬜ |
| **P9** Polish, export/import, Vercel cutover | ⬜ |

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

### P5b — web tools via two-pass analysis, as built
Resolved the structured-output ↔ citations conflict with **two passes** (chosen over chat-only and
drop-structured-output):
- **Pass 1 — `runResearch`** (`analyze.ts`): free-form call with `web_fetch_20260209` (when links are
  attached) and `web_search_20260209` (when WEB RESEARCH is on). Drives the server-tool loop by
  re-POSTing on `stop_reason: "pause_turn"` (round cap 6). Returns analyst notes. `RESEARCH_SYSTEM`
  keeps numbers tied to the locked figures.
- **Pass 2 — `runAnalysis`** (unchanged shape): structured `output_config.format` debate, now accepting
  the pass-1 notes as **qualitative-only** context (the prompt forbids taking any number from them).
- `needsResearch()` gates pass 1; `RUN AI` shows RESEARCHING… → DEBATING…. Skipped entirely when there
  are no links and web research is off (one structured call, as before).

⚠️ **Unverified without a live key.** The `pause_turn` continuation loop and the web-tool response shapes
are built to the documented spec but have not been exercised against the real API (no key in this env).
First live run with a link/web-research analysis is the thing to watch — it runs in the user's browser.

### P6 — Multi-provider BYOK + thin backend (decision 2026-05-30)
**BYOK means any provider's key, not Anthropic-only.** The user brings any key (Anthropic / OpenAI / …)
and uses that model as the brain with all the capabilities it has. Per capability: native if the model
supports it, else an app-provided fallback tool. Web fetch/search can't be a browser-only fallback
(browser **CORS** blocks cross-site fetch), so a **thin backend** (Next.js route handlers in this same
app) provides them. Provider/model calls stay **direct from the browser** so the BYOK key never leaves
the user's machine; the backend only handles the web-tool fallback. This **supersedes** the "native Claude
blocks / no backend" decisions below (P5a/P5b code becomes the first provider adapter). Full rationale +
confirmed sub-decisions: saved memory `multi-provider-byok`.
- **Providers first:** Anthropic (done) + OpenAI. **Search fallback:** Tavily via operator `.env.local` key.
- **Sequence:** (1) `AIProvider` seam + capability map + Anthropic adapter, behavior-preserving ✅ → (2) OpenAI
  adapter (+ pdf.js text fallback) ✅ → (3) thin backend `/api/web-fetch` + `/api/web-search` + client tool loop ✅
  → (4) capability-aware wiring + Settings (per-provider keys) + revise `DATA_MODEL.md`.

## Key decisions
- **Multi-provider BYOK** (any provider key); thin backend for web-tool fallback. **Supersedes the two
  Anthropic-specific lines below** — kept for history. See `### P6` and memory `multi-provider-byok`.
- **Stack:** Next.js (App Router) + TypeScript; ported industrial-grunge CSS; Dexie (IndexedDB).
- **Analysis is the core object**; Ledger is a derived view; Portfolio is first-class for composition.
- **Numbers are deterministic** (`computeMetrics`), locked into the AI prompt as facts (no numeric hallucination).
- ~~Attachments v1: **PDF + image** (native Claude blocks). Links + web research via Anthropic
  `web_fetch` / `web_search` server tools (no CORS, no backend).~~ → generalized in P6 (native where the
  model supports it, app/backend fallback otherwise).

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
   the plan file above, `git log`, and the saved memory (`ai-pm-portfolio-demo`,
   `multi-provider-byok`). **P6 complete.** Next: **P7** (composition — portfolio cross-analysis) or smoke-test first.
   OpenAI web search needs `TAVILY_API_KEY` in `app/.env.local` (see `.env.local.example`).
   AI layer (P4→P6) built but unverified against a real API key.
4. **Committed to `main` (local), NOT pushed.** `git log` shows P4 / P5a / P5b / docs / P6.1. Push when
   ready: `git push origin main`.
