# Progress Tracker — AI Investment Workspace

**Goal:** Turn the investment-cockpit concept into a real, production-ready **BYOK AI analysis workspace**
(IDE-like: saved analyses, history, chat, droppable context, composition). Repo owner: Johannes Purba (AI PM).

- **Repo:** github.com/pojurb/demo1 · branch `main`
- **Old demo (still live):** `web/` → https://demo-vercel-nu-peach.vercel.app/ (untouched until cutover)
- **New product:** `app/` → Next.js 16 + TypeScript + Dexie
- **Data model (locked):** see `DATA_MODEL.md`
- **Build plan (locked):** see `BUILD_PLAN.md`

---

## Latest Snapshot - 2026-06-15

QA stability work is partially landed and materially improved. The canonical
browser path now runs through a dedicated harness, and isolated browser
verification is green for M3 and M4:

- Added a canonical browser QA runner at `scripts/qa/browser_qa.js`, exposed as
  `npm run qa` via `scripts/run.js qa`.
- The harness now builds the app into a unique `NEXT_DIST_DIR`, starts a clean
  production server on a dedicated port, launches headless Edge on a dedicated
  debug port, seeds deterministic fixtures through the app import path, writes a
  structured JSON report, captures screenshots, and tears its process tree down
  cleanly on Windows.
- Browser QA now classifies failures as `app`, `data`, or `tooling` and records
  the failing step, console errors, runtime exceptions, and artifacts under
  `issues/qa/<run-id>/`.
- Added deterministic QA fixtures for M3 stock provenance, M4 Evidence Locker,
  M6 analysis/portfolio decision ledgers, and `broken-m4` intentional
  failure-classification coverage.
- Added QA mock-provider routing so browser verification no longer depends on
  live model/network variance.
- Added explicit `data-qa` selectors across Library, AnalysisView,
  PortfolioView, and DecisionLedger so browser checks use stable UI hooks
  instead of brittle ad hoc DOM probing.
- Fixed a real app bug surfaced by the new harness: a React hydration mismatch
  in `Workspace.tsx` caused runtime error `#418` during M3 reload flows. The QA
  fixture loading state is now server/client consistent.
- Hardened M4 verification to wait for seeded evidence/candidate state and to
  respect the app's 500ms debounced persistence before reload.
- Hardened harness teardown so successful runs exit cleanly instead of hanging
  after completion.
- Verification remains green for `npm test`, `npm run lint`, and
  `npm run build`.
- Isolated browser QA is now green for:
  - M3 stock provenance
  - M4 Evidence Locker
- Latest verified artifacts:
  - `issues/qa/2026-06-15T08-40-17-658Z/report.json` (`m3` pass)
  - `issues/qa/2026-06-15T09-26-39-168Z/report.json` (`m4` pass)
- Remaining QA work:
  - run isolated M6 browser QA (no passing report yet; previous run was interrupted)
  - run `broken-m4` expected-failure classification
  - run full `npm run qa`
  - clean old locked `.next-qa-*` residue left by earlier interrupted runs (`app/.next-qa-2026-06-15T08-21-32-865Z`, `app/.next-qa-2026-06-15T08-22-03-701Z`)
- Next execution step: finish the remaining QA sweep above, then proceed to M2
  Manual Private Asset IC Entry and M5 once M2/M3/M4 inputs are trustworthy
  enough.

---

## Previous Snapshot - 2026-06-15

M6 Decision Ledger + Review Loop is implemented and verified:

- Added append-only `decisionHistory` to analyses and portfolios.
- Added shared decision helpers for validation, snapshots, legacy normalization,
  latest-decision lookup, outcome reviews, labels, and status derivation.
- Replaced the legacy analysis decision card with a reusable Decision Ledger.
- Added the same Decision Ledger workflow to portfolios.
- Updated Library badges and filters to derive draft/watching/decided/archived
  from decision history for both analyses and portfolios.
- Added tests for decision helpers and backup/export/import preservation.
- Updated `DATA_MODEL.md`, `BUILD_PLAN.md`, `EXECUTION_PLAN.md`, and
  `docs/milestones/m6_spec.md` to reflect the implemented M6 shape.
- Verification passed: `npm run lint -- --quiet`, `npm test`
  (19 files / 151 tests), `npm run build`, and browser QA across analysis,
  portfolio, due-review, invalid-form, and legacy-decision flows.
- Browser QA was completed with local Playwright + Edge because the in-app
  browser helper still crashes during setup in this environment.
- Next execution step: start M3 Field Provenance using the Product Trio skill
  workflow.

---

## Latest Snapshot - 2026-06-11

Saved before next build work:

- `BUILD_PLAN.md` is now the current milestone tracker.
- `DATA_MODEL.md`, `app/CODE_ANATOMY.md`, and `web/CODE_ANATOMY.md` were
  refreshed to match the current app, eval harness, and legacy demo split.
- Milestone 1 is mostly implemented: IC primitives, thesis memory, thesis intake,
  confirmation, and inspector display exist.
- Milestone 2 is not implemented: manual real estate, crypto, macro, other, and
  richer private-asset metadata are not in the UI yet.
- Milestone 3 is partial: stock-intake search and weak-value guardrails improved,
  but field-level cited provenance is still missing.
- Milestone 4 is partial primitives only: evidence candidates exist, but there is
  no first-class Evidence Locker workflow.
- Milestone 5 is not implemented: review cadence exists, but no IC agenda or
  assumption-monitoring engine exists.
- Milestone 6 is not implemented: the app still uses legacy
  `APPROVE` / `HOLD` / `REJECT` decisions with rationale and timestamp only.
- Recent stock-intake fix: focused IDX ticker queries, quote/chart fetch, top
  search-result page fetch, partial-stock-data scoping guard, and prompt
  guardrails against invented `discountRate`, `terminalMult`, and evidence.
- Safe intake/self-improvement harness now guards the MBMA-style failure class
  through fixture cases, pure scorecards, an improvement log, and optional live
  provider eval.
- Deployment docs were moved under `docs/deployment/`; the Vercel handoff note
  is no longer at the repo root.
- Verification after the recent app changes: `npm test` passed
  (18 files / 141 tests), `npm run build` passed, and `npm run eval` passed.
- Recommended next implementation after documentation cleanup: Milestone 6
  Decision Ledger + Review Loop.

Root cleanup decision:

- Current source-of-truth docs stay at root: `README.md`,
  `PRODUCT_STRATEGY.md`, `BUILD_PLAN.md`, `PROGRESS.md`, `DATA_MODEL.md`,
  tool instruction files, package files, and license.
- Deployment runbooks live under `docs/deployment/`.
- Historical PRDs move to `docs/archive/`.

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
| **P6** Multi-provider BYOK + thin backend | ✅ smoke-tested live (Gemini key verified) |
| Gemini adapter (P6.5) | ✅ models verified against live API |
| Blank-entry creation flow (blank-first; presets→examples) | ✅ verified in-browser |
| **Flow direction** (chat-first vs structure-first) | ✅ DECIDED 2026-05-31 → **Option C (hybrid)**, see below |
| **UX redesign** (layout + aesthetic) | ✅ DECIDED 2026-06-01 → two-pane + dashboard, softened look; see below |
| **Redesign prototype** (`app/src/app/proto`, throwaway) | ✅ built; stocks vertical P0 honesty pass applied 2026-06-01 |
| **Expert analyst agent** (per-vertical personas + review pass + visible identity) | ✅ built 2026-06-01 · `tsc` clean · 41 Vitest pass · **live-verified on Gemini for ALL 3 verticals** (analysis + review; engine-stance correct each: stocks→FAIR, startups→CONDITIONAL, conventional→VIABLE; all groundingCheck "clean"). **OpenAI + Anthropic adapters still live-unverified** (no keys) |
| **Two-pane visual port** (proto layout → `AnalysisView`) | ✅ committed `b7a8859` (checkpoint) 2026-06-02; superseded/softened by the chat-first build below |
| **Chat-first analysis (Option C intake) + proto-fidelity** | ✅ BUILT + **LIVE-VERIFIED on Gemini** 2026-06-02 (all 6 phases A–F; intake→lock→debate→report green for ALL 3 verticals, stance engine-derived each). `tsc` clean · **61 Vitest pass** · `next build` green. PR #1 open. Plan: `~/.claude/plans/now-i-am-thinking-cryptic-mountain.md` |
| **P7a** Portfolio math unblocker (members+capital + `computePortfolioMetrics`) | ✅ 2026-06-02 · `tsc` clean · **71 Vitest pass** (+10) · lint/build green. Pure engine+types+repo, no UI/AI |
| **P7b** Composition UI + grounded cross-asset chat | ✅ 2026-06-07 · `tsc` clean · **86 Vitest pass** (+15) · `next build` green · **live-verified on Gemini** (engine stance == derive; grounded chat). See section below |
| **P8** Guardrails + eval harness | ✅ 2026-06-07 · `tsc` clean · **110 Vitest pass** (+24) · `next build` green · live eval scorecard verified on Gemini (schema/stance gates 100%). See section below |
| **P9a** Export / import (backup & restore) | ✅ 2026-06-08 · `tsc` clean · **120 Vitest pass** (+10) · `next build` green · pure backup core + DB wrappers + Settings UI. See section below |
| **P9b** UI readability & density pass | ✅ 2026-06-08 · `tsc` clean · **120 Vitest pass** · `next build` green · type-floor + spacing rhythm + chrome harmonization + persisted inspector width. See section below |
| **P9c** Vercel cutover | 🟡 deploy doc now lives in `docs/deployment/VERCEL_CUTOVER.md` · production alias switch pending |

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

### Flow direction — DECIDED 2026-05-31: Option C (hybrid)
Resolved blocker (a) from the resume notes. Worked through **11 real scenarios** (clean stock, messy
PDF, vague pre-numbers, re-analysis, macro question, cross-asset, ambiguous vertical, bulk CSV, AI
misread, cold recall, conflicting sources) comparing three flows:
- **A structure-first** (current build) — vertical+params are a forced front gate. Safe but rigid;
  breaks on vague deals (S3), painful on messy docs (S2), fires the classify-gate before you
  understand the deal (S7).
- **B pure chat-first** — AI talks first, numbers pinned late. Matches the user's instinct but
  **breaks the no-numeric-hallucination thesis**: silently infers/misreads numbers (S2, S9), doubles
  the risk on cross-asset (S6), and pays a standing tax on every recall/export feature (no durable
  object, S10).
- **C hybrid (CHOSEN)** — *chat-first shell over the structured spine*. You start by typing/pasting;
  the AI's first job is **structured intake** → detect vertical, gather/extract the numbers it needs,
  **show them for confirmation, lock via `computeMetrics`, THEN debate**. Sliders/charts become an
  editable details panel, not the entry gate. Feels chat-first; keeps the deterministic guarantee.

**The fork was never "where's the chat box" — it's "is vertical+numbers a forced gate (A), absent (B),
or inferred-and-confirmed (C)?"** Across the 6 scenarios that flow actually decides, C is strictly
best; it ties A on lifecycle cases and beats B everywhere grounding matters.

**Sharpened design rules that fell out of the scenarios (build to these):**
- **Confirm rule:** confirm a figure where the **AI inferred/extracted** it (S9 — the units misread is
  caught here); **skip confirm where the user typed it** (S1). This makes C scale down to B's smoothness
  and up to A's safety.
- **Vertical is inferred-and-confirmed, not a front gate** (S7). The three verticals stay (they map to
  real `computeMetrics` branches) but classification is a suggested+overridable mid-flow field.
- **Mode label:** intake must distinguish **scoping/ungrounded chat** (macro questions, pre-numbers
  deals — S3/S5) from **figure-locked analysis**, and say which mode it's in. This is what protects the
  thesis while still allowing free conversation.
- **Bulk = confirm-by-exception** (S8 — C's one real weakness): per-asset confirm doesn't scale, so a
  CSV/multi-asset import flags only low-confidence cells, not all of them.

**Data-model gaps the scenarios surfaced (independent of flow, queue separately):**
- Cross-asset/P7 needed **`computePortfolioMetrics()` + member weights/capital** before it's safe →
  ✅ **DONE 2026-06-02 (P7a)**: `lib/finance/portfolio.ts` + `PortfolioMember{analysisId,capital}` on
  `PortfolioAnalysis`. The cross-asset chat (P7b) can now ground on it.
- Figures need a **freshness/provenance** dimension (`dataAsOf` exists in `AssetMeta` but isn't
  enforced) so stale-vs-live conflicts surface instead of silently overriding (S11).

**Not yet decided:** blocker (b), the readability/UX pass — IN PROGRESS, see next section.

### Readability/UX pass — ✅ RESOLVED 2026-06-01 (blocker b)
Resolved by building a rendered throwaway prototype and iterating in-browser. Decisions:
- **Layout = two-pane** — left = conversation/intake (the Option-C front door); right = a **collapsible,
  VS-Code-style resizable inspector**. Picked over tabbed and roomy-single-scroll.
- **Inspector = a dashboard, not an accordion.** User feedback: expand-a-section-then-scroll fights the
  job of "take it all in and make a call." So the inspector is an always-open **tiled board** (verdict
  strip pinned on top; cards flow into more columns as you widen it) instead of disclosures.
- **Aesthetic = softened.** Proportional `system-ui` for all prose; mono kept only for numbers. Type floor
  raised (nothing < 12px; prose ~15.5px). Dropped the blueprint grid, warning-stripes, hard-black panels
  for lifted greys + soft borders; cyan/amber accents kept but restrained.

Original diagnosis that drove this (still the spec for porting into the real `AnalysisView`): base text
was **14px JetBrains Mono** everywhere (`globals.css:46`), chrome down to 9–11px; and one analysis stacked
~5 dense interaction modes on a single mega-scroll. Both are fixed by the two-pane + dashboard + softened
type above.

### Redesign prototype + equity-analyst review — 2026-06-01
**Prototype lives at `app/src/app/proto/page.tsx`** (one self-contained file: components + mock data + CSS;
route `/proto`; **throwaway, untracked, safe to delete**; touches nothing in the real app). It now covers
**all three verticals** via a top-bar switcher, each with a purpose-built chart:
- Stocks → margin-of-safety gap + DCF value bridge (after the P0 pass below).
- Startups → cash-runway curve (raise-window before cash-out).
- Conventional → break-even diagram (revenue vs total cost, BEP marker).

**Equity-analyst expert review (one-off, general-purpose agent) of the stocks vertical surfaced the key
finding:** the first prototype's headline **fabricated numbers** — "Fair Value (per share)" and "Upside %"
do **not** exist in the engine (`calcDCF` yields a *total* `totalNPV`, not per-share; `marginOfSafety`
keys off `invested` cost basis, not market price). That violates the product's own no-numeric-hallucination
law in the most visible spot. Full engine map: stocks compute only `pe` (+verdict), `npv` (intrinsic value,
total), `mos` (%); `earningsYield` is computed but was unused; `pb` is captured but unused.

**P0 honesty pass — APPLIED to the stocks prototype (all groundable in `pe`/`npv`/`mos`):**
- Verdict strip → `P/E · DISCOUNT 11.1×` / `Margin of Safety +15%` / `Intrinsic Val. (NPV) 4,940` /
  `Earnings Yield 9.0%`. Killed "Fair Value/Upside". NPV relabeled as total intrinsic value, never per-share.
- Added an **engine-derived stance** banner (UNDERVALUED, from P/E verdict + sign of MoS) — a computed label,
  not a buy/sell action; human-only `Decision` stays the only place an action is taken.
- Charts: 4 candidates → **2 honest ones** — MoS gap (cost basis vs intrinsic value, both totals) + DCF
  value bridge (pvSum + terminalValue → totalNPV, flags "% is terminal value").
- Debate → fixed **4-slot rubric** (Valuation/Quality/Catalyst/Risk) per side; valuation/quality/risk cite a
  locked figure.
- Advisory lenses → equity lenses **Valuation/Quality/Catalyst/Risk Manager** (was Operator/Risk/Predator,
  a PE/operator frame); verdicts are stance words, not action verbs.
- Dropped the ungrounded **"72% confidence"** → discrete `THESIS MIXED` chip.

**Queued (need deterministic engine work first — do NOT fake in UI):**
- **P1:** sensitivity tornado (loop `calcDCF` over discountRate ±1% / terminalMult ±1×); P/B + implied
  sustainable P/B = ROE/discountRate (from the unused `pb`).
- **P2:** add `sharesOutstanding` + a contract that cashflows are total equity FCF → legitimate per-share
  fair value + upside → unlocks a real football-field range chart; wire ROE into the DCF.

**Next action when resuming:**
1. Decide whether to carry the same honesty pass (stance/lens-fit/drop-confidence) into the **startups +
   conventional** cases (currently still on their old verdict strips/lenses).
2. Then **port the prototype into the real `AnalysisView.tsx` + `globals.css`** (this is the actual P-? work
   that unblocks P7). The prototype is the spec.
3. Queue the P1/P2 **engine additions** in `lib/finance/equities.ts` / `compute.ts` when ready.

### Expert analyst agent — BUILT 2026-06-01
Per-vertical expert personas replace the previously generic AI pipeline. Decision: **specialist personas
+ optional on-demand review pass + visible identity**, all three verticals. Plan file:
`~/.claude/plans/now-i-am-thinking-cryptic-mountain.md`.

**As built (all `tsc`-clean, 41 Vitest pass; UNVERIFIED live — no API key in env):**
- **`lib/ai/personas.ts`** (new) — the keystone registry. Per vertical: id/label/blurb, `systemPrompt` +
  `reviewSystemPrompt`, 4 `debateSlots`, the `lenses` SET, and a **pure `stance.derive(metrics)`**.
  - Equity Analyst (stocks): slots/lenses Valuation/Quality/Catalyst/Risk; stance UNDERVALUED/FAIR/OVERVALUED
    from P/E verdict + sign of MoS.
  - Venture Analyst (startups): Unit-Economics/Growth/Runway/Risk; stance BACKABLE/CONDITIONAL/UNPROVEN from
    LTV:CAC + runway verdicts.
  - Operator Analyst (conventional): Returns/Break-even/Demand/Risk; stance VIABLE/MARGINAL/UNVIABLE from IRR.
  - **Grounding audit done by reading `compute.ts`**: confirmed startups engine = ltvcac/payback/runway
    (NOT the proto's "burn multiple"); conventional = bepUnits/bepRevenue/irr (NOT the proto's "payback/NPV").
- **Stance is engine-derived, never AI-authored** — `finalizeDebate()` in `analyze.ts` overrides any model
  stance with `persona.stance.derive(metrics)`; the model only supplies a one-line `stanceBasis`. This is the
  load-bearing no-hallucination guard for the new headline verdict.
- **Schema migration (atomic):** `advisory` fixed-keys {operator,risk,predator} → a per-vertical **lens
  array**; numeric `confidence` → discrete `thesisSupport` (STRONG/MIXED/THIN); added `stance` + `stanceBasis`
  + debate-line `slot`. One **static** `DEBATE_JSON_SCHEMA`; per-vertical lens/slot sets enforced by a
  **validate+zip** step in `analyze.ts` (drops unknown lens ids, fills missing, clamps slots) — so all 3
  providers share one schema. Files: `schemas.ts`, `domain/types.ts`, `data/presets.ts` (6 seeds rewritten),
  `repo/index.ts`.
- **Review pass:** `ExpertReview` schema + `runExpertReview` (anthropic) / `runOpenAIExpertReview` /
  `runGeminiExpertReview`; new `AIProvider.runExpertReview`. On-demand only (a button) — +1 call when invoked.
- **Providers:** persona system+user prompts threaded through anthropic/openai/gemini. OpenAI strict mode → `slot`
  is required (no nullable hack needed). Gemini → `toGeminiSchema` strips `enum` too; `thesisSupport` clamped in
  `finalizeDebate` as the net.
- **Back-compat:** `normalizeAnalysis()` on read (`repo/index.ts`) converts old-shape stored analyses; no Dexie
  version bump. Idempotent.
- **UI (functional port, NOT the cosmetic two-pane redesign):** `AnalysisView.tsx` now renders the lens **array**
  (stacked, no tabs), a **persona badge**, the engine **stance banner**, a **THESIS** chip (dropped numeric
  confidence), debate **slot tags**, and an **EXPERT REVIEW** panel (button → strengths/gaps/grounding-check).
  `Workspace.tsx` seeds persona+stance. New CSS in `globals.css` (industrial theme — matches current look).
- **Tests:** `personas.test.ts` (stance.derive boundaries — guards the no-hallucination stance), `finalize.test.ts`
  (validate+zip + stance override + thesisSupport clamp), `repo/normalize.test.ts` (old→new + idempotent).
  `vitest.config.ts` gained the `@`→`src` alias (runtime `@/` imports were unresolved before).

**Deferred:** the **two-pane visual redesign** (porting the proto's chat-first inspector cosmetics) — the feature
ships in the *existing* single-scroll industrial layout. `app/src/app/proto/page.tsx` is kept as the visual
reference (NOT deleted). Do that cosmetic port next, iterating in-browser. **Live smoke still owed** (run one
analysis + one review per vertical/provider with a real BYOK key).

### Two-pane port + the chat-first gap — 2026-06-02
- **Two-pane visual port (first pass, LOCAL/UNCOMMITTED):** `AnalysisView.tsx` rewritten from the single-scroll
  panels into the proto's two-pane shell — slim topbar (title + RUN AI + hide-inspector), left conversation
  (chat + composer with attach/link/web), VS-Code-style **resizable** right inspector (stance banner → verdict
  strip → tiled cards: figures/chart/debate/advisory/decision/expert-review/asset). `tp-*` softened CSS added
  to `globals.css`. `tsc` clean, route 200. **But the inner elements (debate/lenses/figures) still use the
  industrial styling**, so it drifted from the proto — user flagged "very different from the proto."
- **The real gap the port exposed:** the app **can't start an analysis from the conversation.** Chat
  (`streamChat`) is grounded **follow-up only**; there is **no intake engine** (detect vertical → extract
  numbers → confirm → lock → debate → report). The proto was a static mock of that. This is the **Option C
  flow** decided 2026-05-31 but never built.

### Chat-first analysis (Option C intake) — ✅ BUILT 2026-06-02 (all phases A–F)
Built locally on `feat/expert-analyst-personas` (the web-session attempt was unrecoverable — uncommitted,
never pushed; rebuilt here for real). `tsc` clean, **57 Vitest pass** (41 baseline + 9 new intake + 7 new
report), lint-clean on changed files (only the 2 pre-existing issues remain: `Workspace.tsx:36` effect,
gemini `_drop`/`_enum`), `next build` compiles all routes.
- **A** `data/fields.ts` — lifted `Field`/`FIELDS`/`fmtVal` + new `paramKeysFor`; `AnalysisView` imports them.
- **B** intake engine: `schemas.ts` (`IntakeOutput`/`IntakeResult`/`INTAKE_JSON_SCHEMA`, plain-string
  vertical/mode/source validated in code), `prompts.ts` (`intakeSystem`+`buildIntakeUserPrompt`, candidate
  keys enumerated from `FIELDS`), `analyze.ts` (`runIntake` + pure **`finalizeIntake`** — zips to engine
  keys, merges `BLANK_PARAMS`, always proxies stocks `cashflows` from EPS, clamps vertical/mode/source/value),
  `runIntake` on all 3 providers (`IntakeRequest`). Tests: `intake.test.ts` (9).
- **C** `AnalysisView` state machine: `intakeMode = !analysis.debate` routes the composer (intake vs
  follow-up); `pendingIntake`/`intakeBusy` state; **`ConfirmCard`** (amber inferred inputs / ✓-stated rows /
  vertical change chip, remounted via `key`); confirm builds the **next Analysis explicitly** (no stale prop),
  `computeMetrics` → `runAnalysis` → posts the report. Manual sliders + RUN AI preserved.
- **D** `lib/ai/report.ts` pure **`buildReport`** (templated, grounded — only engine `display` strings, no new
  numbers) → `ReportBody` renderer; `ChatMessage.kind += "report"`. Tests: `report.test.ts` (7, incl. a
  "no figure outside the engine set" guard across all 3 verticals).
- **E** proto-fidelity: softened debate (`DebateSide`/`tp-points`/`tp-slot`), advisory (`tp-lens-*`), figures
  (`tp-figs`/`tp-slider`), stance banner, thesis chip, mode pill, confirm card, report — all `tp-`-namespaced
  under `.tp-root` in `globals.css`.
- **F** chat-first front door: `Workspace.newIntake()` (blank intake draft, no forced vertical), Library
  **+ NEW** → `newIntake`, empty-state primary → `newIntake` + "or start from an example…" secondary
  (presets demoted, not a gate). Empty-conversation hint reworded.

No-hallucination guard intact: intake extracts (never invents), splits stated/inferred, the confirm card gates
inferred values before `computeMetrics`, stance stays `persona.stance.derive` (engine-derived).

**✅ LIVE SMOKE DONE (Gemini, gemini-2.5-flash, 2026-06-02).** Temp gated test drove intake→lock→debate→report
for all 3 verticals; all green (stocks→OVERVALUED, startups→CONDITIONAL, conventional→VIABLE — each live stance
== `persona.stance.derive`; reports carried every locked display). Temp test deleted after. The live run
surfaced + fixed **two real bugs** (committed):
- **Unit misread:** the model returned whole-number percents (margin 70, churn 4) for `percent_raw` fields the
  engine wants as fractions (0.70, 0.04), and marked them `stated` (so the confirm card wouldn't catch them).
  Fix: per-field unit hints in the intake prompt (`[decimal fraction 0–1]` vs `[whole-number percent]` from
  `Field.type`) **+** a defensive `finalizeIntake` guard (`percent_raw` value >1 → /100, since all such fields
  cap <1). Tests added.
- **Sticky scoping:** the model labelled a fully-specified stock `mode:"scoping"`. Fix: `finalizeIntake` now
  **derives** mode from field count (≥1 kept field ⇒ figures), ignoring the model's flaky label. Test added.
Key was BYOK in a gitignored `app/.env.local` (still must be **rotated** — it was pasted in chat).

### P9b — UI readability & density pass — ✅ BUILT 2026-06-08
Pays down long-standing feedback that the workspace was **"too small / too dense, almost unusable"** — a
presentation-only pass (no logic / AI / data-shape / copy changes), so it can't touch the engine math or the
no-hallucination guarantees. Plan: `~/.claude/plans/silly-moseying-alpaca.md`. `tsc` clean · **120 Vitest
pass** (unchanged — CSS-only) · `next build` green.

- **Type-floor + spacing rhythm** (`app/src/app/globals.css`, `tp-*` block): new tunable vars on `.tp-root`
  (`--tp-fs-label/-meta/-body/-head`, `--tp-pad`, `--tp-gap`) referenced across the inspector. Lifted the
  cluster of sub-11px labels (`.tp-slot` 9.5→10, `.tp-vlbl`/`.tp-pos-stance`/`.tp-ground` 10→11.5,
  `.tp-card-hint`/`.tp-lens-name`/`.tp-stance-basis`→11.5) to a readable floor and loosened the dense
  containers (card padding, board/verdict/debate/points/lens/figs gaps, composition rows, allocation labels).
- **Legacy sidebar + settings** (`app/src/app/workspace.css`): bumped the genuinely cramped 9–12px Library
  items, search/filter, mini-badges, dates, Settings labels/notes, and the gear button to a comfortable size;
  widened the sidebar 290→300.
- **Chrome harmonization**: `cockpit-header` + `library-sidebar` moved off the hard 3px/2px brutalist borders
  onto the soft 1px `--tp-line` + tp panel backgrounds so the chrome reads as one surface with the two-pane.
- **Persisted inspector width** (`AnalysisView.tsx` / `PortfolioView.tsx` + new `lib/ui/inspectorWidth.ts`):
  the dragged width now survives reloads (per-view localStorage key, SSR-safe fallback-first, clamped to
  MIN/MAX); raised `MIN_W` (340→380 analysis, 360→400 portfolio) so the default opens comfortably.

**Verification:** `tsc` clean · 120 unit tests green (CSS-only, count unchanged) · `next build` green.
**Owed:** in-browser eyeball (`npm run dev`) across an analysis + a portfolio + Settings, and the mobile
breakpoint, to confirm legibility — no functional risk.

### P9c — Vercel cutover prep — 🟡 DOC DRAFTED 2026-06-08
The production handoff is now documented in [`docs/deployment/VERCEL_CUTOVER.md`](docs/deployment/VERCEL_CUTOVER.md). It pins the live
target to `app/`, lists the Vercel project settings, calls out `TAVILY_API_KEY`, and spells out the
cutover / rollback / post-cutover checks.

**Still pending:** the actual production alias switch from the legacy `web/` demo to the new Vercel
deployment.

### P9a — Export / import (backup & restore) — ✅ BUILT 2026-06-08
Closes the single biggest data-loss risk in a local-first app: the whole workspace lived **only** in this
browser's IndexedDB with no copy and no restore path, and the old `exportAll()` stub silently **omitted the
`blobs` table** (every attachment would be lost) and had no import counterpart. Now there is a real,
faithful Save-to-file / Load-from-file in Settings that captures the *entire* workspace. Plan:
`~/.claude/plans/silly-moseying-alpaca.md`. `tsc` clean · **120 Vitest pass** (+10) · `next build` green.

- **A — pure backup core** `lib/repo/backup.ts` (env-agnostic, no Dexie/FileReader → unit-testable):
  `BackupEnvelope` (`{ app:"jp-workspace"; version:1; exportedAt; analyses; portfolios; folders; blobs:
  {id;mime;data/*base64*/}[] }`), `bytesToBase64`/`base64ToBytes` (chunked `btoa`/`atob` — browser+node, all
  byte values), `buildEnvelope`/`serializeBackup`, and `parseBackup` (validates `app`/`version`, drops
  malformed blob rows, **normalizes records on import** via `normalizeAnalysis`/`normalizePortfolio` so old
  backups upgrade exactly like a read). `backup.test.ts` (10): base64 round-trip incl. 100k run + empty,
  envelope shape, foreign-file / bad-version / non-JSON guards, legacy-record upgrade.
- **B — DB wrappers** `lib/repo/index.ts`: `exportAll()` rewritten to read all **four** tables incl. blobs
  (`new Uint8Array(await blob.arrayBuffer())` → base64 with mime); new `importAll(json, mode)` →
  `parseBackup`, rebuild `Blob`s, single `rw` transaction (`replace` clears the 4 tables first; `merge`
  `bulkPut`s by id), returns per-table `ImportCounts`.
- **C — Settings UI** `components/Settings.tsx`: a **Backup & Restore** section — **⬇ Export workspace**
  (downloads `jp-workspace-YYYY-MM-DD.json`, reports counts) and **⬆ Import workspace** (hidden file input;
  `window.confirm` chooses **Replace all** vs **Merge**; inline ok/err message). New `onImported` prop wired
  in `Workspace.tsx` re-runs `listAnalyses`+`listPortfolios` and clears the active selection. New
  `.backup-row`/`.ghost-btn` CSS.
- **Key decision:** API keys / provider settings are **deliberately excluded** from backups (secrets live in
  localStorage, must never travel in a shared file). The user re-enters them.

**Verification:** `tsc` clean · 120 unit tests green · `next build` green. **Owed:** in-browser manual
round-trip (create analysis+portfolio+attachment → Export → Replace-all import in a fresh profile → confirm
the attached PDF still opens; grep the JSON for absence of API keys).

### P8 — Guardrails + eval harness — ✅ BUILT 2026-06-07
Closes the gap where the no-numeric-hallucination promise was enforced only softly (prompt + schema +
engine-derived stance) — nothing deterministically checked the numbers in the model's *free text*. Now a
pure linter does, surfaced as a non-blocking flag, plus an eval suite that measures it. User decisions:
**flag (don't block)**, **offline + optional live**, **lint structured + chat**. Plan:
`~/.claude/plans/d-jp-invest-progress-md-check-whether-th-fluffy-stallman.md`. `tsc` clean · **110 Vitest
pass** (+24) · `next build` + lint green.

- **A — pure grounding linter** `lib/ai/grounding.ts`: `extractNumberTokens` (parses id-ID `.`/`,`, `Rp`,
  `%`, `x`, `B`/`M`/`T`; **ambiguous separators → BOTH interpretations**, e.g. "4.940"→{4.94, 4940}),
  `allowedValues` (each `metric.value` + numbers re-extracted from each `display` + extras),
  `lintGrounding` (compares VALUES with ~2% tolerance; unit-bearing figures must trace, bare ints ≤100 /
  years whitelisted), and gatherers `lintAnalysisGrounding` / `lintPortfolioGrounding` (allows each
  holding's own figures) / `lintChatReply` + `portfolioChatExtras`. `grounding.test.ts` (13).
- **B — UI flag (non-blocking, render-time, no persistence).** `AnalysisView` + `PortfolioView`: a
  **GroundChip** in the debate-card header (`✓ Grounded` / `⚠ N unverified` with a tooltip of the flagged
  tokens) and a per-assistant-message **ChatGroundFlag**. New `tp-ground*` CSS. No change to `finalize*`
  or providers — the linter is read-only over produced data.
- **C — eval harness.** `eval/fixtures.ts` (preset members, mixed portfolio, grounded vs
  planted-violation debates). `eval/offline.test.ts` (in `npm test`, no key): finalize + lint **flag the
  planted figure** and pass the clean fixture for all 3 verticals + portfolio; full lens set; engine-stance
  match; a portfolio capital-split / conviction-mix **stance sweep**. Optional live scorecard
  `eval/live.eval.ts` + `vitest.eval.config.ts` + `npm run eval` (gated by `GEMINI_API_KEY`): runs real
  debates/chat and prints schema-valid % / stance-match % / grounding-clean %; **hard-gates schema +
  engine-derived stance at 100%**, grounding-clean is measured (not gated — model slips AND parser
  false-positives both lower it). Soft-skips green on a provider quota/network limit.

**Verification:** offline suite green (110). `npm run eval` first run **passed** on Gemini (schema=100%,
stance=100% gates held on real calls); repeat runs hit the **free-tier daily quota** (429) and now
**soft-skip green** by design — re-run `npm run eval` once the quota resets to print the full scorecard.
**Design note:** flag-only by intent; tune the parser against the live scorecard, never by tightening into
the user's prose. OpenAI/Anthropic scorecards await their keys.

### P7b — Composition UI + grounded cross-asset chat — ✅ BUILT + LIVE-VERIFIED 2026-06-07
Portfolios are now first-class. User decisions (2026-06-07): **manual composition** (member picker + capital,
persisted), **chat + portfolio debate** (not chat-only), **grounding = portfolio metrics + each member's locked
figures**. Plan: `~/.claude/plans/d-jp-invest-progress-md-check-whether-th-fluffy-stallman.md`. Built on
`feat/expert-analyst-personas`. `tsc` clean · **86 Vitest pass** (+15) · `next build` green · dev route 200.

- **A — domain + persona + engine stance.** `PortfolioAnalysis` gained `persona`/`stance`/`debate`/`advisory`
  (metrics stay computed-on-read); `createPortfolio` inits them, `normalizePortfolio` backfills on read (idempotent,
  preserves the `.toBe` fast-path). New cross-vertical **Portfolio Strategist** in `personas.ts`: 4 slots
  (Allocation/Concentration/Conviction/Risk), 4 lenses (Capital Allocation/Concentration/Conviction Mix/Risk
  Manager), `STANCE_POLARITY` (the 9 member labels → ±/neutral), and a **pure `derivePortfolioStance`**
  (empty→null; top >40%→CONCENTRATED; else ≥60% positive→CONSTRUCTIVE; ≥60% negative→DEFENSIVE; else BALANCED).
  Tests `portfolioPersona.test.ts` (7).
- **B — AI seam.** `prompts.ts`: `portfolioGroundingText` (5 portfolio figures **+ each holding's**
  `summarizeMetrics` + weight/capital/stance), `portfolioChatContextPreamble`, `PORTFOLIO_CHAT_SYSTEM`,
  `buildPortfolioAnalysisUserPrompt`. `analyze.ts`: `runPortfolioAnalysis` (single structured pass, **no web
  research** — reuses `DEBATE_JSON_SCHEMA`) + pure **`finalizePortfolioDebate`** (validate+zip vs the persona
  lens/slot sets, clamp thesisSupport, **override stance with `derivePortfolioStance`** — model authors only the
  one-line basis). `AIProvider` seam gained `runPortfolioAnalysis` + `streamPortfolioChat`, implemented in all 3
  providers (anthropic delegates; openai json_schema strict; gemini `toGeminiSchema`/SSE). Chat is **text-only**
  (no per-holding file blocks in v1). Tests `portfolioGrounding.test.ts` (4) + `finalizePortfolio.test.ts` (4).
- **C — routing + Library.** `Workspace` active is now a discriminated union (`analysis | portfolio | null`) with
  `openPortfolio`/`newPortfolio`/`handlePortfolioChange` (debounced `savePortfolio`, separate timer); loads
  `listPortfolios`. `Library` got a **Portfolios** section + **+ PORTFOLIO** button. Empty-state gained
  "or compose a portfolio…".
- **D/E — `PortfolioView.tsx`** (mirrors `AnalysisView`'s two-pane `tp-*` shell): left = cross-asset chat
  (follow-up only, no intake); right inspector = stance banner → verdict strip (5 metrics) → **Composition card**
  (per-holding capital input + remove + "Add holding" picker from `listAnalyses`, recomputes
  `computePortfolioMetrics` live) → **Allocation** weight bars → **Strategist debate** → **Advisory** lenses.
  ⚡ ANALYZE PORTFOLIO runs the debate; chat turns + edits persist via debounced `handlePortfolioChange`. New
  `tp-pos-*`/`tp-alloc-*`/library section CSS in `globals.css`.

**✅ LIVE SMOKE (Gemini, gemini-2.5-flash, 2026-06-07).** 3-vertical book (60/30/10 capital). `runPortfolioAnalysis`
→ **model stance == `derivePortfolioStance` == CONCENTRATED** (engine-derived override holds), bull 4 / bear 4 /
lenses 4, thesis MIXED. `streamPortfolioChat` ("which holding carries the most concentration risk?") answered
**grounded on the locked weight** ("BBCA represents 60% of the total capital") — no invented numbers. Temp gated
test deleted after. **OpenAI + Anthropic portfolio paths still live-unverified** (no keys). Key still owed a
**rotation** (gitignored `app/.env.local`).

**Deferred (out of P7b v1):** portfolio web-research pass, portfolio expert-review pass, chat attachments — each a
straight mirror of the single-asset path when wanted.

### Chat-first analysis (Option C intake) — original plan record (PLAN APPROVED 2026-06-02)
User decisions: **full auto intake** (paste a deal → detect vertical + extract figures → confirm card → confirm
locks via engine AND auto-runs the persona debate), **written report in chat**, **match the proto fully** (soften
inner elements too). Plan refined via Ultraplan and teleported back; saved at
`~/.claude/plans/now-i-am-thinking-cryptic-mountain.md`. Phases **A→B→(C,D)→E→F**:
A lift `FIELDS`→`data/fields.ts`; B `runIntake` + pure `finalizeIntake` (mirrors `runExpertReview`/`finalizeDebate`,
3 providers); C conversation state machine + `ConfirmCard` (dual-mode composer off `analysis.debate==null`);
D pure `buildReport` templated grounded report (`ChatMessage.kind += "report"`); E soften debate/advisory/figures
to proto; F chat-first New (`Workspace`/`Library` +NEW → blank intake draft, presets become examples).
No-hallucination guard preserved: intake extracts (never invents), splits stated/inferred, confirm card gates
inferred before `computeMetrics`; stance stays engine-derived.

> **▶️ TO RESUME:** reopen the local Claude Code session here (`D:\jp-invest`, branch
> `feat/expert-analyst-personas`) and just say **"go"** — it picks up cleanly at **Phase A → B** of the plan
> at `~/.claude/plans/now-i-am-thinking-cryptic-mountain.md`. (Do NOT continue the Claude-Code-on-web session
> — it's on a stale base; see the git section below.)

### ⚠️ Git situation (2026-06-02) — read before resuming
- Everything (expert-agent feature commit `9cf269f` + the uncommitted two-pane port) is on the **local-only**
  branch `feat/expert-analyst-personas`. **`origin` has only `main`**, which lacks all of it (no `personas.ts`,
  migrated schema, `runExpertReview`, two-pane port).
- A **Claude-Code-on-web** session tried to execute the Option-C plan but built on `origin/main` — a base
  missing every prerequisite — so it **couldn't push/deliver**. That web work is on the wrong base; **set it
  aside** and build locally on `feat/expert-analyst-personas`.
- Decisions to make on resume: commit or discard the **uncommitted two-pane port** (Phases C/E rework that
  surface), and whether to `git push -u origin feat/expert-analyst-personas` so the remote finally has the base.
- Housekeeping: **rotate the two Gemini API keys** pasted in chat earlier; use a gitignored `app/.env.local`
  (key name `GEMINI_API_KEY`) for any smoke tests.

## Key decisions
- **Flow = Option C (hybrid chat-first shell over structured spine)** — see the dedicated section above.
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
   `multi-provider-byok`, `feedback-ui-too-cramped`).

   **P7 is ON HOLD.** Flow-direction is now DECIDED; one design question remains:
   - **(a) Flow direction — ✅ RESOLVED 2026-05-31 → Option C (hybrid).** Chat-first shell over the
     structured spine; intake infers vertical + extracts numbers + confirms + locks via `computeMetrics`
     before debating. Full rationale, the 11-scenario walkthrough, and the sharpened build rules
     (confirm-on-inference / skip-on-typed, vertical inferred-not-gated, mode label, bulk
     confirm-by-exception) are in the **"Flow direction — DECIDED"** section above.
   - **(b) UX / readability — ✅ RESOLVED 2026-06-01.** Two-pane (conversation + resizable dashboard
     inspector), softened aesthetic, built as a throwaway prototype at `app/src/app/proto/page.tsx`
     (route `/proto`). An equity-analyst review caught the prototype's headline fabricating numbers; a
     **P0 honesty pass is applied to the stocks vertical**. Full detail + the P1/P2 engine queue + the
     exact next action are in **"Readability/UX pass — RESOLVED"** and **"Redesign prototype + equity-analyst
     review"** above. Next: honesty pass for startups/conventional → port the prototype into the real
     `AnalysisView.tsx`. See memory `feedback-ui-too-cramped` and `flow-direction-decision`.

   P7 thesis-gap (eval-flagged): cross-asset answers would force the AI to do arithmetic (no portfolio
   math, no weights/capital). **RESOLVED 2026-06-02 (P7a):** added `PortfolioMember{analysisId,capital}`
   + pure `computePortfolioMetrics()` (`lib/finance/portfolio.ts`) + `normalizePortfolio` back-compat;
   71 Vitest pass. **P7b** (Composition UI + grounded cross-asset chat) is the next slice, now unblocked.
   Plan for P7a: `~/.claude/plans/reactive-tinkering-truffle.md`.

   OpenAI/Gemini web search needs `TAVILY_API_KEY` in `app/.env.local` (see `.env.local.example`).
4. **Git:** P4→P6.5 + Gemini fixes + blank-entry flow are on `main` (local). The **redesign prototype +
   equity-analyst P0 pass + the full expert-analyst-agent feature** are committed (`9cf269f`) on branch
   **`feat/expert-analyst-personas`** (local, NOT pushed). The **two-pane port is uncommitted** on that same
   branch. **`origin` has only `main`** — nothing pushed yet. See the **"⚠️ Git situation"** section above for
   the web-session/stale-base caveat before resuming. Push when ready:
   `git push -u origin feat/expert-analyst-personas`.
