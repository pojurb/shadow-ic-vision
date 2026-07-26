# Session Checkpoint - 2026-07-26 (M009 implemented + learning-promotions reviewed)

Continues directly from the "M008 first live run + M009 drafted" entry
below — same day, later in the session. That entry's "Exact Resume Point"
said M009 was drafted but not accepted; this entry records that it was
reviewed, accepted, implemented, and governance-closed in this session.

## M009 Reviewed, Accepted, and Implemented (2026-07-26)

Before implementation, the M009 packet got two independent code-level
reviews, not one: mine (read the packet, R-025 register row, ROADMAP, and
`candidate.ts`/`document.ts`/`pipeline.ts` directly) and a second AI
collaborator's (Gemini, same workspace, prompted separately by the user and
relayed back). Both independently confirmed the root cause from the code
itself, and both converged on the same sharpening of the packet's Slice 3
design: of the three real TLKM boilerplate examples, the CSR/coral-reef
press release isn't boilerplate at all — it's genuine, on-domain,
topically-irrelevant content that only clears the pre-fix threshold via
ticker+year tokens, so no DOM stripping or phrase denylist could ever catch
it; only a threshold fix could. That became Slice 3's actual mechanism.

Planned via the plan-mode workflow (2 Explore agents for eval/test
infrastructure and governance-doc conventions, 1 Plan agent for the
implementation design, then a user-confirmed decision on scope: ticker +
bare-year exclusion only, company-name exclusion explicitly deferred since
no such field exists in the call chain, recorded as residual risk rather
than silently widened). Plan approved 2026-07-26.

Implemented all four slices in `lib/research/extractors/document.ts` and
`lib/research/extractors/candidate.ts`:

- **Slice 1 (DOM stripping):** `extractHtml`'s removal selector now
  includes `nav, header, footer, aside` plus common cookie/consent-vendor
  class/id patterns (case-insensitive `[class*="cookie" i]`-style
  attribute selectors — confirmed working against the installed
  `cheerio@1.2.0` with a direct `node -e` check before relying on it, not
  assumed). Added a new official-tier HTML-chrome regression fixture
  (nav/header/footer/cookie-banner wrapping dense filing text) since none
  existed for either tier before this session — a real coverage gap found
  during review, not hypothetical.
- **Slice 2 (phrase denylist):** new `BOILERPLATE_PHRASES` const in
  `candidate.ts` (English + Indonesian: "cookie policy", "all rights
  reserved", "kebijakan privasi", etc.), checked before scoring in
  `rankSentenceCandidates` — an outright exclusion, not a score penalty.
- **Slice 3 (secondary-tier threshold re-tune):** `rankSentenceCandidates`
  now takes a `sourceTier: 'official' | 'secondary'` parameter (literal at
  each of its two call sites, never computed at runtime); for
  `'secondary'` only, a candidate needs at least one qualifying token
  match beyond the ticker itself or a bare four-digit year. The official
  path's output is byte-for-byte unchanged (proven, not just argued) since
  `extractDeterministicCandidates` always passes `'official'`.
- **Slice 4 (governance close-out):** `docs/RISK_REGISTER.md` (R-025 →
  `Mitigated`, with explicit residual-risk language — company-name tokens
  not excluded, denylist only covers listed phrasing, cross-page detection
  not built since the pipeline fetches one document per adapter call),
  `ACTIVE_MILESTONE.md`, `docs/milestones/ROADMAP.md`,
  `docs/CODEBASE_MAP.md`, and the M009 packet's own new "Slice Outcomes"
  section.

Verified: `typecheck`/`lint` clean; full suite 206 passed / 3 skipped (up
from a confirmed 199 baseline — checked by temporarily stashing the M009
code changes and re-running, not assumed from a stale prior count); 7 new
adversarial tests in `tests/document-extraction.test.ts` reproduce all
three real TLKM failures plus two explicit non-regression cases; `build`
clean; `context:generate`/`context:check` and `status:check` pass;
`eval:m001:multimodal` and `eval:m001:provider` (deterministic) both show
unchanged case count (23) and 0 hard-gate failures, proving official-filing
recall unregressed. `test:e2e` (Playwright) initially skipped in this
session (blocked by the pre-existing Turbopack dev-server crash on port
3000, PID 19920) — later resolved with the user's explicit go-ahead: killed
PID 19920, let Playwright's own `webServer` config start a fresh dev server,
4/4 pass, confirming no UI regression (M009 touches no UI code).

Also applied, same go-ahead: `ISSUER_SOURCE_URLS` in `.env` now includes
TLKM (`https://www.telkom.co.id/sites/about-telkom/en_US/page/investor-relations-3054`,
a real investor-relations page verified reachable via WebFetch before
adding, same shape as the existing BBRI entry, not a placeholder guess) —
closes the M008-live-run finding that the official IDX path was degraded
for TLKM only because this allowlist wasn't populated.

Still nothing is committed. All M009 code, test, governance-doc, and `.env`
changes are unstaged working-tree changes as of this entry.

## Learning-Promotions Pipeline Reviewed (2026-07-26)

While this session's M009 work was in progress, the Gemini/Antigravity
collaborator concurrently promoted three pre-existing learning candidates
(`LC-20260725-001/002/003`, M006-derived) and captured + promoted a new one
(`LC-20260726-001`, documenting almost exactly the same M009 root cause
independently) into `.agents/QUALITY.md`/`.agents/SECURITY.md`. These
showed up as unexpected working-tree diffs mid-session; confirmed they
don't conflict with any M009 file before continuing.

At the user's request, reviewed this promotion batch independently against
`.agents/LEARNING.md`'s schema and process rules, `docs/learning/
CANDIDATE_TEMPLATE.md`, and by directly re-verifying each candidate's
technical claims against the actual code (not just trusting the candidate
text). Findings, reported to the user, not yet acted on:

- **Confirmed schema defect:** `LC-20260725-002`'s `Task type: security` was
  not a valid enum value per the template. Resolved — by the time the fix
  was attempted, the Gemini/Antigravity collaborator had already corrected
  it independently (now `planning`) and had also added the previously
  missing "Related review finding or incident" line to all four candidates,
  without being asked — both findings self-resolved by the other
  collaborator mid-session.
- **Structural gap, not a confirmed violation:** the candidate template has
  no author/"captured by" field, only a `Reviewer` field — so
  `LEARNING.md`'s "an independent reviewer did not author the candidate"
  requirement is unverifiable from the artifacts alone. All four candidates
  here list the same reviewer (Antigravity/Gemini) who plausibly also
  authored them, given they surfaced during that same agent's own
  concurrent work. Flagged for the user to confirm, not asserted as a
  violation.
- No privacy/secret violations found. One judgment call flagged, not a
  violation: `LC-20260726-001` names the real ticker `TLKM` and a
  conversation ID — defensible given the content is a bug-triage pointer,
  not thesis reasoning, but worth the user's explicit sign-off given this
  project's precedent (DEC-0011) of classifying decision data more
  conservatively than instinct suggests.
- No authority-hierarchy violations: nothing touches `AGENTS.md`, DB
  contracts, runtime prompts, or model routing; all four promoted-text
  targets were independently confirmed to actually contain the claimed text
  verbatim, not just claimed in the registry.
- Overall verdict given to the user: approved, conditional on the one
  schema fix and the one open reviewer-independence question above. The
  schema fix resolved itself (see above); the reviewer-independence
  question is still genuinely open and unverifiable from the artifacts —
  not something either agent can resolve unilaterally.

### Exact Resume Point (updated — all four items below resolved same session)

1. **TLKM added to `ISSUER_SOURCE_URLS`** in `.env` (real, WebFetch-verified
   investor-relations URL) — closes the M008-live-run config gap.
2. **`LC-20260725-002`'s `Task type` field** — already fixed by the other
   collaborator before this session acted on it.
3. **Dev server on port 3000 restarted** (killed stale PID 19920, let
   Playwright's `webServer` config start a fresh one) and **`test:e2e` now
   run**: 4/4 pass, confirming no UI regression from M009.
4. **Commit decision:** M009 (code + tests + governance docs) and the
   concurrent Gemini/Antigravity learning-promotion changes were kept as
   two separate commits — different authorial units of work, easier to
   revert/amend independently if the still-open reviewer-independence
   question above needs later action.

Still open, not this session's problem to solve: the reviewer-independence
question from the learning-promotions review (item above) — needs the
user's own confirmation, not a code fix.

---

# Session Checkpoint - 2026-07-26 (M008 first live run + M009 drafted)

**Note:** M008 (web search discovery) shipped and was marked `complete` in
`ACTIVE_MILESTONE.md` on 2026-07-26, but no session-checkpoint entry was
written for it at the time — this entry starts from that gap; M008's own
packet (`docs/milestones/M008-web-search-discovery.md`) remains the
authoritative record of what M008 itself shipped.

## M008 First Live End-to-End Run (2026-07-26)

Ran the full M008 pipeline live for the first time (previously only tested
via mocks/fixtures): confirmed a real TLKM thesis draft in conversation
`f5f230f6-23ea-4e86-a73a-cb55b04630c3` (`thesis.id =
2e10b4c2-c642-4f0b-9d35-7498292931f8`) through a headless-browser session
against the running dev server, then inspected the live SQLite DB and
`logs/outbound.log` directly rather than trusting the UI alone.

- **Discovery → domain gate → promotion worked correctly, live, for the
  first time.** Tavily returned 10 candidates; 8 correctly `rejected:
  domain_not_allowlisted` (notably including `idx.id`'s own static-data PDF
  URL and `telkomsel.com` — a TLKM subsidiary on a *different* domain — both
  plausible-looking but correctly refused); 2 matched `telkom.co.id`,
  fetched, and were promoted into `secondary_issuer` evidence. R-013's
  residual-risk note updated with this real outcome (was previously an
  estimate; the allowlist-population gap it was tracking is now closed).
- **Official IDX path degraded** (`issuer_source_unavailable`) — traced to
  `ISSUER_SOURCE_URLS` (a *different* env var from the M007/M008 secondary
  allowlists) only having `BBRI`, not TLKM. `logs/outbound.log` confirms the
  real IDX announcement API was actually called (200) but didn't yield a
  document to use before falling back. Not an M008 bug — a pre-existing,
  separate config gap. Quick fix identified, not yet applied: add TLKM to
  `ISSUER_SOURCE_URLS` in `.env`.
- **New finding — R-025 (evidence precision, not yield).** Several of the 15
  persisted `secondary_issuer` evidence rows are semantically irrelevant
  boilerplate: one assumption about competitive pricing was backed by the
  issuer's cookie/privacy-policy text; one about macro conditions was backed
  by an unrelated CSR coral-reef-restoration press release; the same
  nav-menu paragraph was persisted verbatim as "evidence" for three
  different assumptions. Root cause verified directly against the code (not
  assumed): `rankSentenceCandidates` (`lib/research/extractors/candidate.ts`)
  was tuned for dense, boilerplate-free official filings (M001–M006) and
  reused unchanged when M007/M008 opened raw web HTML into the same path;
  `extractHtml` (`lib/research/extractors/document.ts`) strips
  `script/style/noscript/template/svg` but not `nav/header/footer/aside`. A
  second AI collaborator (Gemini, same workspace) independently reached the
  same root cause from the same two files and confirmed the prioritization —
  used as a genuine second opinion, not a formality. R-010's structural
  trust-tier gate still holds (nothing mislabeled `exact_verified`/
  `ocr_matched`); this is a precision gap within the correctly-tiered
  `secondary_issuer` class.
- **Unrelated infra finding:** a second page load crashed Next's Turbopack
  compiler-worker pool (`"Jest worker encountered 2 child process
  exceptions, exceeding retry limit"` — Next's internal build-worker
  library, unrelated to the Jest test framework despite the name). `/c/[id]`
  routes 500'd afterward; `/` and `/portfolio` kept serving fine. The dev
  server (port 3000) was already running before this session touched it and
  was **not restarted** — flagged, not fixed, to avoid disrupting anything
  left open in that terminal. Likely just needs a restart next session.

## M009 Drafted (proposed, not yet accepted) — Secondary Evidence Boilerplate Filtering

Governance-only so far — no code changed. Per this session's "full
governance path" choice: risk entry first, then a full milestone packet,
before any implementation.

- `docs/RISK_REGISTER.md`: new **R-025** row (`Open`, Data Trust, High/High)
  with the verified root cause and the three real TLKM examples as evidence.
  Pending review trigger from the prior session (first live
  `processResearchJobs` run against the newly-populated allowlists) closed
  out with the real outcome.
- `docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`
  (`proposed`): full packet — DOM-level boilerplate stripping in
  `extractHtml`, a phrase-level boilerplate denylist in
  `rankSentenceCandidates`, and a secondary-path-specific threshold
  re-tune, deliberately **not** a global threshold change (would risk
  regressing official-filing recall M001–M006 already validated). 4
  implementation slices scoped, not started. No new decision record needed
  — governed under the already-accepted DEC-0015.
- `docs/milestones/ROADMAP.md`: M009 entry added, sequenced after M008.
- `npm run status:check` and `npm run context:check` both pass after these
  doc changes.

### Exact Resume Point

**M009 is drafted but not yet accepted by the user.** Nothing implemented.
Before writing code: get explicit acceptance of the M009 packet (or
requested changes to it). Once accepted, implement in the 4 scoped slices
(DOM stripping → phrase denylist → secondary-threshold re-tune → governance
close-out/eval re-run), per
`docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`.

Two small, independent, not-yet-applied fixes noted above but out of M009's
scope, safe to do anytime: add TLKM to `ISSUER_SOURCE_URLS` in `.env`;
restart the dev server on port 3000 (Turbopack worker crash).

---

# Session Checkpoint - 2026-07-25

## M007 Slice 1 — Schema (done 2026-07-25)

Milestone: [`docs/milestones/M007-secondary-source-ingestion.md`](docs/milestones/M007-secondary-source-ingestion.md)
(`accepted`), governed by [`DEC-0015`](docs/decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
(`accepted`). Packet co-drafted with a second AI collaborator (Gemini,
working in the same VS Code workspace) — I corrected three issues in their
draft before treating it as final: a premature "R-010/R-013 already
Mitigated" claim (fixed to "currently Open, aims to mitigate," matching this
repo's evidence-first convention), and two missing template sections
("Workflows, States, and Recovery Behavior", "Assumptions, Risks, and
Explicit Deferrals" — the section that's supposed to catch exactly the
premature-Mitigated problem).

Verified 131 passed / 3 skipped (up from 130), typecheck/lint clean.

- `db/schema.ts`: `assumptions.status` widened with `'pending_confirmation'`
  and `'user_confirmed_secondary'` (Drizzle `{enum:}` — TS-only narrowing,
  confirmed no `CHECK` constraint exists anywhere in `db/migrations/*.sql`,
  so this needed no migration). `evidence.verificationStatus`'s comment
  widened (it was already a bare, unconstrained `text()` column — also no
  migration). New `discoveryCandidates` table (`discovery_candidates`):
  pre-fetch candidate URLs for the *deferred* Class C (web-search discovery)
  path — deliberately not populated by anything in M007, and deliberately a
  different table from the pre-existing `sourceDiscoveries` (which requires
  an already-fetched, hashed document and can't represent a pre-fetch,
  possibly-never-resolved candidate). No snippet/title column exists on it
  by design — a type-level guarantee search text can never be persisted.
- Migration `db/migrations/0007_add_discovery_candidates.sql` generated via
  `npx drizzle-kit generate --name=add_discovery_candidates` (not hand-authored
  — this repo's migrations are tracked via `db/migrations/meta/_journal.json`
  + a matching snapshot, which the CLI produces correctly; confirmed the
  generated diff touched *only* the new table, nothing else, validating the
  no-DDL-for-enum-widening finding).
- `lib/domain/contracts.ts`: `assumptionStatusSchema` and both
  `verificationStatus` zod sites (`EvidenceDTO`, `thesisExportSchema`)
  widened to match.
- `tests/migrations.test.ts`: new case proving the widened enum values
  round-trip, the `assumptions` table's `CREATE TABLE` SQL contains no
  `CHECK` (the schema-level claim this design rests on), and
  `discoveryCandidates`'s unique index + null-by-default
  `resultingDocumentHash` behave as specified.

## M007 Slice 2 — Extractor/Candidate Layer (done 2026-07-25)

Verified 135 passed / 3 skipped (up from 131), typecheck/lint clean.

- `lib/research/extractors/candidate.ts`: widened `EvidenceVerificationStatus`;
  added two `EvidenceCandidate` branches (`secondary_issuer`, `secondary_news`);
  added `createSecondaryIssuerCandidate`/`createSecondaryNewsCandidate`
  factories; refactored the shared sentence-ranking logic out of
  `extractDeterministicCandidates` into a new `rankSentenceCandidates` helper
  so both it and the new `extractSecondaryCandidates` use identical scoring.
  `extractSecondaryCandidates` is a dedicated sibling function (not a branch
  inside `extractDeterministicCandidates`) — its only return paths call the
  two new factories, so it has no code path capable of constructing
  `exact_verified`/`ocr_matched`, regardless of the input document's
  `sourceVariant`. This is the R-010 structural gate.
- **Deliberate simplification from the packet's literal wording**: the
  packet said secondary metadata "carries `{ publisherName }` /
  `{ publisherName, wireService }`." Skipped as redundant —
  `VerifiedEvidence.sourceName` (set from `SourceSnapshot.sourceName` at the
  pipeline level, unchanged) already carries publisher/wire-service identity
  for every evidence class; duplicating it into candidate metadata would
  just be two names for the same fact. Both new branches keep `metadata`
  optional/freeform, matching `exact_verified`/`ocr_matched`'s precedent
  rather than `derived`'s required shape.
- **Extractor field choice**: both factories hardcode
  `extractionMethod: 'html_parser'` and `sourceVariant: 'text_layer'` —
  reused rather than widened, since Class A/B documents are genuinely
  HTML-parsed pages; no new `EvidenceExtractionMethod` value was needed.
- **Ripple, expected and handled in-slice**: widening `EvidenceCandidate`
  broke `lib/research/pipeline.ts`'s `VerifiedEvidence.verificationStatus`
  (was hardcoded to the old 3-value union). Widened it to
  `EvidenceVerificationStatus` — a type-only change. The pipeline's actual
  behavioral bug (the branch that would reject every secondary candidate at
  runtime) is **not** fixed yet — that's Slice 4, on schedule, and confirmed
  still present by design at this point.
- Tests (`tests/document-extraction.test.ts`, 28 → 32): both secondary
  classes extract correctly; an adversarial case feeds a `scanned` document
  into `extractSecondaryCandidates` and confirms it still only ever produces
  `secondary_issuer`/`secondary_news`; factories proven to hardcode their own
  status.

## M007 Slice 3 — Adapters, Class A + B (done 2026-07-25)

Verified 142 passed / 3 skipped (up from 135), typecheck/lint clean,
`npm run build` clean.

- New `lib/research/adapters/issuer-press.ts` (`IssuerPressReleaseAdapter`,
  `discoverIssuerPressReleases`): sibling to `IssuerAdapter`, always sets
  `sourceTier: 'secondary'`, uses its own `PRESS_RELEASE_TERMS` list, and
  deliberately drops `IssuerAdapter`'s `.pdf`-only filter (press releases are
  typically HTML).
- New `lib/research/adapters/news-wire.ts` (`NewsWireAdapter`,
  `parseNewsFeedItems`): first feed-based (not page-crawl) adapter in this
  codebase — no existing precedent to mirror. Parses RSS `<item>`, Atom
  `<entry>`, or a JSON `items` array; no new dependency (`cheerio`'s
  `xmlMode: true`, already installed). Filters items by ticker
  (word-boundary regex against title+description) after fetching, since one
  feed typically covers many tickers. A single unreachable/broken feed never
  blocks matches from the other configured feeds (proven by test).
- **Real bug my own test caught before it shipped**: `PRESS_RELEASE_TERMS`
  initially only had hyphenated/underscored forms (`press-release`), which
  matched URL paths but not rendered link text ("press release" with a
  space). The discovery test failed against a realistic link-text fixture,
  which is how this was found — fixed by adding space-separated forms
  alongside the URL-path forms.
- New `lib/research/adapters/mock-issuer-press.ts`/`mock-news-wire.ts` for
  `RESEARCH_SOURCE_MODE=mock`, mirroring `mock-sec.ts`'s shape.
- `lib/research/adapters/factory.ts`: new sibling `createSecondarySourceAdapters()`
  returning `Record<ResearchMarket, { issuerPr?; newsWire? }>` — deliberately
  not a change to `createSourceAdapters()`'s existing return shape (other
  code/tests depend on it). Both fields optional per market/ticker; a
  missing config is `undefined`, never an error.
- `lib/research/config.ts`: `getIssuerPressReleaseUrls()`/`getNewsWireFeedUrls()`,
  mirroring `getIssuerSourceUrls()`. New env vars `ISSUER_PRESS_RELEASE_URLS`
  (ticker → URL, like the existing issuer map) and `NEWS_WIRE_FEED_URLS`
  (publisher name → feed URL — not ticker-keyed, since one feed covers many
  tickers).
- `lib/research/adapters/types.ts`: new `SourceErrorCode` value
  `'news_wire_source_unavailable'`; `IssuerPressReleaseAdapter` reuses the
  existing `'issuer_source_unavailable'` (same conceptual role as
  `IssuerAdapter`'s).
- **Two known, deliberately unsolved limitations, documented in-code** (not
  silently absorbed): (1) article links must resolve to the same origin as
  their feed URL — a feed whose articles live on a different domain will
  fail closed (`source_access_denied`) rather than silently trust an
  unconfigured domain; (2) ticker-symbol matching only, not also legal-name
  matching as DEC-0015 §4 describes — would need either a new field on the
  shared `SourceQuery` type (used by every adapter) or a separate
  ticker→legal-name map, a larger cross-cutting change deferred as a
  follow-up.
- Tests (`tests/source-adapters.test.ts`, 9 → 16): press-release discovery
  (HTML, no `.pdf` requirement, always `secondary`); RSS/Atom/JSON feed
  parsing; ticker filtering; multi-feed soft-failure isolation; clean
  `unavailable` (never a throw) when no feed matches.

## M007 Slice 4 — Pipeline/Service Integration + Bug Fix (done 2026-07-25)

Verified 146 passed / 3 skipped (up from 142), typecheck/lint/build clean.

- **Plan deviation, reasoned not silent**: skipped adding the planned optional
  `documentTypes` parameter to `executeResearchJob` — verified neither new
  Slice 3 adapter reads `query.documentTypes` at all, so the parameter would
  have been dead API surface. Only `evidenceClass: 'official' | 'secondary_issuer' | 'secondary_news' = 'official'`
  was added.
- `lib/research/pipeline.ts`: **fixed the confirmed pre-existing bug** — the
  verification branch's final `else if (!candidate.metadata?.method...)` was
  unconditional (meant for `'derived'` only) and would throw for any
  non-official class; narrowed to `else if (verificationStatus === 'derived')`,
  with a new `else` branch for `secondary_issuer`/`secondary_news` that
  verifies the quote appears in `extracted.canonicalText` (proves it wasn't
  hallucinated) but never sets `canonicalTextHash` or promotes the status —
  that stays reserved for `exact_verified` alone. `executeResearchJob` now
  routes to `extractSecondaryCandidates` when `evidenceClass !== 'official'`.
  Proven end-to-end by a new pipeline-level test in
  `tests/document-extraction.test.ts` (32 → 34) — would have produced zero
  evidence if the fix regressed.
- `lib/research/service.ts`: `processResearchJobs` now calls two additional
  secondary passes per claimed job (Class A via `secondaryAdapters[market].issuerPr`,
  Class B via `.newsWire`, both from the new `createSecondarySourceAdapters()`
  default dependency), each through new helper `runSecondaryResearchCall`.
  **Real placement bug caught before it shipped**: my first draft placed the
  secondary calls *after* the official `try/catch` block — but that block has
  early `continue` statements (`unchanged`, empty evidence) that would have
  skipped the secondary calls entirely on those paths. Moved them *before*
  the official try/catch so they always run, independent of the official
  outcome (a press release can be new even when the official filing hasn't
  changed). `runSecondaryResearchCall` never touches `research_jobs.status`/
  `error`/`errorCode` — confirmed by a dedicated test that a throwing
  secondary adapter leaves the job `succeeded` with `error: null`.
  Extracted shared `evidenceInsertValues()` used by both the official
  transaction and the secondary helper (removes ~15 lines of duplicated
  field-mapping).
  Also widened two more `verificationStatus` cast sites in `service.ts`
  (`getResearchPanel`, `exportThesisData`) found by grep, not caught by
  typecheck alone since they were type assertions (`as`), not inferred types.
- **Test-driven discovery, not a bug but worth recording**: the *existing*
  test suite's snapshot/evidence counts were unaffected by adding live
  secondary calls, because the default mock secondary adapters
  (`createSecondarySourceAdapters()` in mock mode) use generic fixture text
  that shares too little vocabulary with those tests' assumptions to clear
  `rankSentenceCandidates`'s `tokenMatches >= 2` threshold — confirmed by
  tracing the token-matching logic, then proving it two ways: a new test
  supplies a vocabulary-matching secondary adapter and confirms real
  persistence (`secondary_issuer` row, correct `sourceTier`, official
  evidence unaffected); a second new test confirms the soft-failure
  guarantee. `tests/research-service.test.ts`: 12 → 14.

## M007 Slice 5 — Assumption Confirmation Gate (done 2026-07-25)

Verified 156 passed / 3 skipped (up from 146), typecheck/lint/build clean
(confirmed the new route `/api/assumptions/[id]/accept-secondary-evidence`
registered in the build output).

- New `lib/research/assumption-status.ts`: `deriveAssumptionStatus`, a pure
  decision function (current status + which verification statuses were just
  inserted + whether official evidence already exists → next status or
  `null`). Deliberately pure/testable in isolation from any DB access —
  callers query state and apply the result themselves.
- `lib/research/service.ts`: new `hasOfficialEvidence`/`applyAssumptionStatusGate`
  helpers, wired into **both** evidence-insert transactions — the official
  one in `processResearchJobs` (handles clearing path 1: official evidence
  arriving reverts `pending_confirmation` → `untested`) and
  `runSecondaryResearchCall`'s (handles the forward path: secondary-only
  evidence moves an untouched `untested` assumption to `pending_confirmation`).
  `runSecondaryResearchCall` gained a `now: () => Date` parameter to reach
  the same injectable clock the rest of the module uses.
- New `acceptSecondaryEvidence(assumptionId)` (clearing path 2): a
  conditional update requiring current status `pending_confirmation`,
  transitioning to `user_confirmed_secondary` — deliberately not `verified`,
  so an accepted secondary-only assumption never looks officially verified.
  Throws if the assumption isn't actually pending confirmation, matching
  `retryResearchJob`'s existing conditional-update-then-throw pattern.
- New route `app/api/assumptions/[id]/accept-secondary-evidence/route.ts`
  (POST), matching the exact `{error: message}` / status-code convention
  already used by `app/api/research/retry/route.ts` — no new response shape
  invented.
- Tests: new `tests/assumption-status.test.ts` (6 cases) unit-tests the pure
  function directly (including "never promotes to verified — that is not
  this function's job"). `tests/research-service.test.ts` (14 → 18) proves
  the gate end-to-end through real `processResearchJobs` calls: an
  assumption seeded via the built-in "simulate citation mismatch" fixture
  (guarantees zero official evidence) plus a vocabulary-matching secondary
  adapter reaches `pending_confirmation`; a pre-seeded `pending_confirmation`
  assumption reverts to `untested` once official evidence arrives; and
  `acceptSecondaryEvidence`'s success and rejection paths.

## M007 Slice 6 — UI (done 2026-07-25)

Verified 156 passed / 3 skipped, typecheck/lint/build clean, **and** the
Playwright e2e suite (3/3) after fixing a real regression it caught.

- `components/ResearchPanel.tsx`: `evidenceBadge`/`evidenceWarning` widened
  for `secondary_issuer`/`secondary_news`. New `assumptionStatusBadge` —
  every assumption status now renders as a proper badge (`.status_*` class),
  not plain text as before; a conditional "Accept secondary evidence" button
  appears for `pending_confirmation` assumptions, posting to Slice 5's route
  and reloading on success.
- `components/Workspace.module.css`: `.verified_secondary_issuer` (violet)/
  `.verified_secondary_news` (cyan) — deliberately NOT amber, since
  `.verified_ocr_matched` already occupies that family (DEC-0015's literal
  "amber for secondary" wording would have collided with existing OCR/
  degraded badges). New `.status_*` classes for every assumption status
  (previously only job statuses had badge CSS).
- `db/queries.ts`: `getUnreadAlerts()` projects `sourceTier`; `components/Sidebar.tsx`/
  `ChatUI.module.css` badge it (violet `.alertSecondaryBadge`) alongside the
  existing format badge when an alert originates from a secondary source.
- **Real regression caught by the Playwright suite, not vitest**: turning
  the assumption-status line from raw enum text ("untested") into a badge
  ("Untested") broke two existing e2e assertions
  (`tests/e2e/vertical-slice.spec.ts`) that expected the literal old text
  verbatim. Fixed by updating both assertions to the new capitalized badge
  text — the UI change was correct and intended; the test just needed to
  follow it. This is exactly why the project convention requires running
  the Playwright suite, not just vitest, before calling a UI-touching slice
  done.
- Existing `tests/portfolio.test.ts` alert test extended with a `sourceTier: 'official'`
  assertion on the new projection field.

## M007 Slice 7 — Evals (done 2026-07-25)

Verified 156 passed / 3 skipped, typecheck/lint/build clean, plus the
multimodal and provider evals both re-run directly: 0 hard-gate failures,
`additionalCaseCount: 23` (up from 20) confirmed in both report shapes.

- `docs/evals/M001/multimodal-cases.json`: three new cases. `MM-021`
  (secondary_issuer) / `MM-022` (secondary_news) prove correct labeling.
  `MM-023` is the adversarial case: it deliberately reuses `MM-001`'s exact
  source text (the one that mints `exact_verified` through the *official*
  path) to prove the *secondary* path cannot produce `exact_verified`/
  `ocr_matched` for the identical text — the invariant lives in which
  function was called, not in the text's content. `metadata.case_count`
  updated 18 → 23 (was already stale after M006 added two cases without
  updating it; not fixing further pre-existing looseness in that field
  beyond accuracy).
- `scripts/eval-m001-multimodal.ts`: widened `MultimodalCase.expected.verification_status`
  and added `input.assumption`/`input.ticker`/`input.source_class`.
  **Structural fix, not just new cases**: before this slice, `evaluateCase`
  hardcoded `status: 'passed'` unconditionally — nothing in the entire
  multimodal suite could actually fail; `hardGateFailures` was fed only by
  provider-boundary mismatches. Restructured `deterministicNotes`/`evaluateCase`
  to return `{ notes, hardGateFailures }`, aggregated into the top-level
  report. `MM-021`/`MM-022`/`MM-023` are the first cases in this suite that
  call a real extractor (`extractSecondaryCandidates`) and can genuinely
  report `'unsupported'` with a hard-gate failure if the R-010 structural
  gate regresses — closing the exact gap flagged in the M007 plan ("a real
  assertion is needed so a regression can't pass silently").
- `tests/multimodal-eval.test.ts`: case count assertion 20 → 23; explicit
  per-case assertions for the three new cases, matching the file's existing
  style for MM-002/005/012.
- Confirmed `scripts/eval-m001-provider.ts` (reads the same JSON, no code
  change needed) correctly reflects `additionalCaseCount: 23` with 0
  hard-gate failures.

### M007 Slice 8 — Governance Docs (done 2026-07-25)

`docs/RISK_REGISTER.md`: R-010 → `Mitigated` (structural enum isolation,
confirmation gate, distinct badging — all implemented and tested) with
honest residual-risk language (a user can still misread a correctly-badged
secondary source as authoritative); R-013 stays `Open` — Class C (the
actual search-snippet handling code) was deferred entirely, so the risk it
names cannot be mitigated by a milestone that shipped none of the code that
would create it. `docs/CODEBASE_MAP.md`: research job state-machine note
gained `pending_confirmation`/`user_confirmed_secondary` and the
multi-snapshot-per-job reality; new "Secondary-Source Ingestion" flow
paragraph; R-010 structural gate added alongside R-017.
`ACTIVE_MILESTONE.md` flipped to `complete`, all AC-M007-* listed as met
(01/02/03/05/06 fully; 04 structurally prepared, not exercised).
`docs/milestones/ROADMAP.md`: M007 status → `complete`. Final full
verification pass run and green: `typecheck`, `lint`, `test` (156 passed, 3
skipped), `build`, `test:e2e` (3/3), `status:check`, `context:check`.

### Exact Resume Point

**M007 is fully complete** (all 8 slices, verified, committed as `580b515`,
pushed to `origin/main` — confirmed `HEAD == origin/main`, working tree
clean as of end of session 2026-07-25). Nothing outstanding to resume within
M007.

**Next session starts fresh on Milestone 8** — Web Search Discovery (Class
C), per `docs/milestones/ROADMAP.md`. Not yet scoped as a packet. Needs a
search-provider integration decision and a mandatory fetch-and-classify
promotion workflow design before a packet can be drafted (raw search
snippets can never be treated as evidence directly — that's what R-013,
still `Open`, is tracking). The `discoveryCandidates` table
(`db/schema.ts`, migration `0007`) is already schema-ready and unpopulated,
waiting for this milestone.

## This Session (2026-07-25): M006 Re-Plan & Acceptance

Governance-only session so far; no application code changed yet.

- **Revisited the held M006 decision.** Scoping "Production Confidential-Data
  Provider Approval" surfaced a blocking dependency the roadmap did not
  account for: [`ADR-0006`](docs/decisions/ADR-0006-m001-stack.md) §1 binds the
  app to a local-only deployment contract and requires a *new ADR* covering
  managed persistence and authentication before any hosted deployment. There
  is therefore no production deployment for such an approval to govern, and
  its checklist (retention, region, subprocessors) is not answerable without a
  chosen deployment shape.
- **`DEC-0014` drafted and user-accepted** — reaffirms local-only scope,
  withdraws the production-provider-approval subject, and records production
  confidential processing as *explicitly rejected from scope* (using the risk
  register's own "mitigated **or explicitly rejected from scope**" Review
  Rule). M001 is now `local-only complete`. Deliberately does **not** close
  R-003 (its POC leg is still live) and closes no other risk. Defines a
  Reactivation Path rather than being a dead end. Signpost added to `DEC-0009`
  per the amend-via-new-decision convention; original text unchanged.
- **M006 slot re-planned** to
  [`M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md)
  (drafted, user-accepted). Number reuse was a deliberate, user-approved call:
  nothing had ever been *accepted* under "M006" — ROADMAP listed it as "not yet
  scoped as a packet" — so the slot was a plan note, not a governance record.
  The withdrawal is traceable via DEC-0014 and a dedicated ROADMAP section.
- **Two findings drove the new packet's scope:**
  1. `extractVisionOcrCandidate` (`lib/research/extractors/ocr.ts`) is built,
     tested, and eval-backed but called by nothing in `lib/research/`.
     `extractDocument` still throws `unsupported_visual` for every image
     source. Design conclusion recorded in the packet: it is the *wrong*
     function to wire in — it verifies a *known* `candidateQuote`, which the
     open-ended pipeline does not have. The milestone adds a transcribe-first
     path at the `extractDocument` seam instead and leaves that function as
     the eval seam.
  2. `scanEmbeddedInstructions` (`lib/research/extractors/safety.ts`) is
     referenced only by `tests/multimodal-helpers.test.ts` and
     `scripts/eval-m001-multimodal.ts` — the production extraction path does
     no injection scanning at all. R-018's stated mitigation currently exists
     in the evaluator only. The two halves ship together because opening a
     vision path without the scanner would route attacker-controllable image
     text in unchecked.
- **Scoped out:** scanned-PDF rasterization (no `canvas`/`@napi-rs/canvas`/
  `sharp` dependency exists; only `pdfjs-dist` for text), per R-005/R-019.
  Broadening the injection scanner's coverage was also deferred by user
  decision — the wiring is the win; the current regex is one English pattern
  list and the packet says so plainly rather than implying R-018 is closed.
- `docs/RISK_REGISTER.md`: R-003 and R-020 updated with DEC-0014's effects,
  both deliberately left `Open`; review trigger changed from "before production
  provider approval" (withdrawn) to "before M006 closure".
- Baseline re-verified independently at session start: `npm run typecheck`
  clean, `npm test` 113 passed / 3 skipped, working tree clean at `32b78b9`.
  `npm run status:check` and `npm run context:check` pass with the new docs.

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
  cloud processing. Per `DEC-0014`, production/hosted processing is now
  explicitly out of scope rather than pending a future approval.
- `modelEligibility` remains `not_evaluated` for production — DEC-0012 only
  covers POC OCR/vision eligibility.
- R-018's mitigation currently exists in the evaluator only:
  `scanEmbeddedInstructions` is not called from the production extraction
  path. M006 Slice 3 closes this.
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

## M006 Slice 1 — Vision Extraction Path (done 2026-07-25)

Implemented, typecheck/lint/tests green (117 passed, 3 skipped — up from 113).

- `lib/research/extractors/document.ts`: `ExtractedDocument.extractionMethod`
  widened to `'html_parser' | 'pdf_text' | 'vision'` (`'vision'` chosen because
  it is already a member of `EvidenceExtractionMethod`, so the pipeline passes
  it through without a cast) and `sourceVariant` to
  `'text_layer' | 'scanned'`. `extractDocument` gained an optional
  `ExtractDocumentOptions` second argument carrying a `VisionTranscriber`.
  The `sourceFormat === 'image'` branch now delegates to it — and **fails
  closed** to the pre-M006 `unsupported_visual` error when none is configured.
  The `VisionTranscriber` is a callback type, not an import, so `document.ts`
  gains no provider dependency and no import cycle exists.
- `lib/research/extractors/ocr.ts`: added `createVisionTranscriber`. It is
  deliberately a *different shape* from `extractVisionOcrCandidate`: it
  transcribes without being told what to look for, because the research flow
  discovers evidence open-endedly and has no candidate quote up front. Ranking
  is left to `extractDeterministicCandidates`. Empty transcriptions are
  rejected rather than persisted. `extractVisionOcrCandidate` is unchanged and
  remains the eligibility-eval seam.
- `lib/research/pipeline.ts`: `CitationPipeline` takes an optional second
  constructor argument (`visionTranscriber`), absent by default, and forwards
  it to `extractDocument`.

### Slice 2 core landed early (deliberate)

The R-017 guard could not wait for its own slice. `extractDeterministicCandidates`
(`extractors/candidate.ts`) is the **single** site that mints `exact_verified`
from an `ExtractedDocument`, and it does so unconditionally. The moment Slice 1
let a vision document reach it, every transcribed line would have become
`exact_verified` — the exact R-017 failure. The guard now branches on
`document.sourceVariant === 'scanned'` and routes through `createOcrCandidate`
instead. `createOcrCandidate` also gained an optional
`extractionMethod: 'ocr' | 'vision'` (default `'ocr'`) so vision-derived
evidence records its true provenance rather than being mislabelled `'ocr'`.

Tests added to `tests/document-extraction.test.ts` (13 → 17): image source
transcribes to a `scanned`/`vision` document; empty transcription rejected;
**a transcribed source never mints `exact_verified`** (the invariant lock, with
the quote still required to verify against the retained transcription); and a
text-layer source still does.

## M006 Slices 2–5 (done 2026-07-25, except the live eval)

### Slice 3 — Injection scanning in product code

The gap was worse than "the eval cases lacked a probe". `service.ts`'s
`generateDecisionRecommendation` interpolated `e.content` — document-derived,
attacker-controllable text — directly into the provider prompt. A hostile
filing or scanned page could address the model directly.

- **Extraction:** `ExtractedDocument` gained a required
  `untrustedInstructionFlagged` boolean, set by `extractHtml`, `extractPdf`,
  and `createVisionTranscriber`. Making it required (not optional) let the
  compiler enumerate every producer.
- **Persistence:** the flag rides in the existing evidence `metadata` JSON
  column — **no migration needed**, which resolves the Slice 1 carry-over
  question. Set in `pipeline.ts` for *every* evidence class, since any source
  format can carry an embedded instruction.
- **Prompt boundary:** `generateDecisionRecommendation` now runs
  `scanEmbeddedInstructions` over each evidence quote and emits `safeText`,
  plus an explicit warning line when flagged. The system prompt also states
  that quoted evidence is untrusted data, never instructions.
- **Deliberate deviation from the packet.** The packet said `safeText` would be
  used "for downstream processing". Applying it at extraction would have
  truncated `canonicalText` — and the regex matches `buy shares`, a phrase that
  occurs innocently in real filings ("the board authorized a plan to buy
  shares"). That would silently destroy legitimate evidence and break exact
  verification. Truncation is therefore applied **only at the prompt edge**;
  stored evidence stays verbatim. Both behaviours are locked by tests.

### Slice 2 — R-017 end-to-end

Added a `CitationPipeline` test with a stub image adapter proving the full
chain: image source → transcription → `ocr_matched` evidence carrying
`extractionMethod: 'vision'`, `sourceVariant: 'scanned'`, a null
`canonicalTextHash`, and the R-018 flag in metadata. A companion test proves
image sources still fail closed with `unsupported_visual` when no transcriber
is configured.

### Slice 4 — Injection-probe fixtures and eval cases (live run outstanding)

- Two new Playwright-rendered fixtures embed an instruction addressed to the
  model, styled identically to the surrounding filing text:
  `pltr-injection-probe-scan.png` and `bbri-injection-probe-scan.png`.
- Cases `MM-019`/`MM-020` added; multimodal case count 18 → 20.
- **Grading design point:** a *faithful* transcription necessarily contains the
  injected text — reading it is correct, and suppressing it would hide the
  attack from the operator. So the probe grades **compliance**, not presence:
  a marker list of phrases indicating the model spoke in its own voice, with
  any marker that also occurs in the fixture's own visible text discarded
  before grading. The grader also runs the shipped `scanEmbeddedInstructions`
  over the transcription, tying the eval to the real control.
- **`MM-020` expects the scanner to MISS it** (`scanner_must_flag: false`).
  `scanEmbeddedInstructions` is an English-only regex, so the Indonesian probe
  slips past it. Encoding that as an expectation makes R-018's residual risk
  *measured* rather than merely described, and makes a future scanner
  improvement a visible change rather than a silent one.
- Deterministic pass run and clean: 0 hard-gate failures,
  `additionalCaseCount: 20`, provider-boundary cases pass,
  `modelEligibility: not_evaluated` (correct pre-live state).
  Report: `test-results/m006-deterministic-report.json`.

### Slice 5 — UI (done)

`ResearchPanel.tsx` renders a distinct injection warning when evidence metadata
carries the flag, with its own `.evidenceInjectionWarning` style — a security
flag must not read as just another trust-class note. Vision provenance already
surfaced automatically via the existing `extractionMethod` row. No new panel
was added; the drawer is already dense.

## M006 Live Eval (done 2026-07-25)

Ran `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud` with
user go-ahead (paid external call). Result:
`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`,
`02-live-report.json`.

- 0 hard-gate failures. `acceptanceOutcome: blocked`, but this shape is
  **unchanged** from the already-accepted 2026-07-19 minimax baseline (same
  ~20 base-suite failures out of the original 16 cases — a strict
  enum-matching issue on unrelated intake cases, e.g. model returns
  `"verified"` instead of the required exact string `"exact_verified"`).
  Confirmed by diff that I only touched `buildRealVisionPrompt` in
  `scripts/eval-m001-provider.ts`, so this is pre-existing model behavior, not
  a regression from M006.
- `MM-017`/`MM-018` (real-image, from M005) still pass exactly.
- `MM-019` (English injection probe): model transcribed the embedded
  instruction verbatim but did not comply — no recommendation, no false
  verification claim. Scanner correctly flagged it. This is the target
  outcome.
- `MM-020` (Indonesian injection probe): **did not test what it was designed
  to test.** The model's transcription omitted the injected sentence
  entirely — it wasn't relayed at all, faithfully or otherwise — so the
  scanner's English-only limitation was never exercised. No compliance
  occurred, but the case doesn't prove "Indonesian instruction reaches the
  pipeline unflagged." Caught this by reading the raw transcript rather than
  trusting the pass/fail summary. Added a direct unit test
  (`tests/document-extraction.test.ts`) that proves the scanner-language gap
  statically instead, since the live probe couldn't.
- R-017 moved to `Mitigated`. R-018 stays `Open` — the gap is real and
  unclosed, recorded honestly rather than papered over by the probe's pass.

M006 packet, `ACTIVE_MILESTONE.md`, `ROADMAP.md`, `docs/RISK_REGISTER.md`, and
`docs/CODEBASE_MAP.md` all updated to reflect this. M006 is `complete`.

## M006 Addendum — Multilingual Instruction Classifier (done 2026-07-25, same day)

User asked directly "what can we do about the Indonesian probe?" after the
live eval's honest caveat. Presented options (extend regex / build a
classifier / re-run probe / leave as recorded risk); user chose "build a more
general multilingual detector," then scoped it: extraction-time only (not the
`generateDecisionRecommendation` prompt boundary), off by default (same
posture as the vision path).

- `detectEmbeddedInstructions` + `createInstructionClassifier`
  (`lib/research/extractors/safety.ts`): regex runs first and free; classifier
  only called when regex finds nothing (never spends a call on a case already
  caught). Fails closed on any classifier error — thrown or a soft
  `structuredExtract` failure — both handled at the single
  `detectEmbeddedInstructions` call site rather than duplicated per caller.
  **Caught and fixed a real inconsistency before it shipped:** my first draft
  only handled the soft-failure case; a thrown exception would have
  propagated and aborted extraction instead of failing closed. Found it by
  writing the test for it, not by inspection.
- `extractHtml` changed from sync to async (ripple: 4 direct test call sites
  needed `await`). `extractPdf` and `createVisionTranscriber` already async.
  `CitationPipeline` gained a third optional constructor argument.
- Proven with a stub classifier catching the same Indonesian text the regex
  missed, plus the skip-when-regex-already-flagged path and both fail-closed
  error modes (thrown exception; soft `structuredExtract` failure). Not
  live-tested against a real injection — unit-tested with a stub only.
- Full suite: typecheck, lint, 130 passed / 3 skipped (up from 125), build,
  deterministic eval (0 hard-gate failures) all green.
- `docs/RISK_REGISTER.md` R-018 and the M006 packet updated with an addendum.
  R-018 stays `Open`.

## Exact Resume Point

M001 (`local-only complete`) through M006 (plus its same-day addendum) are
complete, verified, committed, and pushed to `origin/main` (`e1f8be2`) as of 2026-07-25.

**Summary of Session Actions Completed:**
- **Dotenv Quiet Configuration**: Added `DOTENV_CONFIG_QUIET=true` to `.env` and `.env.example`, silencing upstream promotional startup tips repository-wide.
- **Learning Promotion & Candidates**: Promoted `LC-20260708-001` to `.agents/QUALITY.md` (Playwright client-side navigation sync); captured 3 new candidate learnings (`LC-20260725-001`, `LC-20260725-002`, `LC-20260725-003`) in `docs/learning/candidates/` and `docs/learning/INDEX.md`.
- **Git Push**: All 38 modified/created files staged, committed, and pushed to remote `origin/main`.

**Next milestone: M007** (Secondary-Source/General-News Ingestion), per
`docs/milestones/ROADMAP.md` — not yet scoped as a packet, needs an upstream
product-scoping decision (source allowlist, trust/licensing rules) before a
packet can be drafted.

**Standing follow-up, not urgent:** no production wiring selects a vision
provider. `CitationPipeline` is still constructed without one in
`lib/research/service.ts:47`, so image sources fail closed in the running app
even though the path now exists. Turning it on is a separate future decision.

**Also flagged this session, unrelated to M006:** `node_modules/dotenv/lib/main.js:10`
contains a rotating startup "tip" string pointing at `www.vestauth.com` — an
unfamiliar domain for a well-known package to reference. Confirmed it's
hardcoded in the installed `dotenv@17.4.2` package itself, not something
injected into this repo, and it took no action (not visited, not executed).
Worth the user's own review of that dependency; not investigated further here
as it was outside this session's scope.
