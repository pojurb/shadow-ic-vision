# Session Checkpoint - 2026-07-18

## Repository State

- Branch: `main`
- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Phase: Milestone 4 — all four core steps implemented (packet accepted)
- Working scope: implemented Review History Retention (step 4), the final
  Milestone 4 step; normalized the packed `decisions.decision` column into
  typed `outcome`/`action` columns via migration `0006`
- App state: allowlisted model selector active for approved Ollama Cloud
  models; local portfolio holdings, priority queue, status index, and
  decision-history timeline fully integrated

## Implemented This Session (2026-07-18)

### Milestone 4 Step 4: Review History Retention

- Migration `db/migrations/0006_normalize_decision_outcomes.sql` rebuilds the
  `decisions` table: splits the packed `decision` text column (e.g.
  `"Update Thesis: Hold"`) into typed `outcome`/`action` columns via a
  backfill `CASE`/`instr` expression, normalizes any space-separated
  `CURRENT_TIMESTAMP` rows to ISO-8601 UTC, and adds a
  `decisions_thesis_created_idx` index on `(thesis_id, created_at)`.
  `db/schema.ts#decisions` matches the new shape.
- `lib/research/service.ts`: removed the duplicated `split(': ')` unpack logic
  in `getResearchPanel` and `exportThesisData` and the re-pack in
  `recordDecision`/`importThesisData`; decision reads now carry an explicit
  `orderBy(asc(decisions.createdAt))` (previously implicit, incidental rowid
  order). `getResearchPanel` computes a `previousAction` delta per decision
  for the timeline.
- `lib/domain/contracts.ts`: added `decisionRecordSchema` as the single source
  for the decision-record shape, referenced by `recordDecisionRequestSchema`,
  `thesisExportSchema.decisions`, and `DecisionDTO` (now `.previousAction?`).
  Export schema stays `version: 1` — the wire shape is unchanged.
- `db/queries.ts#getPortfolioBriefing`: added a correlated-subquery lookup for
  each thesis's latest `outcome`/`action`, exposed as `lastOutcome`/`lastAction`
  on `PortfolioHoldingQueueItem` (`lib/portfolio/priorityQueue.ts`).
- UI: `components/ResearchPanel.tsx`'s Decision Library now renders
  newest-first with a "changed from X" delta label, moved off inline styles
  onto `Workspace.module.css` classes; `app/portfolio/page.tsx` gained a
  "Last Decision" column (`colSpan` 5→6 on the empty state);
  `components/TopTenQueue.tsx` gained a last-action chip.
- Governance lock-in: `tests/decisions.test.ts` spies on
  `MockProvider.prototype.structuredExtract` to assert
  `generateDecisionRecommendation` never sends recorded decision text to the
  provider (DEC-0009 boundary). Flagged, unresolved: DEC-0009 lines 80/81
  describe recorded Buy/Hold/Reduce/Exit decisions inconsistently (allowed as
  workflow-confidential vs. blocked as portfolio data) — this slice treats the
  blocked reading as binding and keeps review history local-only.
- Tests: `tests/migrations.test.ts` (new) proves the migration round trip on
  an empty database (schema matches the ORM definition, index present) and
  independently validates the exact backfill SQL against a hand-built legacy
  packed-row fixture. `tests/decisions.test.ts` and
  `tests/portfolio-briefing.test.ts` updated for the typed columns and ISO
  timestamps; both gained new coverage (chronological timeline + delta,
  `lastOutcome`/`lastAction` in the briefing).
- Manually verified the full Buy → Hold → Exit flow end-to-end against a real
  temp SQLite DB (outside the mocked test harness): timeline renders
  chronologically with correct deltas, and the portfolio briefing surfaces
  the latest outcome/action.

## Previous Session (2026-07-17)

### Milestone 4 Critical Fixes & Tests

- Fixed a bug where thesis-linked Top-10 Queue and Status Index items routed
  to `/c/${thesisId}` instead of `/c/${conversationId}`; the `/c/[id]` route
  resolves a conversation id, not a thesis id, so the link 404'd. `getPortfolioBriefing`
  (`db/queries.ts`) now also selects `theses.conversationId`, and
  `PortfolioHoldingQueueItem` (`lib/portfolio/priorityQueue.ts`) carries it;
  `components/Sidebar.tsx` and `app/portfolio/page.tsx` link with it.
- Added `tests/portfolio-briefing.test.ts`: 13 unit and integration tests for
  `calculatePriorityScore` (weighting, threshold boundary, challenged bonus)
  and `getPortfolioBriefing` (conversationId fix, alert counting, staleness
  fallback logic, challenged-assumption flagging, score ordering).

### Code Quality Refactors

- Rewrote `getPortfolioBriefing` to use grouped SQL aggregates (`count`,
  `max`, `selectDistinct`) instead of loading full `decisions`,
  `assumptions`, and `portfolioAlerts` tables into memory; moved dynamic
  `await import(...)` calls to top-level imports; removed an always-overwritten
  dead default.
- Added a shared `STALE_REVIEW_DAYS` constant in `lib/portfolio/priorityQueue.ts`
  and used it in `calculatePriorityScore`, `TopTenQueue.tsx`, and
  `app/portfolio/page.tsx` instead of three independent hardcoded `7`s.
- Fixed `app/portfolio/page.tsx` `<td>` with `display: flex` (breaks cell layout
  semantics); moved flex classes to wrapping `<div>`.
- Added `refreshKey` prop to `TopTenQueue`; `Sidebar.tsx` bumps it after sync
  completes, so the queue re-fetches with fresh alert counts.

### Repository Health

- Cleared the `.next` build artifact with stale/invalid entries in
  `.next/dev/types/validator.ts` that were causing `npm run typecheck` to fail;
  a rebuild regenerated it clean.
- Added `tsconfig.tsbuildinfo` to `.gitignore` and untracked it.
- Retitled the Vercel-deployment placeholder `index.html` to "JP Invest" and
  added a comment on its purpose.
- Silenced dotenv's promotional startup tips (`upstream@17.4.2`). Created
  `scripts/dotenv-quiet.ts` to set `DOTENV_CONFIG_QUIET` before `dotenv/config`
  (preserves `DOTENV_CONFIG_PATH`/`OVERRIDE`/`ENCODING` support). Updated
  `db/client.ts`, `drizzle.config.ts`, `scripts/research-refresh.ts`, and
  `scripts/eval-m001-provider.ts` to use the quiet option. `npm run build`
  output now contains zero promotional lines.

### Governance & Documentation

- Accepted the Milestone 4 packet (`docs/milestones/M004-multi-thesis-briefing.md`:
  `proposed` -> `accepted`) since its priority-queue and status-index steps
  were already implemented.
- Updated `ACTIVE_MILESTONE.md` status to `in_progress` and documented that
  steps 2–3 are complete with fixes; corrected `npm audit --omit=dev` finding
  count (two moderate, transitive `postcss` via `next`).
- Regenerated `docs/generated/code-index.json`.

## Previous Milestone 4 Implementation (prior session)

- Implemented the Top-10 Priority Queue (`lib/portfolio/priorityQueue.ts`,
  `app/api/portfolio/briefing/route.ts`, `components/TopTenQueue.tsx`) and the
  filterable Status Index (`app/portfolio/page.tsx`).

## Previous Provider-Gate Implementation

- Added required provider-call context to the project-owned `LLMProvider`
  contract: route, DEC-0009 data class, and runtime facts.
- Added a pure DEC-0009 provider gate and a single external provider HTTP
  helper that logs allowed/blocked attempts without prompt or payload text.
- Updated `OllamaProvider` to route external fetches through the gated
  helper.
- Extended the M001 multimodal evaluator with six DEC-0009 provider-boundary
  cases while preserving `modelEligibility: not_evaluated`.
- Release evidence:
  [`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)

## Verification Evidence

Latest full verification: 2026-07-18.

- `npm run context:generate` + `npm run context:check`: pass
- `npm run status:check`: pass
- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass — 109 tests passed, 3 skipped (adds `tests/migrations.test.ts`
  and new coverage in `tests/decisions.test.ts` / `tests/portfolio-briefing.test.ts`)
- `npm run build`: pass
- `npm run test:e2e`: pass — 3 Playwright checks passed
- `npm run verify`: pass
- Manual end-to-end smoke (temp SQLite DB, real migration + service stack):
  Buy → Hold → Exit timeline chronologically ordered with correct
  `previousAction` deltas; portfolio briefing returns the correct
  `lastOutcome`/`lastAction`.

Previous full verification: 2026-07-17 (104 tests passed, 3 skipped).

## Remaining Boundaries

- DEC-0010 is accepted for local POC only. It does not authorize production
  cloud processing.
- No real OCR engine, vision model, local model, or production cloud
  provider was approved as active in this slice.
- `modelEligibility` remains `not_evaluated` for production.
- Portfolio/position data, credentials, account screenshots, raw database
  exports, identity documents, unrelated personal files, and production
  external processing remain blocked.
- Secondary-source and general-news ingestion remain deferred.
- `npm audit --omit=dev` reports two moderate dependency findings (transitive
  `postcss` via `next`); no forced breaking upgrade was applied in this
  slice.
- DEC-0009 lines 80/81 describe recorded Buy/Hold/Reduce/Exit decisions
  inconsistently (allowed as "POC workflow confidential" vs. blocked as
  "portfolio and position data"); unresolved, flagged for a decision
  amendment. This slice treats the blocked reading as binding and keeps
  review history local-only.

## Exact Resume Point

Milestone 4 (all four core steps) is implemented and fully verified
(`npm run verify` and `npm run test:e2e` both pass as of 2026-07-18). Next
decision is whether to flip the milestone packet
(`docs/milestones/M004-multi-thesis-briefing.md`) and `ACTIVE_MILESTONE.md`
top-level `Status:` to complete, and whether to open a decision amendment
resolving the DEC-0009 lines 80/81 conflict on recorded decision data.
