# Session Checkpoint - 2026-07-19

## Repository State

- Branch: `main`
- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Phase: Milestones 4 and 5 complete. Milestone 5 (OCR/vision provider
  eligibility): Slice 0 implemented, `DEC-0012` accepted (`minimax-m3:cloud`
  POC OCR/vision eligibility), `DEC-0013` accepted (retired
  `gemini-3-flash-preview` from the allowlist, promoted
  `deepseek-v4-flash:cloud`)
- Commits this session: `e3f10ab` (M004 Step 4), `c931a61` (status flip),
  `ff91d24` (M005 implementation), `f997bc1` (DEC-0013 amendment)
- App state: allowlisted model selector active for five approved Ollama
  Cloud models (`kimi-k2.7-code:cloud`, `qwen3.5:cloud`,
  `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, `minimax-m3:cloud`);
  local portfolio holdings (100 asset scale), priority queue, status index,
  and decision-history timeline fully integrated with typed schema

## Implemented This Session (2026-07-19)

### Governance: DEC-0009 Amendment & Milestone 5 Roadmap

- Drafted, then user-accepted, `DEC-0011`, amending DEC-0009's ambiguous Data
  Classification Gate: recorded Buy/Hold/Reduce/Exit decision outcomes are
  now explicitly governed by the "Portfolio and position data" row only
  (blocked), never the "POC workflow confidential data" row. Added a
  one-line signpost to `DEC-0009-provider-security-gate.md` pointing to
  DEC-0011 without rewriting the original decision text, per this repo's
  amend-via-new-decision convention (`DEC-0008`).
- Updated `docs/decisions/INDEX.md`, `ACTIVE_MILESTONE.md`,
  `docs/CODEBASE_MAP.md`, and this checkpoint to stop describing the
  classification as unresolved and point to DEC-0011 (accepted) instead.
- Drafted `docs/milestones/ROADMAP.md` sequencing three previously-deferred
  candidates as separate milestones (per R-005's small-vertical-milestone
  preference) rather than one bundled packet: M005 (OCR/vision provider
  eligibility) → M006 (production confidential-data provider approval) →
  M007 (secondary-source/news ingestion). Ordered by readiness: M005 already
  has evaluator scaffolding for `vision` capability flags and
  `exact_verified`/`ocr_matched`/`derived` classes; M006 has a concrete
  checklist in DEC-0009 but needs real vendor terms verified; M007 has no
  scaffolding and needs its own upstream product decision first.
- Drafted, then user-accepted, `docs/milestones/M005-ocr-vision-provider-eligibility.md`
  using the full M001 packet template. User agreed with the recommendation
  to reuse the existing Ollama Cloud allowlist rather than integrate a new
  provider: candidate is `gemini-3-flash-preview`, fallback
  `minimax-m3:cloud` (both already declare `vision: true` in
  `lib/ai/ollama-models.ts`).
- **Scope discovery:** wiring the candidate provider is not a no-op. No code
  path exists today to send a real image to any provider —
  `lib/ai/provider.ts`'s `ProjectMessage` is plain-text only, the Ollama
  adapter never attaches image bytes, and the "multimodal" fixtures in
  `docs/evals/M001/multimodal-cases.json` are JSON *descriptions* of
  documents, not real image files. `lib/research/extractors/document.ts`
  explicitly throws `unsupported_visual` / `scanned_document` rather than
  calling a real OCR/vision engine — these are the exact seams DEC-0008 left
  unfilled. User chose to expand M005 (add a new Slice 0) rather than fake
  eligibility with a text-only proxy eval. Confirmed feasible before
  proceeding: `OLLAMA_API_KEY` is set locally and `@playwright/test` is
  already a devDependency (usable to render a real image fixture).

### M005 Slice 0: Image/Attachment Plumbing & Eligibility Eval

- `lib/ai/provider.ts`: added `ProjectMessageAttachment` (`{ type: 'image',
  mimeType, base64 }`) and an optional `attachments?` field on
  `ProjectMessage`. `content` remains a required string — every existing
  text-only caller is unaffected.
- `lib/ai/adapters/ollama.ts`: added a `toOllamaMessage` helper mapping
  `attachments` to Ollama's per-message `images: string[]` (base64, no
  data-URI prefix) field on both `fetchChat` and `structuredExtract`. Flagged
  in-code: Ollama Cloud's request-shape parity with local Ollama's `images`
  convention has not been independently verified from vendor docs.
- `lib/ai/adapters/mock.ts`: `MockProvider.chat` now returns a fixed
  transcription string when a message carries attachments, so deterministic
  tests can exercise the new shape without live calls.
- `lib/research/extractors/ocr.ts`: added `extractVisionOcrCandidate`, the
  real-provider counterpart to `extractSyntheticOcrCandidate` — sends real
  image bytes to a configured provider, verifies the candidate quote appears
  in the returned transcription, and always wraps the result as
  `ocr_matched` (never `exact_verified`). Deliberately **not** wired into
  `CitationPipeline`'s automatic extraction-recovery path: the production
  research flow discovers evidence open-endedly against an assumption, which
  is a larger extraction-ranking design than eligibility testing requires —
  documented as a follow-up in `docs/CODEBASE_MAP.md`.
- `scripts/generate-vision-fixtures.ts` (new, `npm run fixtures:vision:generate`):
  renders two small HTML pages (a PLTR 10-Q excerpt, a BBRI filing excerpt)
  and screenshots them via Playwright into real PNGs under
  `docs/evals/M001/fixtures/vision/` — genuine image bytes a vision model
  must actually read, not a JSON description. Not real company filings; see
  the generated `PROVENANCE.md` alongside the fixtures.
- `scripts/eval-m001-provider.ts`: added `buildRealVisionPrompt`, a new
  prompt/grading path (dispatched on `input.real_image_fixture`) that reads a
  real fixture file, base64-encodes it, attaches it to the live provider
  call, and grades whether the returned transcription contains the known
  candidate quote — distinct from the existing JSON-description
  self-report grading used by the original 16 multimodal cases.
- `docs/evals/M001/multimodal-cases.json`: added two real-image cases
  (`MM-017` English filing scan, `MM-018` Indonesian filing scan); case count
  16 → 18. `tests/multimodal-eval.test.ts` updated to match.
- Tests: `tests/ollama-provider.test.ts` gained attachment-serialization
  coverage; `tests/document-extraction.test.ts` gained a stubbed-provider
  vision-extraction case (matches) and a mismatch case (rejects). Full suite:
  113 passed, 3 skipped (up from 104).

### M005 Eligibility Eval Outcome

- Primary candidate `gemini-3-flash-preview`: deterministic pass succeeded;
  live pass failed uniformly (34/37 cases, including both real-image cases)
  with `"gemini-3-flash-preview was retired at 2026-07-15 00:00:00 -0700
  PDT"`. Confirmed via 34 identical transcript errors — total model
  unavailability, not a vision-capability failure.
- Pivoted to the fallback, `minimax-m3:cloud`, per the milestone's own
  documented contingency: deterministic pass succeeded; live pass completed
  with 0 hard-gate failures, 0% citation hallucination rate, ~90% assumption
  extraction completeness, and both real-image transcription cases
  (`MM-017`, `MM-018`) passing exactly with no `exact_verified` mislabeling.
  Evidence: `docs/evidence/releases/2026-07-19-{gemini,minimax}-vision-eval/`.
- Drafted, then user-accepted, `DEC-0012`, following DEC-0010's exact
  skeleton, recording this outcome and granting eligibility for
  `minimax-m3:cloud`'s vision capability only. Does not re-approve
  `gemini-3-flash-preview` and does not approve production use. Added
  evidence manifests (`docs/evidence/releases/2026-07-19-{gemini,minimax}-vision-eval/manifest.md`)
  matching the Kimi eval's retained-evidence convention, including a
  dedicated "blocked" manifest documenting the gemini retirement finding.
  M005's packet is now `complete` — all four Acceptance Criteria met.

### DEC-0013: Retire gemini-3-flash-preview, Promote deepseek-v4-flash:cloud

- Drafted and user-accepted `DEC-0013`, amending `DEC-0010` per the user's
  explicit direction: remove `gemini-3-flash-preview` from the approved
  allowlist (confirmed retired by the provider) and promote
  `deepseek-v4-flash:cloud` in its place, reusing its existing
  `accepted_for_poc` result from the 2026-07-11 multi-model evaluation — no
  new eval run was required, since that model's text eligibility was already
  recorded (73.3% extraction completeness, 33.3% CTA relevance, 0%
  hallucination, 0 hard-gate failures). Added a signpost to `DEC-0010`
  pointing to `DEC-0013`, following the same amend-via-new-decision
  convention used for `DEC-0011` — `DEC-0010`'s original text is unchanged.
- `lib/ai/ollama-models.ts`: removed `gemini-3-flash-preview` from
  `OLLAMA_MODEL_IDS`, `OLLAMA_MODEL_EVAL_ORDER`, and `OLLAMA_MODEL_OPTIONS`.
  The allowlist is now five models. `components/ChatUI.tsx`'s selector maps
  over `OLLAMA_MODEL_OPTIONS` directly, so it needed no separate change.
  `lib/ai/ollama-config.ts`'s default (`kimi-k2.7-code:cloud`) was already
  unaffected.
- `tests/ollama-models.test.ts` updated to assert the five-model roster, the
  updated fixed eval order, and that `gemini-3-flash-preview` is now rejected
  by `isOllamaModelId`. Full suite: 113 passed, 3 skipped (unchanged from
  before this change — no test relied on the retired model beyond the
  registry test itself).
- `docs/RISK_REGISTER.md` R-024 moved from `Open` to `Mitigated`, referencing
  `DEC-0013`. `ACTIVE_MILESTONE.md`'s prior "not yet amended" follow-up item
  is now marked resolved.
- Historical evidence (`docs/evidence/releases/2026-07-11-model-evals/`,
  `2026-07-09-kimi-provider-eval/`) was deliberately left unmodified — it
  correctly records what was true at the time those evals ran.

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
  provider (DEC-0009 boundary). The DEC-0009 lines 80/81 ambiguity on
  recorded Buy/Hold/Reduce/Exit decision classification is now resolved by
  `DEC-0011` (`proposed`), which binds the blocked "portfolio and position
  data" reading.
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

Latest full verification: 2026-07-19.

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass — 113 tests passed, 3 skipped (adds attachment-serialization
  and vision-extraction coverage; multimodal case count 16 → 18)
- `npm run eval:m001:multimodal`: pass — 16 base cases, 18 multimodal cases
  (16 original + 2 real-image), 0 hard-gate failures
- `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview`:
  pass (`docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`)
- `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview`:
  blocked — model retired by provider as of 2026-07-15
  (`docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`)
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud`:
  pass (`docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`)
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud`:
  pass — 0 hard-gate failures, 0% citation hallucination, both real-image
  cases passed
  (`docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`)
- `npm run build`: pass
- `npm run test:e2e`: pass — 3 Playwright checks passed
- `npm run status:check`: pass
- `npm run context:check`: pass after regenerating the code index
- `git diff --check`: pass
- Re-verified (typecheck, lint, 113 tests, build, status/context checks)
  after accepting `DEC-0012` and updating cross-referencing docs — all pass.

Previous full verification: 2026-07-18 (109 tests passed, 3 skipped).

## Remaining Boundaries

- DEC-0010 is accepted for local POC only. It does not authorize production
  cloud processing.
- `modelEligibility` remains `not_evaluated` for production — DEC-0012 only
  covers POC OCR/vision eligibility.
- Portfolio/position data, credentials, account screenshots, raw database
  exports, identity documents, unrelated personal files, and production
  external processing remain blocked.
- Secondary-source and general-news ingestion remain deferred (M007).
- `npm audit --omit=dev` reports two moderate dependency findings (transitive
  `postcss` via `next`); no forced breaking upgrade was applied in this
  slice.
- `extractVisionOcrCandidate` exists and is tested but is not wired into
  `CitationPipeline`'s automatic extraction-recovery path — open-ended,
  assumption-driven vision extraction remains a follow-up.
- The real-image eval cases (`MM-017`, `MM-018`) did not include an embedded
  prompt-injection probe (R-018 residual risk).

## Exact Resume Point

Milestones 4 and 5 are both complete and merged. Next action:

1. **Milestone 6** — Production Confidential-Data Provider Approval, per
   `docs/milestones/ROADMAP.md`. Not yet scoped as a packet. Complete
   DEC-0009's "Provider Approval Requirements" checklist for the five
   currently-accepted models (Ollama Cloud vendor terms already reviewed
   under DEC-0010; this is largely a verification/decision-record task, not
   new application code).
