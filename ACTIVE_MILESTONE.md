# Active Milestone

Status: `complete`

Active Packet: [`docs/milestones/M010-structural-evidence-precision.md`](docs/milestones/M010-structural-evidence-precision.md) (complete 2026-07-27; all four slices plus governance close-out implemented, tested, and proven live end-to-end — see "Slice Outcomes")

Latest Completed Packet: [`docs/milestones/M010-structural-evidence-precision.md`](docs/milestones/M010-structural-evidence-precision.md) (complete; R-026 → `Mitigated`, R-025 deliberately **returned to `Open`** — block-boundary segmentation + secondary-tier shape guards + a five-rule listing-page guard + a re-deriving cleanup of the 15 already-persisted rows, proven by 31 new tests, byte-identical `canonicalText` on four real snapshots, unregressed M001 evals, and a live refresh that fetched a genuine article instead of the listing page)

See [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md) for the M005→M010 sequence. The M006 slot was re-planned on 2026-07-25: its original subject (production confidential-data provider approval) was withdrawn by [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md). M007's Class C (web search discovery) was deliberately deferred to M008, which shipped 2026-07-26 as [`M008-web-search-discovery.md`](docs/milestones/M008-web-search-discovery.md) — provider chosen (Tavily) with live-evaluated evidence, not by reputation; see the packet's §0. M008's first live run then surfaced the precision defect M009 fixes; see the paragraph below.

## Current Phase

M010 closed a gap M009 could not, and the distinction is the point. M009's three
mechanisms all filter on **vocabulary**; the 2026-07-27 live run produced a
failure of **shape** — a category-filter widget that cleared every M009 gate by
matching the literal word "Enterprise", a nav category label colliding with a
genuine assumption's word "enterprise". Three structural holes were confirmed
and fixed: `extractHtml` joined block elements with a space, so a nav widget
reached `splitSentences` as one punctuation-free run-on that `Intl.Segmenter`
returns as a single giant segment with maximal token surface (now marked with a
`U+FFFC` sentinel and exposed as `ExtractedPage.blocks`); `rankSentenceCandidates`
had no upper length bound and no length penalty (now a 400-character cap and an
8–14 word band for unpunctuated text, both secondary-tier only); and
`discoverIssuerPressReleases` accepted any link whose *container* mentioned a
press-release term, so the pipeline systematically fetched the newsroom listing
page and mined it (now five rejection rules taking the real snapshot from 29
refs to exactly 9 genuine articles). `canonicalText` is proven byte-identical on
all four retained real snapshots, and the tested identity `blocks.join(' ') ===
text` is what guarantees every quote is still a verbatim substring for
`verifyExactMatch`. Segmentation and both guards are gated on
`sourceTier === 'secondary'`, so the official path reduces to literally the
pre-M010 expression. The 15 already-persisted low-quality rows were removed by a
sweep that re-derives rather than pattern-matches — stale iff the fixed
extractor no longer produces the quote — which makes it self-validating.
**R-026** → `Mitigated`; **R-025 deliberately returned to `Open`**, because its
own trigger fired and M009's mitigation was necessary but not sufficient.
Verified live: the post-fix refresh fetched a genuine `/news/...` article and
persisted 2 rows of real press-release prose where the prior run persisted 15
rows of chrome — though one of those two matched partly on division names, so
*semantic* relevance remains unsolved and R-025 says so.

M009 closed the gap M008's first live run opened: several `secondary_issuer` evidence rows persisted as site-wide web boilerplate despite correct trust-tier labeling. Three layered mechanisms now guard `rankSentenceCandidates`
(`lib/research/extractors/candidate.ts`) and `extractHtml` (`lib/research/extractors/document.ts`) — DOM-level chrome stripping, a phrase-level denylist, and a `sourceTier`-gated qualifying-token rule that excludes the ticker and bare years from the secondary-path match minimum, the only mechanism able to catch a genuine but topically irrelevant article (the real CSR/coral-reef case) that no denylist or DOM rule can reach. The official path is proven byte-for-byte unchanged: `extractDeterministicCandidates` always calls with `sourceTier: 'official'`, so the new gate never fires for it, confirmed by a new official-tier HTML-chrome regression fixture plus the unchanged M001 eval case count (23, 0 hard-gate failures). Reviewed independently twice before implementation — a second AI collaborator (Gemini) and a separate reconciliation pass both converged on the same root cause and the same qualifying-token mechanism as the fix for the CSR-class failure. Company-name-token exclusion was explicitly scoped out (no such field exists in the call chain) and recorded as residual risk rather than silently covered. R-025 → `Mitigated`.

M001 (Existing Thesis Loop, `local-only complete`), M002 (Portfolio Positions & Ingestion Alerts), M003 (Explore-To-Tracked Loop), M004 (Multi-Thesis Briefing), M005 (OCR/Vision Provider Eligibility), M006 (In-Pipeline Vision Extraction & Injection Hardening), M007 (Secondary-Source/General-News Ingestion), M008 (Web Search Discovery, Class C), and M009 (Secondary Evidence Boilerplate Filtering) are 100% completed and verified.

Milestone 8 closes the gap M007 deliberately left open: `discoveryCandidates`
(schema-ready since M007, unpopulated until now) is wired to a real search
provider. `TavilyDiscoveryProvider` (`lib/research/discovery/tavily.ts`) was
chosen from real measured data, not vendor reputation — 12 live runs across
5 tickers (3 Indonesian, 2 US control), with a load-bearing caveat honestly
recorded rather than hidden: runs 3-12 returned byte-identical URLs
(server-side caching), so the effective independent sample is closer to 2-3
runs than 12. Google News RSS and Serper were evaluated and parked with
documented technical reasons (RSS article links resolve via client-side JS,
not an HTTP redirect chain; Serper's free tier is a one-time 2,500-query
allocation, not recurring), not deleted — see the M008 packet's §0 and §8.

`DiscoveryCandidateUrl` (`lib/research/discovery/types.ts`) has exactly one
field, `url` — the R-013 structural gate at the type level, proven
adversarially (a response dense with snippet text feeds `toDiscoveryCandidateUrls`
and none of that text survives). A candidate can only become evidence
through `promoteCandidate` (`lib/research/discovery-promotion.ts`), which
enforces DEC-0015 §3.2's domain gate *before* any fetch — an unallowlisted
origin never reaches `OfficialHttpClient`, proven by a test asserting zero
network calls. A matched fetch lands on the **same** `secondary_issuer`/
`secondary_news` evidence classes M007 built, inheriting R-010's structural
ceiling with no new trust tier. Promotion runs automatically inside
`processResearchJobs` (Slice 3's resolved design), with an explicit CLI
counterpart, `npm run research:promote-discoveries`, for re-evaluating
candidates after `.env` allowlists change — needed because nothing else
re-checks a `rejected: domain_not_allowlisted` candidate once its domain is
later trusted.

A real review-time gap was found and fixed, not left as a known issue:
`TavilyDiscoveryProvider` called `fetch` directly with zero outbound record,
unlike every other external call in this codebase (an ADR-0006 transparency
miss caught during the packet's second-opinion review). It now logs every
attempted request to `logs/outbound.log`, proven by test. R-013 moved to
`Mitigated` — the mechanism is proven; real-world coverage is still zero,
since `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` remain unconfigured
in the live environment (the same bootstrapping gap M007 already flagged
for Class A/B), recorded as residual risk rather than assumed away.

Milestone 7 added two secondary evidence classes — `secondary_issuer`
(company IR press releases) and `secondary_news` (curated financial news
wires) — structurally incapable of ever being promoted to `exact_verified`/
`ocr_matched`: `extractSecondaryCandidates` (`lib/research/extractors/candidate.ts`)
is a dedicated function whose only exits are dedicated factories, so the
invariant lives in which function was called, not in a runtime check.
Proven adversarially by reusing exact-verified-shaped source text through
the secondary path (unit test and eval case `MM-023`) and confirming it
still cannot be promoted. New adapters `IssuerPressReleaseAdapter`/
`NewsWireAdapter` (`lib/research/adapters/`) always tag `sourceTier: 'secondary'`
— deliberately siblings to, not reuses of, `IssuerAdapter`, which hardcodes
`'official'`. An assumption resting only on secondary evidence is gated to
`pending_confirmation`, clearing to `untested` when official evidence
arrives or to a distinct `user_confirmed_secondary` (never `verified`) on
explicit user acceptance — both transitions proven end-to-end through real
`processResearchJobs` calls, not just the pure decision function in
isolation. Secondary-source failures are isolated: a throwing adapter never
changes `research_jobs.status`. R-010 moved to `Mitigated`.

**Deliberately not done in M007 — Class C (web search discovery):** recorded
at the time as a new, unscoped **M008** rather than silently left inside
M007. M008 has since shipped (2026-07-26) — see the paragraph above and the
M008 packet's "Slice Outcomes".

A real regression surfaced and was fixed mid-milestone: turning the
assumption-status line from raw enum text into a proper badge broke two
pre-existing Playwright assertions expecting the old literal text — caught
by `npm run test:e2e`, not vitest, and fixed by updating the assertions to
match the new (correct) UI.

Milestone 6 made M005's proven OCR/vision capability reachable from the
product instead of remaining an isolated eval seam, and moved R-018's
injection mitigation from the evaluator into real product code. `extractDocument`
(`lib/research/extractors/document.ts`) now accepts an optional
`VisionTranscriber`; when configured, an image source is transcribed by the
DEC-0012-eligible model and flows through the normal evidence pipeline as
`ocr_matched` — never `exact_verified`, enforced structurally by
`extractDeterministicCandidates` gating on `sourceVariant`, not by convention.
`scanEmbeddedInstructions` now runs in every extractor and at the
`generateDecisionRecommendation` prompt boundary — previously it ran only in
tests and the eval script. A live probe against `minimax-m3:cloud`
(2026-07-25) confirmed the model transcribes an embedded English instruction
faithfully without complying with it; the Indonesian-language companion probe
also produced no compliance, but by a different, less-understood path (the
model's transcription omitted the injected text rather than surfacing it for
the scanner to catch) — so the scanner's documented English-only limitation
remains real and un-exercised live, confirmed instead by direct unit test.
See [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)
for the full honest account. No production wiring selects a vision provider
yet — `CitationPipeline` is still constructed without one, so image sources
fail closed in the running app; turning it on is a separate future decision.

**Same-day addendum:** the Indonesian probe's honest caveat prompted a direct
follow-on — an optional multilingual `InstructionClassifier`
(`lib/research/extractors/safety.ts`) that runs as a second opinion only when
the regex finds nothing, wired through `extractDocument`/`CitationPipeline` at
extraction time. Fails closed on any error. Off by default, same posture as
the vision path — nothing calls a provider for this until a caller configures
one, so the running app's R-018 coverage is still regex-only today. Proven by
unit test with a stub classifier catching the Indonesian text the regex
misses. R-018 stays `Open`; this narrows the gap rather than closing it. See
the M006 packet's "Addendum" section.

Milestone 5 answered one question: is a real OCR/vision-capable model,
reached through the already-accepted Ollama Cloud POC boundary, eligible for
continued POC use on the multimodal evidence pipeline scaffolded since
DEC-0008. Real image-attachment support was added to the provider boundary
(`lib/ai/provider.ts`, `lib/ai/adapters/ollama.ts`), a real-provider vision-
extraction seam (`extractVisionOcrCandidate` in `lib/research/extractors/ocr.ts`)
was added alongside the existing synthetic-fixture path, and two genuine
Playwright-rendered image fixtures were used for a live eligibility eval. The
primary candidate, `gemini-3-flash-preview`, was found retired by the
provider mid-eval; the fallback, `minimax-m3:cloud`, passed cleanly (0
hard-gate failures, 0% hallucination, both real-image transcription cases
exact). [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
(accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility.
[`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
(accepted) removed the retired model from DEC-0010's allowlist and promoted
`deepseek-v4-flash:cloud` for general POC use.

Milestone 4 scaled holding tracking from one active thesis to 100 assets with priority ranking and comprehensive status. All four core steps shipped:

1. **Top-10 Priority Queue** (`lib/portfolio/priorityQueue.ts`, `components/TopTenQueue.tsx`) — scores holdings from unread filing alerts, review staleness, and challenged assumptions.
2. **Comprehensive Status Index** (`app/portfolio/page.tsx`) — sortable/filterable table of all watchlisted and active portfolio positions.
3. **Navigation & Briefing Integration** — fixed routing bug (thesis-linked items now use conversationId, not thesisId); `db/queries.ts#getPortfolioBriefing` computes ranked list via grouped SQL aggregates and returns both `conversationId` and latest decision outcome/action.
4. **Review History Retention** — `db/schema.ts#decisions` now stores typed `outcome`/`action` columns (migration `0006_normalize_decision_outcomes` backfilled prior packed rows and normalized timestamp formats); decision reads carry explicit `orderBy(createdAt)`; Research drawer, Status Index, and Top-10 Queue surface chronological timeline with "changed from X" deltas and latest recorded outcome/action. Regression test guards that recorded decisions never reach provider prompts (DEC-0009 boundary).

The deterministic mock workflow remains the default QA path. The live research
slice already provides SEC filing retrieval, official IDX announcement
retrieval, bounded official issuer fallback, immutable snapshots and
provenance, exact verification, incremental cursors, idempotent refresh, and
local daily scheduling.

The multimodal slice now preserves distinct evidence classes through extraction,
verification, persistence, export/import, API DTOs, and the Research UI:

- `exact_verified` for HTML and text-layer PDF source text matched against
  canonical extracted text.
- `ocr_matched` for retained OCR or screenshot text, never promoted to exact
  source text.
- `derived` for table, chart, XBRL, and deterministic calculation outputs with
  retained inputs, units, method, page, and provenance.

The evaluator scaffold reads the accepted base and multimodal M001 suites,
records deterministic first-slice readiness, and now includes provider-boundary
cases for DEC-0009 data classes. `modelEligibility` remains `not_evaluated`;
the gate does not approve a model or production provider.

The new provider-eval harness now records candidate-model metadata, fixed
allowlist order, deterministic baseline results, and a separate live-eval path
for local confidential runs. Kimi is the default candidate and first eval
target. The live Kimi report has run successfully with clean results and zero
hard-gate failures.

The DEC-0009 provider gate now requires all LLM calls to carry route and data
class context through the project-owned `lib/ai` boundary. POC workflow
confidential data is allowed only in the local POC boundary. Portfolio/position
data, restricted personal or financial secrets, and production confidential
processing fail closed before any external provider fetch.

Periodic ingestion remains local-only under ADR-0006. It runs through
`npm run research:refresh` or Windows Task Scheduler and writes to the external
SQLite database. No private research data or SQLite worker is deployed to
Vercel.

## Fresh Verification

Latest full verification: 2026-07-27 (M010 implementation, all four slices plus
governance close-out).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-27 (**237
  passed, 3 skipped** — up from 206 at M009's close; adds 12 M010 shape/
  segmentation cases to `tests/document-extraction.test.ts`, 7 listing-page
  guard cases to `tests/source-adapters.test.ts`, and the new
  `tests/evidence-cleanup.test.ts` with 12 cases covering deletion, retention,
  the official-tier hard filter, missing snapshots, dry-run inertness,
  idempotence, and `user_confirmed_secondary` protection)
- `npm run build`: pass on 2026-07-27
- `npm run context:generate` / `npm run context:check`: pass on 2026-07-27
- `npm run status:check`: pass on 2026-07-27
- `npm run eval:m001:multimodal -- --output test-results/m010-multimodal-report.json`:
  pass on 2026-07-27; `additionalCaseCount: 23` unchanged, 0 hard-gate failures.
  Load-bearing here, not routine: `scripts/eval-m001-multimodal.ts` hard-gates
  `candidates.length === 0` on MM-021/022/023, so over-filtering the eval
  fixtures would have failed loudly rather than degrading silently.
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m010-provider-report.json`:
  pass on 2026-07-27; 0 hard-gate failures
- `npm run test:e2e` (Playwright): 4/4 pass on 2026-07-27 — M010 touches no UI
  code, so this is a confirmation, not an expected-change check
- **Real-data verification, beyond fixtures:** `canonicalText` byte-identical to
  a faithful re-implementation of the pre-M010 derivation on all four retained
  TLKM snapshots, with `blocks.join(' ') === text` holding on each;
  `discoverIssuerPressReleases` on the retained newsroom snapshot goes from 29
  refs (first 13 junk, `[0]` the discovery page itself) to exactly the 9 genuine
  `/news/...` articles, correctly dated, newest first
- **Live end-to-end:** `npm run research:cleanup-evidence` dry run reported 15
  scanned / 15 stale / 0 kept / 0 unresolvable; an explicit database backup was
  taken (`db-before-m010-cleanup-2026-07-27T21-30-52.sqlite`) before `--apply`;
  after applying, 0 evidence rows remained, 7 assumptions reverted to
  `untested`, all 4 `source_snapshots` rows and `.bin` files retained, and a
  second run was a clean no-op. `npm run research:refresh` then fetched
  `.../news/perkuat-peran-penggiat-budaya-...-3849` — a genuine article —
  instead of the listing page, persisting 2 rows of real press-release prose.

Previous full verification: 2026-07-26 (M009 implementation, all four slices).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-26 (206
  passed, 3 skipped — up from 199 at M008's close; adds 7 adversarial
  boilerplate-filtering cases to `tests/document-extraction.test.ts`: two
  official-tier HTML-chrome regression fixtures for Slice 1, three for the
  phrase denylist and secondary-tier qualifying-token rule reproducing the
  real 2026-07-26 TLKM failures, and two explicit non-regression cases — a
  genuine secondary press-release fact still passes, and the official path
  is untouched by the new gate)
- `npm run build`: pass on 2026-07-26
- `npm run context:generate` / `npm run context:check`: pass on 2026-07-26
- `npm run eval:m001:multimodal -- --output test-results/m009-multimodal-report.json`:
  pass on 2026-07-26; `additionalCaseCount: 23` unchanged from M008, 0
  hard-gate failures — confirms official-filing recall is unregressed
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m009-provider-report.json`:
  pass on 2026-07-26; 0 hard-gate failures; deterministic only, no live run
  needed since M009 makes no provider-boundary change
- `npm run status:check`: pass on 2026-07-26
- `npm run test:e2e` (Playwright): 4/4 pass on 2026-07-26, after restarting
  the stale dev server on port 3000 (the pre-existing Turbopack
  compiler-worker crash flagged at the end of the prior session) with the
  user's explicit go-ahead — confirms no regression to the Research panel;
  M009 touches no UI code, so this is a confirmation, not an expected-change
  check.

Previous full verification: 2026-07-26 (M008 implementation, all five slices).

- `npm run typecheck`, `npm test`: pass on 2026-07-26 (191 passed, 3
  skipped — up from 156 at M007's close; adds discovery-provider
  outbound-logging, discovery-persistence, domain-gate/promotion, and
  automatic-promotion integration coverage for M008 across
  `tests/discovery-eval.test.ts`, `tests/discovery-promotion.test.ts`
  (new), and `tests/research-service.test.ts`)
- `npm run build`: pass on 2026-07-26
- `npm run test:e2e` (Playwright): 3/3 pass on 2026-07-26 — confirms no
  regression to the Research panel; does not exercise the new Discovery
  Candidates section itself, since no e2e fixture seeds a
  `discoveryCandidates` row (that path is covered by the unit/integration
  tests instead, not visually verified in a browser)
- `npm run status:check`, `npm run context:check`: pass on 2026-07-26

Previous full verification: 2026-07-25 (M007 implementation, all eight slices).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-25 (156
  passed, 3 skipped — up from 130 at M006's addendum; adds schema,
  extractor/candidate structural gate, adapter, pipeline/service
  integration, confirmation-gate, UI, and eval coverage for M007)
- `npm run build`: pass on 2026-07-25
- `npm run test:e2e` (Playwright): 3/3 pass on 2026-07-25, after fixing a
  real regression the suite caught (assumption-status badge text change —
  see "Current Phase")
- `npm run eval:m001:multimodal -- --output test-results/m007-slice7-multimodal-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, `additionalCaseCount: 23` (up
  from 20) — includes the first genuinely assertive cases in this suite
  (`MM-021`/`022`/`023`); every prior case in this file had `status: 'passed'`
  hardcoded and could not actually fail
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m007-slice7-provider-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, confirms `additionalCaseCount: 23`
  propagates through this script unchanged
- `npm run status:check`, `npm run context:check`: pass on 2026-07-25

Previous full verification: 2026-07-25 (M006 implementation + live injection-probe eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-25 (124
  passed, 3 skipped — adds vision-extraction-pipeline, R-017 structural
  invariant, and R-018 prompt-boundary/scanner-gap coverage; multimodal case
  count 18 → 20)
- `npm run build`: pass on 2026-07-25
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m006-deterministic-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, 20 multimodal cases,
  `modelEligibility: not_evaluated` (correct pre-live state)
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-25-m006-injection-eval/02-live-report.json`:
  0 hard-gate failures; `acceptanceOutcome: blocked` — unchanged in shape from
  the already-accepted 2026-07-19 minimax baseline (same ~20 base-suite
  failures, unrelated to vision/injection); both injection-probe cases
  (`MM-019`, `MM-020`) passed with no model compliance. See the manifest's
  "Honest note" on what `MM-020` does and does not prove.
- `npm run status:check`, `npm run context:check`: pass on 2026-07-25

Previous full verification: 2026-07-19 (M005 Slice 0 + eligibility eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 (113
  passed, 3 skipped — adds attachment-serialization and vision-extraction
  coverage; bumps multimodal case count to 18)
- `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`:
  blocked on 2026-07-19 — model retired by provider as of 2026-07-15
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`:
  pass on 2026-07-19; 0 hard-gate failures, 0% citation hallucination, both
  real-image transcription cases (`MM-017`, `MM-018`) passed exactly
- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 after
  DEC-0013's allowlist change (five-model roster; 113 passed, 3 skipped)

Previous full verification: 2026-07-17.

Latest targeted provider-package verification: 2026-07-11.

- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- `npm run context:check`: pass on 2026-07-17 after regenerating the code index
- `npm run status:check`: pass on 2026-07-17 after accepting the M004 packet
- TypeScript `tsc --noEmit`: pass on 2026-07-17 (a stale `.next` build artifact
  had been causing 5 spurious errors in generated dev types; cleared and
  rebuilt clean)
- ESLint `eslint`: pass on 2026-07-17
- Vitest: 104 pass; 3 opt-in live checks skipped on 2026-07-17 (adds
  `tests/portfolio-briefing.test.ts` covering the M4 priority queue and
  briefing query)
- Next.js production build: pass on 2026-07-17
- Playwright: 3 pass on 2026-07-17
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
  - OCR and derived trust-class labels visible in the Research drawer
- `npm run verify:full`: pass on 2026-07-17
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases: pass
  - DEC-0009 provider-boundary cases: 6 pass
  - hard-gate failures: none
  - model eligibility: `not_evaluated`
- `git diff --check`: pass
- `npm run status:check`: pass on 2026-07-09 after drafting DEC-0010
- `npm test -- tests/provider-gate.test.ts tests/provider-boundary.test.ts tests/ollama-provider.test.ts`:
  pass on 2026-07-09; 14 tests passed
- `npm test -- tests/api-contracts.test.ts tests/ollama-provider.test.ts tests/ollama-models.test.ts tests/research-service.test.ts`:
  pass on 2026-07-09; 21 tests passed
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`:
  pass on 2026-07-09; 16 base cases, 16 multimodal addendum cases,
  6 provider-boundary cases, no hard-gate failures, `modelEligibility:
  not_evaluated`
- `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`:
  pass on 2026-07-09; Kimi metadata recorded, fixed eval order recorded,
  deterministic baseline loaded, 6 provider-boundary cases passed
- `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`:
  pass on 2026-07-11; completed successfully with 0 hard-gate failures, 0%
  hallucination rate, and 93.3% assumption extraction completeness

Release evidence:
[`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)
[`docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md`](docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md)
[`docs/evidence/releases/2026-07-11-model-evals/manifest.md`](docs/evidence/releases/2026-07-11-model-evals/manifest.md)
[`docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)

## Remaining Boundaries

- M001 is **`local-only complete`** as of 2026-07-25. It previously stayed open
  on two items. Real OCR/vision provider eligibility is resolved for POC use
  (`minimax-m3:cloud`, DEC-0012). Production confidential-data provider
  approval is no longer outstanding: [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
  places production/hosted processing explicitly out of scope, so it no longer
  holds M001 open. Provider-specific current-source approval remains an
  in-scope open boundary, tracked on its own rather than inherited from a
  withdrawn milestone.
- [`DEC-0010`](docs/decisions/DEC-0010-ollama-cloud-poc-approval.md) is an
  accepted Ollama Cloud POC approval package. The app now exposes an
  allowlisted selector for `kimi-k2.7-code:cloud`, `qwen3.5:cloud`,
  `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, and `minimax-m3:cloud`
  (five models, all `accepted_for_poc`). Real confidential POC traffic is
  authorized through the project-owned provider boundary under the accepted
  scopes. [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
  (`accepted`) removed `gemini-3-flash-preview` after it was confirmed
  retired by the provider (found 2026-07-19) and promoted
  `deepseek-v4-flash:cloud` in its place, using its existing 2026-07-11
  eligibility result — no new eval run was required for that promotion.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  and implemented as the POC provider/security gate. It permits local POC
  workflow confidential routing through the project-owned provider boundary,
  but does not approve production external processing or selectable model
  eligibility. Portfolio/position data, credentials, account screenshots, raw
  database exports, identity documents, and unrelated personal files remain
  blocked unless a later explicit decision allows them.
  [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
  (`accepted`) clarifies that recorded decision outcomes fall under this
  blocked "portfolio and position data" classification.
- The deterministic multimodal evaluator proves first-slice application and
  provider-boundary gates; it does not approve a model, provider, cloud
  processor, or native browsing capability.
- `scanEmbeddedInstructions` (R-018 mitigation, wired into the real
  extraction path and prompt boundary by M006) is a single hardcoded English
  phrase list. The gap for non-English instructions was addressed by an optional
  `InstructionClassifier`. As of 2026-07-29, this `InstructionClassifier` is now
  wired in by default to the `CitationPipeline` for all production document extraction,
  effectively closing the language-coverage gap. R-018 is now `Mitigated`.
- No production wiring selects a vision provider. `CitationPipeline` is
  constructed without one in `lib/research/service.ts`, so image sources
  still fail closed in the running app even after M006.
- **M007 boundary, closed by M008.** Class C (web search discovery) is no
  longer deferred — see "Current Phase" above and the M008 packet's "Slice
  Outcomes". DEC-0015 named the Top-10 Queue and Portfolio Briefing as
  additional secondary-evidence badge locations; only the Research drawer
  and alerts sidebar were built — those two surfaces don't currently render
  any evidence-level trust badges at all (confirmed by grep), so extending
  them would have meant inventing new UI surface beyond M007's scope, not
  filling in an existing gap. M008's Discovery Candidates section (Slice 4)
  was likewise added only to the Research drawer, not those two surfaces,
  for the same reason.
- **M008 boundary, narrowed 2026-07-26.** `ISSUER_PRESS_RELEASE_URLS`/
  `NEWS_WIRE_FEED_URLS` are now populated — TLKM issuer press release
  (`telkom.co.id`) and CNBC Indonesia news wire, both verified live and
  reachable before configuring (`.env` comments record the verification).
  One real quality caveat found and kept deliberately, not silently shipped
  (user decision): TLKM's page has repeated header/nav links that fill
  `discoverIssuerPressReleases`'s 20-result cap before real `/news/...`
  article links are reached in DOM order, so it mostly re-discovers its own
  listing page — soft-fails to low/no yield, never to something wrong. CNBC
  Indonesia's feed is clean but general-market, not ticker-specific, so it
  yields evidence only on days a tracked ticker is actually in the news.
  Still no live end-to-end promotion has been observed from a real
  `processResearchJobs` run (only from these two adapters' `discover()`
  called directly during verification) — see `docs/RISK_REGISTER.md` R-013's
  next-review trigger. `npm run research:promote-discoveries` exists to
  re-evaluate already-discovered candidates after a future allowlist change,
  without waiting for a fresh discovery search to surface the same URL
  again.
- `npm audit --omit=dev` currently reports two moderate dependency findings
  (transitive `postcss` via `next`); no forced breaking upgrade was applied in
  this slice.
- **M009 boundary, 2026-07-26.** The boilerplate-phrase denylist covers only
  the listed English/Indonesian phrasing found in the real 2026-07-26 TLKM
  run — boilerplate worded differently, or in another language, is not
  caught. The secondary-tier qualifying-token rule excludes only the ticker
  and bare four-digit years; company-name tokens are deliberately **not**
  excluded, since no company-display-name field exists anywhere in the call
  chain reaching `rankSentenceCandidates` today (only ticker/assumption text
  do) — threading one through was scoped out rather than silently assumed
  unnecessary (see `docs/RISK_REGISTER.md` R-025). Repeated-across-pages
  boilerplate detection (the same quote recurring across multiple fetched
  pages of one domain) was considered and not built — the current pipeline
  fetches one document per adapter call, so cross-page comparison isn't yet
  structurally possible. Cleanup of the 15 already-persisted low-quality
  evidence rows from the 2026-07-26 TLKM run was explicitly out of scope —
  this milestone fixes the extractor going forward only.

## Next Steps

Milestones 4 through 10 are complete and verified.

1. ~~**DEC-0009 Amendment**~~ Accepted: [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
   clarifies that recorded Buy/Hold/Reduce/Exit decisions are governed
   exclusively by DEC-0009's "Portfolio and position data" row and remain
   blocked. See `docs/decisions/DEC-0009-provider-security-gate.md`'s
   amendment signpost.

2. ~~**Milestone 5**~~ Complete: all four Acceptance Criteria met.
   [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
   (accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility after
   the primary candidate, `gemini-3-flash-preview`, was found retired by the
   provider mid-eval.

3. ~~**Follow-up finding**~~ Resolved: [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
   removes `gemini-3-flash-preview` from the DEC-0010 allowlist and promotes
   `deepseek-v4-flash:cloud` (already `accepted_for_poc`) in its place. See
   `docs/RISK_REGISTER.md` R-024.

4. ~~**Production Confidential-Data Provider Approval**~~ Withdrawn:
   [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
   (accepted 2026-07-25) records production/hosted confidential processing as
   explicitly out of scope. `ADR-0006` §1's local-only deployment contract
   leaves such an approval no subject to govern, and its vendor-terms checklist
   is unanswerable without a chosen deployment shape. Reactivation requires a
   hosted deployment to be actually intended **and** a new managed-persistence
   / authentication ADR to be accepted first.

5. ~~**Milestone 6 (re-planned)**~~ Complete: [`docs/milestones/M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md)
   (complete 2026-07-25). All five ACs met; R-017 moved to `Mitigated`; R-018
   stays `Open` with the scanner's language-coverage gap honestly recorded
   rather than closed. See the packet's "Slice Outcomes" and
   [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md).

6. ~~**Milestone 7**~~ Complete: [`docs/milestones/M007-secondary-source-ingestion.md`](docs/milestones/M007-secondary-source-ingestion.md)
   (complete 2026-07-25). Product-scoping decision
   [`DEC-0015`](docs/decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
   accepted the same day. AC-M007-01/02/03/05/06 fully met; AC-M007-04
   (R-013 snippet exclusion) only structurally prepared, not exercised,
   since Class C was deferred in full. R-010 moved to `Mitigated`; R-013
   stayed `Open` pending M008. See the packet's "Slice Outcomes".

7. ~~**Milestone 8**~~ Complete: [`docs/milestones/M008-web-search-discovery.md`](docs/milestones/M008-web-search-discovery.md)
   (accepted and complete 2026-07-26). All five acceptance criteria met; all
   five implementation slices (plus Slice 0's groundwork) shipped and
   tested. R-013 moved to `Mitigated` — mechanism proven structurally and by
   test, real-world coverage still zero pending allowlist population,
   recorded honestly as residual risk. See the packet's "Slice Outcomes".

8. ~~**Milestone 9**~~ Complete: [`docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`](docs/milestones/M009-secondary-evidence-boilerplate-filtering.md)
   (accepted and complete 2026-07-26). All four acceptance criteria met; all
   four implementation slices shipped and tested. Reviewed independently
   twice before implementation (a second AI collaborator and a separate
   reconciliation pass), both converging on the qualifying-token mechanism
   as the fix for the CSR/coral-reef failure class. R-025 moved to
   `Mitigated` — three layered mechanisms proven by test and unregressed
   M001 evals; company-name-token exclusion and cross-page detection
   recorded honestly as residual risk. See the packet's "Slice Outcomes".

9. ~~**Milestone 10**~~ Complete: [`docs/milestones/M010-structural-evidence-precision.md`](docs/milestones/M010-structural-evidence-precision.md)
   (accepted and complete 2026-07-27). All four acceptance criteria met. R-026
   → `Mitigated`; **R-025 deliberately returned to `Open`** — its own trigger
   fired on 2026-07-27, so M009's mitigation is recorded as necessary but
   insufficient rather than quietly amended. M009 §8's pre-authorized question
   ("adopt a readability library if the hand-rolled denylist proves too
   narrow") was raised at review as instructed and declined by user decision:
   jsdom is a heavy dependency for a module holding only `cheerio` and
   `pdfjs-dist`, and the structural fix had not yet been shown insufficient.
   See the packet's "Slice Outcomes".

No milestone is currently active. Milestone 10 is complete.

**Open, not this milestone's problem:** semantic relevance of secondary
evidence (R-025, `Open`) — M010 fixes evidence *shape*, and the live run that
proved it also persisted two quotes from a genuine culture-festival press
release matched partly on division names. Real article prose, not site chrome,
but still not obviously material to a data-centre thesis.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260708-001` (2026-07-05, separate session);
`LC-20260725-001` through `LC-20260725-003` (2026-07-25, earlier this
session — not yet reviewed)
