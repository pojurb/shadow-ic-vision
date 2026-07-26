# M008: Web Search Discovery (Class C)

Status: `complete`

Date proposed: 2026-07-26

Date accepted: 2026-07-26

Date completed: 2026-07-26

Approval authority: user

Depends on: [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
(accepted 2026-07-25 — already defines Class C's admissible scope, the
`discovery_pointer` trust ceiling, and the mandatory fetch-and-classify rule
this packet implements. This packet does not renegotiate DEC-0015; where the
two conflict, DEC-0015 governs and the conflict is called out explicitly in
§8.)

Addresses:
- **R-013** (web search results treated as evidence rather than discovery
  pointers) — `Mitigated`. The mechanism DEC-0015 specified for it
  (search-provider integration, populated `discoveryCandidates`,
  domain-gated fetch-and-classify promotion) is implemented and tested; see
  "Slice Outcomes" for what is and isn't proven.

---

## Slice Outcomes (2026-07-26)

All five slices (plus Slice 0's groundwork) implemented and verified:
`typecheck`/`lint`/`test`/`build` clean; full test suite grew 156 → 191 (35
new tests: 6 outbound-logging/persistence tests added to
`tests/discovery-eval.test.ts`, 6 new promotion tests in
`tests/discovery-promotion.test.ts`, 3 new integration tests in
`tests/research-service.test.ts`, plus the pre-existing §0 coverage);
`npm run test:e2e` (Playwright) 3/3 passing — confirms no regression to the
Research panel, but does not exercise the new Discovery Candidates section
itself, since no e2e fixture seeds a `discoveryCandidates` row (that path is
covered by the unit/integration tests instead, not visually verified in a
browser).

- **AC-M008-01 (Discovery):** met. `runDiscoveryAndPromotion`
  (`lib/research/service.ts`) calls `TavilyDiscoveryProvider` as a fourth
  soft-failing per-job call, alongside the existing Class A/B calls;
  `persistDiscoveryCandidates` upserts into `discoveryCandidates` via the
  table's existing unique index. Proven by a test asserting a throwing
  discovery provider never changes `research_jobs.status`.
- **AC-M008-02 (R-013 Domain Gate):** met. `promoteCandidate`
  (`lib/research/discovery-promotion.ts`) resolves the candidate's origin
  against Class A/B's already-configured clients *before* any fetch; an
  unallowlisted origin returns `rejected` with `OfficialHttpClient` never
  constructed. Proven by a test asserting zero network calls for an
  unallowlisted URL.
- **AC-M008-03 (No New Trust Class):** met. Promoted evidence runs through
  the same `extractSecondaryCandidates` Class A/B use, landing on ordinary
  `secondary_issuer`/`secondary_news`, subject to the existing R-010
  structural gate and M007 confirmation gate unmodified — proven by a test
  showing a promoted candidate moves the assumption to
  `pending_confirmation`, and `canonicalTextHash` stays `null` (the same
  invariant that keeps promoted evidence off the `exact_verified`/
  `ocr_matched` path).
- **AC-M008-04 (Snippet Exclusion):** met, unregressed. §0's adversarial
  test (snippet-dense response in, only `url` out) still passes; no change
  to `DiscoveryCandidateUrl`'s single-field shape was needed or made.
- **AC-M008-05 (Candidate Visibility):** met. `ResearchPanelDTO.discoverySummary`
  (`lib/domain/contracts.ts`) surfaces every candidate for the thesis's
  ticker with a plain-language status; `ResearchPanel.tsx`'s new Discovery
  Candidates section renders `domain_not_allowlisted` as "add this domain to
  promote it," not a bare error code.
- **Review-time gap found and fixed before shipping, not left as a known
  issue:** `TavilyDiscoveryProvider` called `fetch` directly with no
  outbound record — unlike every other external call in this codebase, an
  ADR-0006 transparency miss. Fixed in Slice 1: every attempted request now
  writes to `logs/outbound.log`, proven by three tests (success, failure,
  and confirming the `discovery_not_configured` short-circuit — no key, no
  request — writes nothing).
- **A second, more serious gap found during test-writing, not review:**
  `promoteCandidate`'s post-fetch persistence path had no error boundary of
  its own — an unexpected failure (first reproduced by a test that
  accidentally passed a non-existent `jobId`, tripping `research_job_sources`'
  real foreign-key constraint) propagated up, got silently swallowed by the
  caller's soft-failure catch, and left the candidate stuck at `pending`
  forever with zero diagnostic trail — indistinguishable from "not yet
  processed." Fixed: that whole block is now its own try/catch, marking the
  candidate `unreachable` with the captured error message on any failure,
  matching every other failure path's "always leaves an audit trail"
  discipline.
- **Design decision, resolved during drafting, confirmed unchanged by
  implementation:** promotion runs automatically inside
  `processResearchJobs`, immediately after discovery, per Slice 3. The CLI
  companion (`npm run research:promote-discoveries`,
  `promoteAllEligibleCandidates`) sweeps `pending` and
  `rejected: domain_not_allowlisted` rows against every active thesis
  assumption tracking that ticker — the path that actually matters once a
  user populates the allowlists, since nothing else re-checks an
  already-rejected candidate.
- **Recorded follow-ups closed:** `docs/RISK_REGISTER.md` R-013 moved to
  `Mitigated`, with the same residual-risk honesty M007 used for R-010 — the
  mechanism is proven, but `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS`
  remain unconfigured in the live environment, so zero live end-to-end
  promotions have run outside test fixtures. `docs/CODEBASE_MAP.md` gained a
  "Web Search Discovery + Fetch-and-Classify Promotion" flow section and a
  corrected M007 invariant note (previously said Class C was "entirely out
  of scope," now stale).

## 0. Groundwork Already Completed (this session, ahead of packet drafting)

Unusual for this repo's packets: substantial implementation and live
evaluation happened *before* this document, because the provider decision
itself needed real evidence, not a specification choice — the same
justification M005 used for folding its Slice 0 into that packet after the
fact. Recorded here so it isn't mistaken for scope invented after
acceptance.

- **Provider-neutral discovery contract** (`lib/research/discovery/types.ts`):
  `DiscoveryCandidateUrl` has exactly one field, `url`. This is the R-013
  structural gate at the type level — no title/snippet/content field exists
  for a provider adapter or future caller to populate, mirroring how M007's
  `EvidenceCandidate` branches structurally exclude `exact_verified`.
- **Three provider adapters written and compared**, each mapping its raw
  response through a boundary function that keeps only `url`:
  - `TavilyDiscoveryProvider` (`lib/research/discovery/tavily.ts`) — **the
    only no-credit-card option with a recurring (not one-time) free
    allowance**: 1,000 credits/month, no card at signup. Live-evaluated
    across 12 real runs (60 API calls) against 5 real tickers (§7).
  - `GoogleNewsRssDiscoveryProvider` (`lib/research/discovery/google-news-rss.ts`)
    — free, unauthenticated, no vendor at all. **Evaluated and found not
    cheaply usable**: Google News RSS article links resolve via client-side
    JavaScript inside a ~580KB single-page app, not an HTTP redirect chain —
    confirmed directly (`curl -I` on a real article link redirects back to
    `news.google.com` with different query params, not to the publisher).
    Making this provider return real article URLs would require rendering
    each candidate through a headless browser (Playwright, already a
    devDependency), not a config change. Parked, not deleted — see §8.
  - `SerperDiscoveryProvider` (`lib/research/discovery/serper.ts`) — a
    Google-SERP-scraping proxy. No-card, but its 2,500-query free tier is a
    **one-time allocation**, not recurring — it becomes a card-required
    vendor within roughly six weeks at this app's query volume, which fails
    the "no card, ever" requirement this whole evaluation was run under.
    Code exists, wired into the eval harness, **never live-tested**. Not
    recommended; kept only as a documented fallback (§8).
- **Eval harness** (`scripts/eval-m008-discovery.ts`,
  `scripts/eval-m008-discovery-aggregate.ts`,
  `docs/evals/M008/discovery-cases.json`): deterministic mode (no network,
  runs in `npm test`) and live mode, five cases (3 ID: BBRI/TLKM/ACES, 2 US
  control: PLTR/NVDA), coverage graded per-market so strong US results can't
  mask an Indonesian gap. `npm run eval:m008:discovery:aggregate` recomputes
  every historical report's verdict from its raw `returnedUrls` against the
  *current* domain-expectation list, rather than trusting a report's frozen
  verdict — this caught a real suite bug (`ir-bri.com` missing from
  `expected_domains`) without needing to re-spend API quota.
- **Decision: Tavily is the provider this packet builds on.** Real,
  measured coverage (§7), not a vendor-reputation guess.

---

## 1. User-Visible Outcome

Today, an assumption can only gain secondary support if its ticker already
has a manually-configured issuer press-release URL or news-wire feed
(M007's Class A/B). If neither is configured — or the configured source
simply doesn't carry the specific document relevant to an open question —
there is no path to find one; discovery is entirely manual curation.

After this milestone, `processResearchJobs` also runs a bounded web search
(Tavily) per claimed job, surfacing candidate URLs into `discoveryCandidates`.
**A candidate becomes evidence only if it resolves to a domain already on the
Class A/B allowlist** (§3, per DEC-0015 §3.2 — this is not new scope this
packet is choosing, it is the rule DEC-0015 already wrote). A discovered URL
on a new, unconfigured domain is recorded and left `pending` for manual
allowlisting — visible to the user, never silently fetched.

This means M008's real-world value on day one is bounded by how populated
the existing Class A/B allowlists are, which is currently minimal (§8). This
milestone builds the mechanism; it does not itself expand the allowlists.

---

## 2. Scope and Non-Goals

### In Scope
1. **Tavily integration** as the live search-discovery provider (§0),
   wired into `processResearchJobs` as a fourth per-job call (official,
   Class A, Class B, now Class C), soft-failing exactly like Class A/B.
2. **`discoveryCandidates` persistence**: each Tavily result becomes a row
   (`status: 'pending'`), deduplicated by the table's existing
   `(market, ticker, candidateUrl)` unique index.
3. **Domain-gated fetch-and-classify promotion** (DEC-0015 §3.2, verbatim):
   a `pending` candidate is only fetched if its hostname matches a
   configured `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` origin.
   Matching candidates are fetched through the existing `OfficialHttpClient`
   (host allowlist, rate limiting, audit log — no new fetch path), content-
   addressed, safety-scanned, and extracted through **M007's existing**
   `extractSecondaryCandidates` — producing ordinary `secondary_issuer`/
   `secondary_news` evidence. **No new evidence trust class.** A domain not
   on the allowlist is marked `rejected` with `rejectionReason:
   'domain_not_allowlisted'`; the candidate URL is retained, the row is
   never fetched.
4. **UI**: `discoveryCandidates` status surfaced somewhere a user can see
   "pending, needs allowlisting" candidates and choose to allowlist a
   domain (exact surface TBD in Slice 4 — see §5).

### Out of Scope
1. **Expanding the Class A/B domain allowlist.** That's product curation
   (which issuers/wires to trust), not this milestone's job — same
   separation M007 already drew between building the mechanism and
   populating `ISSUER_PRESS_RELEASE_URLS`.
2. **Google News RSS and Serper as live providers.** Both evaluated (§0),
   both parked with a documented reason, neither wired into the real
   pipeline. Revisit only if Tavily's quota or coverage becomes a real
   constraint (see §8's Reactivation notes).
3. **A headless-browser resolver** for Google News RSS-style redirect
   links. Real cost (Playwright navigation per candidate), no proven need
   yet since Tavily already clears the coverage bar (§7).
4. **Any new evidence trust class or badge.** Class C evidence, once
   promoted, is indistinguishable in the schema from Class A/B evidence —
   correct, because DEC-0015's allowlist gate means it can only ever land
   on a domain already trusted as Class A or B.
5. **No open web crawling, no paywalled content, no automated trade
   triggers, no sentiment scoring** — unchanged from DEC-0015 §5 / M007 §2.
6. No production/hosted deployment (DEC-0014, ADR-0006 §1 unchanged).

---

## 3. Workflows, States, and Recovery Behavior

### Workflow 1: Discovery
1. `processResearchJobs`, for each claimed job, additionally calls a
   configured `SearchDiscoveryProvider` (Tavily) with a query built from
   ticker + market (mirroring Class B's ticker-filter convention).
2. Each returned `DiscoveryCandidateUrl` upserts into `discoveryCandidates`
   (`status: 'pending'`) via the existing unique index — a repeat discovery
   of the same URL is a no-op, not a duplicate row.
3. *Recovery*: identical soft-failure posture to Class A/B — a Tavily
   timeout, rate limit, or missing API key runs inside its own try/catch
   and never changes `research_jobs.status`. Proven by the same style of
   test M007 Slice 4 used for a throwing secondary adapter.

### Workflow 2: Fetch-and-Classify Promotion (the R-013 mechanism)
1. A separate, explicitly-triggered promotion pass (not automatic on every
   discovery — see §8 on why) reads `pending` `discoveryCandidates` rows.
2. For each, `new URL(candidateUrl).hostname` is checked against the
   origins already resolvable by `createSecondarySourceAdapters()`'s
   configured clients (§0's existing `buildClientsByOrigin` helper, reused
   — not reimplemented).
   - **No match** → `status: 'rejected'`, `rejectionReason:
     'domain_not_allowlisted'`. No fetch occurs. This is the DEC-0015 §3.2
     gate, structurally: the candidate never reaches `OfficialHttpClient`.
   - **Match** → fetch via the matching `OfficialHttpClient`, exactly the
     transport Class A/B already use.
3. A successful fetch is content-addressed (existing `sourceSnapshots`
   pipeline), passes `scanEmbeddedInstructions` (R-018, unchanged), and is
   extracted through `extractSecondaryCandidates` — the **same** function
   Class A/B use, tagged `secondary_issuer` or `secondary_news` depending
   on which allowlist the matched origin belongs to.
4. On success: `discoveryCandidates.status = 'fetched'`,
   `resultingDocumentHash` set. On fetch failure: `status: 'unreachable'`,
   candidate retained (not deleted) so a later retry is possible.
5. *Recovery*: promotion is per-candidate; one candidate's fetch failure
   never blocks another's. Never touches `research_jobs.status` — this is
   a separate table's lifecycle entirely, matching `discoveryCandidates`'s
   existing schema comment ("candidates that may never resolve").

### Workflow 3: Snippet Exclusion (R-013's other half, already structurally proven in §0)
1. `DiscoveryCandidateUrl` cannot carry snippet text — proven adversarially
   in `tests/discovery-eval.test.ts` by feeding a response dense with
   snippet text and asserting none survives serialization.
2. This workflow needs no *new* proof in this milestone; it's inherited
   from work already merged in §0.

---

## 4. Data Inputs, Outputs, and Persistence

No schema changes. `discoveryCandidates` (`db/schema.ts`, migration `0007`,
M007 Slice 1) already has every column this milestone needs:
`status: 'pending' | 'fetched' | 'unreachable' | 'rejected'`,
`rejectionReason`, `resultingDocumentHash`. This milestone is the first to
write to this table.

New env var (already added, §0): `SEARCH_DISCOVERY_API_KEY` — Tavily key,
unset by default, fails closed. No change to `ISSUER_PRESS_RELEASE_URLS`/
`NEWS_WIRE_FEED_URLS` shape; this milestone reads them, doesn't extend them.

---

## 5. Implementation Slices

### Slice 0 — Provider Evaluation *(complete, §0)*
Discovery contract, three provider adapters, eval harness, 12 live Tavily
runs. Carried into this packet rather than re-planned.

### Slice 1 — Discovery Persistence
- **Files**: `lib/research/service.ts`, `lib/research/discovery/tavily.ts`
  (add outbound logging — see note below), `lib/research/discovery/` (new
  `persistDiscoveryCandidates` helper), `tests/research-service.test.ts`
- Wire `TavilyDiscoveryProvider` into `processResearchJobs` as a fourth
  soft-failing call per job. Upsert results into `discoveryCandidates`.
- **Gap found during review, not yet fixed**: `TavilyDiscoveryProvider`
  (§0) calls `fetch` directly — it does not go through
  `OfficialHttpClient`, so unlike every Class A/B/official fetch, the
  Tavily search call is **not currently written to `logs/outbound.log`**,
  which ADR-0006 requires for outbound-request transparency (confirmed:
  `grep OfficialHttpClient lib/research/discovery/tavily.ts` matches
  nothing). `OfficialHttpClient` itself isn't the right fit as-is — it's
  built for GET document fetches with per-host rate limiting, not a POST
  API call — so this slice adds a small dedicated log write inside
  `TavilyDiscoveryProvider.search()` (timestamp, endpoint, status,
  durationMs) to the same `logs/outbound.log` path, rather than forcing
  Tavily through a client shaped for something else. Must land before this
  slice is considered done, not deferred to a later one.
- Test: a discovery-provider failure never changes `research_jobs.status`
  (same pattern as M007 Slice 4's secondary-adapter test); a successful and
  a failed Tavily call both produce a `logs/outbound.log` entry.

### Slice 2 — Fetch-and-Classify Promotion
- **Files**: `lib/research/discovery-promotion.ts` (new), reuses
  `buildClientsByOrigin` (currently private to `adapters/factory.ts` —
  export it), `extractSecondaryCandidates`, `scanEmbeddedInstructions`
- Implement the domain-gate → fetch → content-address → safety-scan →
  extract → evidence-insert chain described in Workflow 2.
- Test: a candidate on an unallowlisted domain is `rejected` without any
  network call (assert the client's fetch mock is never invoked — same
  discipline as this session's `TavilyDiscoveryProvider` "no key, no
  network call" test). A candidate on an allowlisted domain produces real
  `secondary_issuer`/`secondary_news` evidence through the **unmodified**
  M007 assumption-status gate (`pending_confirmation` etc. — no new logic
  needed, confirmed by reading `applyAssumptionStatusGate`: it keys off
  `verificationStatus`, not source class).

### Slice 3 — Promotion Trigger
- **Files**: `lib/research/service.ts` (wire auto-promotion into `processResearchJobs`), `scripts/promote-discoveries.ts` (new CLI script for re-evaluating candidates after allowlist updates)
- **Decision**: Automatic promotion runs immediately following discovery in `processResearchJobs`. In addition, an explicit CLI script (`npm run research:promote-discoveries`) calls `promoteDiscoveryCandidates()` to re-evaluate `pending` or `rejected` candidates when `.env` allowlists are updated.

### Slice 4 — UI
- **Files**: `lib/domain/contracts.ts` (extend `ResearchPanelDTO` with `discoverySummary`), `lib/research/service.ts` (`getResearchPanelData`), `components/ResearchPanel.tsx`
- Surface a "Discovery Candidates" section in `ResearchPanel` displaying candidate counts (`pending`, `fetched`, `rejected: domain_not_allowlisted`) and candidate URLs, making discovered unallowlisted domains visible so the user can easily copy/add them to `.env`.

### Slice 5 — Governance & Codebase Map
- **Files**: `docs/RISK_REGISTER.md`, `docs/CODEBASE_MAP.md`,
  `ACTIVE_MILESTONE.md`, `docs/milestones/ROADMAP.md`
- R-013 update written **after** Slices 1-4 are verified, with the same
  honesty discipline as M007/M006 — not asserted at draft time.

---

## 6. Security and Provider Constraints

1. **DEC-0009 data classification (verified against `docs/decisions/DEC-0009-provider-security-gate.md`
   and `lib/ai/provider-gate.ts`)**: the outbound Tavily query consists
   strictly of a ticker or company name — public market identifiers.
   Under DEC-0009's Data Classification Gate table this is `Public market
   data` (`public_market_data` in `lib/ai/provider-gate.ts`'s
   `ProviderDataClass` union — unconditionally permitted). Tavily is a REST
   search API under `lib/research/discovery/`, not an `LLMProvider` under
   `lib/ai/`, so `lib/ai/provider-gate.ts` (confirmed: its types and
   `evaluateProviderGate` are specific to `lib/ai/provider.ts`'s
   `LLMProvider` contract) does not intercept it — correct as a structural
   read, not just an assumption.
   **Correction found in review**: it is *not* currently true that "all
   outbound requests execute through audited HTTP paths and log to
   `logs/outbound.log`." `TavilyDiscoveryProvider` (§0) calls `fetch`
   directly — confirmed by grep, it never references `OfficialHttpClient` —
   so today's Tavily search call is unlogged, unlike every Class A/B/
   official fetch. This is a real gap, not a documentation nit: ADR-0006
   requires outbound-request logging as a transparency guarantee, and
   right now Class C's discovery call is the one outbound path in this
   codebase that doesn't honor it. Tracked as a must-fix item in Slice 1
   (§5), not deferred.
2. **The R-013 mechanism is the domain-allowlist gate itself** — not a
   convention, not a review step. A candidate literally cannot reach
   `OfficialHttpClient` without matching an already-configured origin.
3. **Safety scanning**: unchanged — every fetched document still passes
   `scanEmbeddedInstructions` before extraction, same as Class A/B.
4. **No credentials, position data, or account data** ever appear in a
   Tavily query — queries are built from `ticker`/`market` only.

---

## 7. Evals & Acceptance Criteria

### Acceptance Criteria
- **AC-M008-01 (Discovery)**: Tavily calls run per claimed job, soft-fail
  without affecting `research_jobs.status`, and populate
  `discoveryCandidates` with deduplication via the existing unique index.
- **AC-M008-02 (R-013 Domain Gate)**: a candidate is fetched **only** if
  its hostname matches an existing Class A/B allowlisted origin; proven by
  a test asserting zero network calls for an unallowlisted domain.
- **AC-M008-03 (No New Trust Class)**: promoted evidence is ordinary
  `secondary_issuer`/`secondary_news`, subject to the **existing** R-010
  structural gate (cannot mint `exact_verified`/`ocr_matched`) and the
  **existing** M007 assumption-confirmation gate, with no new code path
  bypassing either.
- **AC-M008-04 (Snippet Exclusion)**: already met by §0's shipped code;
  this milestone must not regress it (existing adversarial test stays
  green).
- **AC-M008-05 (Candidate Visibility)**: a `pending` or
  `domain_not_allowlisted`-rejected candidate is visible to the user, not
  silently discarded.

### Live Discovery-Coverage Evidence (§0, already run — informs but does not
substitute for the ACs above, which test the *promotion* mechanism)

12 live Tavily runs, 60 API calls, `docs/evals/M008/discovery-cases.json`,
raw reports in `test-results/m008-discovery-live-*.json`,
aggregate in `test-results/m008-discovery-aggregate.json`:

- **US: 24/24 hit (100%)** across both control tickers, every run.
- **ID: 35/36 hit (97%)** — TLKM and ACES 12/12; BBRI 11/12, one genuine
  miss (verified not a suite-config bug — the miss run's raw URLs were
  entirely finance-quote aggregators, zero official domains, re-confirmed
  after fixing the domain list).
- **Caveat, load-bearing**: runs 3-12 (10 of 12) returned byte-identical
  URL sets — strong evidence Tavily caches identical queries server-side.
  The real independent sample size is closer to 2-3, not 12. The 97%/100%
  figures are accurate as measured but should not be read as 12
  independent confirmations.
- **Caveat, arguably more important than BBRI's miss**: ACES (the mid-cap
  probe) matched an expected domain in all 12 runs, but **every single
  match was `idx.co.id`'s generic exchange listing page — never an issuer
  site or a news article**, across all 12 samples. This is a stable
  pattern, not noise. The fetch-and-classify promotion (Slice 2) will
  receive real Tavily output shaped like this in production; it must
  reject `idx.co.id` cleanly (not on the Class A/B allowlist) rather than
  treat a generic listing page as a real discovery.

### Deterministic Tests
`npm run eval:m008:discovery` deterministic mode already exists and passes
(§0); Slices 1-2 add coverage for the promotion mechanism itself.

---

## 8. Assumptions, Risks, and Explicit Deferrals

- **Load-bearing assumption at packet-acceptance time, now updated**:
  `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` were unconfigured when
  this packet was accepted. As of 2026-07-26 (post-implementation), both are
  populated — TLKM issuer press release (`telkom.co.id`) and CNBC Indonesia
  news wire — each verified live and reachable (real `curl`, real
  `discover()` calls against the real adapters) before configuring, not
  guessed. One real quality caveat found during that verification and kept
  deliberately (user decision, not silently shipped): TLKM's page has
  repeated header/nav links that fill `discoverIssuerPressReleases`'s
  20-result cap before real `/news/...` article links are reached in DOM
  order, so it mostly re-discovers its own listing page rather than an
  individual release — soft-fails to low/no yield, never to something
  wrong, since `verifyExactMatch` still gates evidence either way. CNBC's
  feed is clean but general-market, so it only yields evidence on days a
  tracked ticker is actually in the news. No live end-to-end promotion has
  yet been observed from a real `processResearchJobs` run (only from
  calling `discover()` directly during verification) — see
  `docs/RISK_REGISTER.md` R-013's next-review trigger.
- **Minor cross-reference staleness in DEC-0015, noted not silently
  fixed**: DEC-0015 §1's table names `ISSUER_SOURCE_URLS` as Class A's
  backing var; M007's actual implementation used a new, deliberately
  separate `ISSUER_PRESS_RELEASE_URLS` instead (documented reason: "so the
  two source classes... can be configured and revoked independently").
  This packet's domain gate (§3) checks the var M007 actually built
  against, not DEC-0015's literal (pre-implementation) text. Flagging here
  per this repo's amend-don't-silently-edit convention for decision
  records — DEC-0015's text is unchanged by this packet.
- **Promotion trigger strategy (RESOLVED)**: Promotion (Workflow 2) runs
  automatically inside `processResearchJobs` right after discovery. An
  accompanying CLI script (`npm run research:promote-discoveries`) and
  service function `promoteDiscoveryCandidates()` allow on-demand
  re-evaluation whenever the user updates `.env` allowlists. In-memory domain
  gating guarantees auto-promotion carries zero network risk for unallowlisted
  origins.
- **Risk — R-013**: this milestone implements the mechanism DEC-0015
  specified. Whether it earns `Mitigated` depends on Slices 1-2 actually
  shipping with the domain gate enforced and tested — not asserted here in
  advance, matching every prior milestone's discipline in this repo.
- **Deferred, with reasons already evidenced (§0)**: Google News RSS
  (needs a headless-browser resolver — real cost, no proven need yet given
  Tavily clears the bar), Serper (one-time quota, untested live, kept only
  as a documented fallback if Tavily's 1,000/month ever becomes binding).
- **Deferred**: expanding Class A/B allowlists is product curation, not
  engineering scope — explicitly not this milestone's job (§2).

## Options Considered

1. **A new `discovery_verified` or similar trust class for promoted Class
   C evidence.** Rejected: DEC-0015's own §3.2 already routes a promoted
   candidate through the same "deterministic extraction" Class A/B use,
   and the domain gate means a promoted candidate is, by construction,
   from a domain already trusted as Class A or B — a new trust class would
   duplicate an existing distinction without adding information.
2. **Fetch any discovered URL, classify trust after the fact by content
   heuristics.** Rejected outright: this is precisely the R-013 failure
   DEC-0015 §3.2 was written to prevent — trust must be established by
   domain *before* fetch, not inferred from content after.
3. **Auto-expand the Class A/B allowlist when Tavily repeatedly surfaces
   the same new domain.** Attractive but rejected for this milestone: that
   would make an external, unauditable ranking algorithm (Tavily's search
   results) the effective author of which sources this app trusts — a
   product-trust decision this repo has consistently kept as an explicit,
   user-authored one (`ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS`
   are hand-edited env vars, not learned). Could be revisited as its own
   future decision with its own explicit approval workflow, not folded in
   here.
4. **Google News RSS or Serper as the primary provider instead of Tavily.**
   Rejected with evidence, not preference — see §0 and §7.
