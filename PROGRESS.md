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
| **P6** Multi-provider BYOK + thin backend | ✅ smoke-tested live (Gemini key verified) |
| Gemini adapter (P6.5) | ✅ models verified against live API |
| Blank-entry creation flow (blank-first; presets→examples) | ✅ verified in-browser |
| **Flow direction** (chat-first vs structure-first) | ✅ DECIDED 2026-05-31 → **Option C (hybrid)**, see below |
| **UX redesign** (layout + aesthetic) | ✅ DECIDED 2026-06-01 → two-pane + dashboard, softened look; see below |
| **Redesign prototype** (`app/src/app/proto`, throwaway) | ✅ built; stocks vertical P0 honesty pass applied 2026-06-01 |
| **Expert analyst agent** (per-vertical personas + review pass + visible identity) | ✅ built 2026-06-01 · `tsc` clean · 41 Vitest pass · **live-verified on Gemini for ALL 3 verticals** (analysis + review; engine-stance correct each: stocks→FAIR, startups→CONDITIONAL, conventional→VIABLE; all groundingCheck "clean"). **OpenAI + Anthropic adapters still live-unverified** (no keys) |
| **Two-pane visual port** (proto layout → `AnalysisView`) | ✅ committed `b7a8859` (checkpoint) 2026-06-02; superseded/softened by the chat-first build below |
| **Chat-first analysis (Option C intake) + proto-fidelity** | ✅ BUILT 2026-06-02 (all 6 phases A–F) · `tsc` clean · **57 Vitest pass** (41 baseline + 16 new) · lint-clean on changed files · `next build` compiles all routes. **Live smoke still owed** (no API key in env). Plan: `~/.claude/plans/now-i-am-thinking-cryptic-mountain.md` |
| **P7** Composition (portfolio cross-analysis) | ⏸ ON HOLD |
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
- Cross-asset/P7 still needs **`computePortfolioMetrics()` + member weights/capital** before it's safe
  (confirms the existing P7 warning — flow doesn't fix it; B makes it worse).
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
inferred values before `computeMetrics`, stance stays `persona.stance.derive` (engine-derived). **Live smoke
owed** — run one paste→confirm→debate→report per vertical with a real BYOK key (Gemini), then the temp gated
intake test from the plan, and delete it.

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

   Also, if/when P7 proceeds: the earlier eval flagged a thesis-level gap — P7 as planned has **no
   deterministic portfolio-level math** and `PortfolioAnalysis` has **no weights/capital**, so cross-asset
   answers would force the AI to do arithmetic (violates the no-numeric-hallucination principle). Fix =
   add member positions + a `computePortfolioMetrics()` before the cross-asset chat.

   OpenAI/Gemini web search needs `TAVILY_API_KEY` in `app/.env.local` (see `.env.local.example`).
4. **Git:** P4→P6.5 + Gemini fixes + blank-entry flow are on `main` (local). The **redesign prototype +
   equity-analyst P0 pass + the full expert-analyst-agent feature** are committed (`9cf269f`) on branch
   **`feat/expert-analyst-personas`** (local, NOT pushed). The **two-pane port is uncommitted** on that same
   branch. **`origin` has only `main`** — nothing pushed yet. See the **"⚠️ Git situation"** section above for
   the web-session/stale-base caveat before resuming. Push when ready:
   `git push -u origin feat/expert-analyst-personas`.
