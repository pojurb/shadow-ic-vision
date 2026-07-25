# M007: Secondary-Source / General-News Ingestion

Status: `complete`

Date proposed: 2026-07-25

Date accepted: 2026-07-25

Date completed: 2026-07-25

Approval authority: user

Depends on: [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
(accepted 2026-07-25 — defines admissible secondary sources, licensing
rules, the `secondary_issuer`/`secondary_news` trust classes, the
`pending_confirmation` gate, and mandatory fetch-and-classify rules for web
search discovery)

Addresses:
- **R-010** (secondary or user evidence mistaken for official fact) —
  `Mitigated`. Structural enum isolation, the `pending_confirmation` gate,
  and distinct UI badging are implemented and tested (see "Slice Outcomes").
- **R-013** (web search snippets treated as evidence) — **stays `Open`**.
  Class C (the actual search-snippet-handling code) was deferred entirely —
  no search-provider integration exists anywhere in this codebase. A
  milestone that ships none of the mechanism cannot be credited with
  mitigating the risk that mechanism would address; see "Slice Outcomes".

---

## Slice Outcomes (2026-07-25)

All eight slices implemented and verified: `typecheck`/`lint`/`test`/`build`
clean after every slice; full test suite grew 130 → 156 (26 new tests across
7 new/existing files); `npm run test:e2e` (Playwright) 3/3 passing after
fixing a real regression the suite caught (see Slice 6); both the
deterministic and provider evaluators re-run directly with 0 hard-gate
failures.

- **AC-M007-01 (Secondary extraction & provenance):** met. Both classes
  extract with correct provenance; proven by dedicated adapter tests
  (Slice 3), pipeline-level tests (Slice 4), and eval cases `MM-021`/`MM-022`
  (Slice 7).
- **AC-M007-02 (R-010 structural hardening):** met. Enforced by construction
  (`extractSecondaryCandidates` has no code path to the official-evidence
  factories), not a runtime check — proven adversarially by both a unit test
  and eval case `MM-023`, which reuses `exact_verified`-shaped text through
  the secondary path and confirms it still cannot be promoted.
- **AC-M007-03 (Confirmation gate):** met. `pending_confirmation` →
  `untested` (official arrives) and → `user_confirmed_secondary` (explicit
  acceptance, never `verified`) both proven end-to-end through real
  `processResearchJobs` calls, not just the pure decision function in
  isolation.
- **AC-M007-04 (R-013 snippet exclusion):** **structurally prepared, not
  exercised.** The `discoveryCandidates` table has no snippet/title column —
  true by construction — but nothing in this milestone writes to it, since
  Class C was deferred. The type-level guarantee exists; the behavior it
  guards has no code path to test yet.
- **AC-M007-05 (UI badging):** met, with one deliberate scope narrowing.
  Distinct badges shipped in the Research drawer (genuinely new colors, not
  colliding with `ocr_matched`) and the alerts sidebar. DEC-0015 also named
  the Top-10 Queue and Portfolio Briefing as badge locations; only the
  Research drawer and alerts sidebar were built — the other two surfaces
  don't currently render evidence-level trust badges at all (only
  assumption-level/job-level status), so there was nothing to extend there
  without inventing new UI surface beyond this milestone's scope.
- **AC-M007-06 (Ingestion resilience):** met. Proven by a dedicated test: a
  throwing secondary adapter leaves the job `succeeded` with `error: null`.
- **Recorded follow-ups closed:** `docs/RISK_REGISTER.md` R-010 moved to
  `Mitigated`; R-013 updated but deliberately left `Open` (see above).
  `docs/CODEBASE_MAP.md` gained the confirmation-gate state diagram, the
  Secondary-Source Ingestion flow, and the R-010 structural-invariant entry.

**Real regression caught and fixed mid-milestone, not swept in silently:**
Slice 6's UI change (assumption status: raw enum text → proper badge) broke
two pre-existing Playwright assertions expecting the literal old text. Fixed
by updating the assertions to match the new, correct UI — recorded here so
the fix isn't mistaken for scope creep.

**Not done, deliberately — Class C (web search discovery):** no
search-provider integration, no code that reads a search result, exists
anywhere in this codebase after this milestone. Recommended as a separate
follow-on (M008 or a v1.1 slice) per the "Options Considered" rationale
below. `discoveryCandidates` (Slice 1) is schema-ready for it but inert.

---

## 1. User-Visible Outcome

Today, evidence can only ever be official (`exact_verified`, `ocr_matched`)
or `derived`. A user who wants a company press release or a news-wire story
folded into their thesis has no path to do that — the research pipeline
only discovers SEC/IDX filings.

After this milestone, a thesis's assumptions can also be supported by
company IR press releases (`secondary_issuer`, Class A) and curated
financial news wires (`secondary_news`, Class B), fetched through the same
governed pipeline as official filings, and rendered with distinct
amber-family badges ("Secondary: Issuer PR" / "Secondary: News Wire") that
never look like an official filing. An assumption resting *only* on
secondary evidence — with no official confirmation — is visibly marked
`pending_confirmation` until either an official filing arrives or the user
explicitly accepts the secondary evidence via an in-app action, landing it
on a separate `user_confirmed_secondary` status that stays visually distinct
from `verified` even after acceptance.

Portfolio alerts can originate from secondary news, exactly as they already
do from official filings. Nothing about this milestone can originate or
alter a recorded Buy/Hold/Reduce/Exit decision (DEC-0011 stays intact).

---

## 2. Scope and Non-Goals

### In Scope
1. **Class A — Issuer Press Releases**: direct company IR announcements
   from allowlisted domain URLs (`ISSUER_PRESS_RELEASE_URLS`).
2. **Class B — Curated News Wires**: financial news RSS/Atom/JSON feeds
   from allowlisted publishers (e.g. Antara News for ID, PR Newswire for
   US), filtered to tracked tickers/legal names.
3. **Structural enum isolation**: `secondary_issuer`/`secondary_news`
   verification statuses, hard-gated against `exact_verified`/`ocr_matched`
   promotion.
4. **Assumption confirmation gate**: assumptions supported exclusively by
   secondary evidence remain `pending_confirmation`; user acceptance
   transitions to `user_confirmed_secondary` (never `verified`).
5. **Pre-fetch candidate tracking**: a new `discovery_candidates` table
   guaranteeing search text snippets are never written to `Evidence` or
   `SourceSnapshot`.

### Out of Scope (per DEC-0015 §4/§5 and R-005)
1. **Class C — Web Search Discovery.** Deferred to a separate follow-on
   milestone (M008 or a later v1.1 slice). Class A and Class B already
   perform their own discovery (crawling an IR page, parsing a feed) with no
   search-API dependency; Class C's incremental value (surfacing a URL with
   no allowlisted feed) is narrow against its cost (search-provider
   integration, API keys/quota, a whole separate pre-fetch promotion
   workflow, new UI/API surface). Not one line of Class C code ships here.
2. **No open web crawling** of un-allowlisted domains.
3. **No paywalled or gated content** (e.g. WSJ, FT, Bloomberg Terminal).
4. **No automated trade actions** — secondary items can trigger portfolio
   alerts, but can never originate or alter Buy/Hold/Reduce/Exit decisions.
5. **No sentiment scoring** — ingested text is evaluated strictly for
   factual claims and assumption alignment.
6. No new markets, asset classes, or expansion beyond DEC-0003's tracked
   US/ID public-equities universe (up to 100 companies).
7. No production or hosted-demo approval for any new outbound HTTP
   destination — stays within the existing local-only deployment contract
   (DEC-0014, ADR-0006 §1).

---

## 3. Workflows, States, and Recovery Behavior

### Workflow 1: Secondary Evidence Discovery and Extraction

1. `processResearchJobs` (`lib/research/service.ts`), for each claimed
   research job, calls `pipeline.executeResearchJob(...)` up to three times:
   once against the official adapter (unchanged), once against a configured
   `IssuerPressReleaseAdapter` (Class A), once against a configured
   `NewsWireAdapter` (Class B) — each call persisting its own snapshot via
   the existing, already-unexploited `researchJobSources` many-to-many join.
2. A secondary call passes `evidenceClass: 'secondary_issuer' | 'secondary_news'`
   to `executeResearchJob`, which routes extraction to the new
   `extractSecondaryCandidates` function instead of
   `extractDeterministicCandidates`.
3. *Recovery:* a missing feed configuration, HTTP failure, or empty
   discovery result for a secondary source runs inside its own try/catch and
   never fails or degrades the parent job — `research_jobs.status` stays
   anchored to the official-source outcome (R-007's "some sources will be
   unavailable" tolerance).

### Workflow 2: Trust-Class Enforcement

1. Any candidate from `extractSecondaryCandidates` is built only through
   `createSecondaryIssuerCandidate`/`createSecondaryNewsCandidate`
   (`lib/research/extractors/candidate.ts`), each hardcoding its own
   `verificationStatus` — the same mechanism that already makes
   `createOcrCandidate` incapable of producing `exact_verified`.
   `extractSecondaryCandidates` has no code path that references the
   official-evidence factories at all.
2. *Recovery:* there is no upgrade path from `secondary_issuer`/`secondary_news`
   to any official class. A mismatch or missing quote is a rejected
   candidate, never a promoted one.

### Workflow 3: Assumption Confirmation Gate

1. On secondary-evidence insert, if the assumption's status is still
   `'untested'` (its untouched default) and no `exact_verified`/`ocr_matched`
   evidence exists for it, `deriveAssumptionStatus` sets it to
   `'pending_confirmation'`, inside the same transaction as the evidence
   insert.
2. **Clearing path 1:** official evidence arriving in that same transaction
   reverts `'pending_confirmation'` back to `'untested'`.
3. **Clearing path 2:** the user calls
   `POST /api/assumptions/[id]/accept-secondary-evidence`, which sets status
   to `'user_confirmed_secondary'` — distinct from `'verified'`, so the
   Research drawer never shows a secondary-only assumption with the same
   badge as an officially-verified one.
4. *Recovery:* this is the first place application logic mutates
   `assumptions.status` after creation (confirmed by code review — nothing
   else does today). The gate only ever narrows what's shown; it never
   silently marks anything `'verified'`.

### Workflow 4: Portfolio Alerts From Secondary Sources

1. `persistSourceSnapshot` (`lib/research/snapshot-store.ts`) is already
   source-tier-agnostic — a new secondary-source snapshot triggers the
   existing alert-creation path with no changes.
2. `getUnreadAlerts` (`db/queries.ts`) gains `sourceTier` in its projection
   so the UI can badge an alert as official vs. secondary.

---

## 4. Data Inputs, Outputs, and Persistence

### Schema Updates (`db/schema.ts`)

1. **Widened enums** (TypeScript/Zod narrowing, no DDL required — every
   `db/migrations/*.sql` file was checked for `CHECK` constraints; there are
   none, so both widenings are type-only):
   - `assumptions.status`: adds `'pending_confirmation'` and
     `'user_confirmed_secondary'`.
   - `evidence.verificationStatus`: adds `'secondary_issuer'` and
     `'secondary_news'`.
2. **New table**, migration `0007_add_discovery_candidates.sql` — the one
   real DDL change this milestone needs:
   ```typescript
   export const discoveryCandidates = sqliteTable('discovery_candidates', {
     id: text('id').primaryKey(),
     market: text('market', { enum: ['US', 'ID'] }).notNull(),
     ticker: text('ticker').notNull(),
     candidateUrl: text('candidate_url').notNull(),
     discoveredVia: text('discovered_via', { enum: ['web_search'] }).notNull().default('web_search'),
     searchQuery: text('search_query').notNull(),
     status: text('status', { enum: ['pending', 'fetched', 'unreachable', 'rejected'] }).notNull().default('pending'),
     rejectionReason: text('rejection_reason'),
     resultingDocumentHash: text('resulting_document_hash').references(() => sourceSnapshots.documentHash, { onDelete: 'set null' }),
     createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
     updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
   }, (table) => [
     uniqueIndex('discovery_candidates_market_ticker_url_unique').on(table.market, table.ticker, table.candidateUrl)
   ]);
   ```
   Deliberately named differently from the pre-existing `sourceDiscoveries`
   table (`db/schema.ts:175-181`), which is unrelated: that table's
   `documentHash` is `NOT NULL` and records where an *already-fetched*
   official document was found — it cannot represent a pre-fetch,
   possibly-never-resolved web-search candidate. `discoveryCandidates`
   deliberately has no snippet/title column: a type-level guarantee that
   search snippet text can never be persisted, not just a convention. This
   table exists in the schema for the deferred Class C work but is not
   populated by anything in this milestone.
3. Evidence rows for `secondary_issuer`/`secondary_news` persist through the
   existing `evidence` table unchanged in shape; `metadata` carries
   `{ publisherName }` / `{ publisherName, wireService }`.

---

## 5. Implementation Slices

### Slice 1 — Schema & Domain Contracts
- **Files**: `db/schema.ts`, `db/migrations/0007_add_discovery_candidates.sql`, `lib/domain/contracts.ts`, `tests/migrations.test.ts`
- Widen Zod schemas in `contracts.ts` and TS types in `schema.ts`.
- Add `discoveryCandidates` table and generate migration `0007`.
- Add a `migrations.test.ts` case confirming zero-DDL enum widening and round-tripping `discovery_candidates`.

### Slice 2 — Extractor & Candidate Layer
- **Files**: `lib/research/extractors/candidate.ts`, `tests/document-extraction.test.ts`
- Add `secondary_issuer`/`secondary_news` to `EvidenceVerificationStatus`.
- Add dedicated factories `createSecondaryIssuerCandidate()`/`createSecondaryNewsCandidate()`, each hardcoding its own `verificationStatus`.
- Add `extractSecondaryCandidates(document, assumption, ticker, sourceClass)` as a **dedicated** function (not a branch inside `extractDeterministicCandidates`) — its only return paths call the two new factories, so it has no code path capable of constructing `exact_verified`/`ocr_matched`. Rejected the branch-inside alternative because `extractDeterministicCandidates`'s existing branch already constructs evidence inline rather than via a factory; a third inline branch would weaken that invariant.
- Add a regression test proving secondary candidates can never mint `exact_verified`/`ocr_matched`, even under adversarial input.

### Slice 3 — Source Adapters (Class A & Class B only)
- **Files**: `lib/research/adapters/issuer-press.ts`, `lib/research/adapters/news-wire.ts`, `lib/research/adapters/factory.ts`, `lib/research/config.ts`
- `IssuerPressReleaseAdapter`: a **sibling** to `IssuerAdapter`, not a parameterization of it (rejected reusing `IssuerAdapter` directly — it hardcodes `sourceTier: 'official'` for its actual role as `idx.ts`'s official-filing fallback; extending it in place risks a future edit hardcoding the wrong tier on the wrong path). Parses allowlisted IR press-release pages via `cheerio`, setting `sourceTier: 'secondary'`.
- `NewsWireAdapter`: parses allowlisted RSS/Atom/JSON financial news feeds via `cheerio` (`xmlMode: true`, already a dependency — no new package) or `JSON.parse`, filtering items by tracked ticker and legal company name.
- New env `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS`; sibling factory `createSecondarySourceAdapters()`; mock adapters for `RESEARCH_SOURCE_MODE=mock`.

### Slice 4 — Pipeline & Service Integration (includes a pre-existing bug fix)
- **Files**: `lib/research/pipeline.ts`, `lib/research/service.ts`, `tests/research-service.test.ts`
- **Confirmed pre-existing bug fix**: in `pipeline.ts` (verification branch), an unconditional `else if (!candidate.metadata?.method || candidate.metadata.inputs === undefined) throw ...` is meant to validate only `'derived'` candidates but fires — and throws — for any non-official class. Every secondary candidate would silently vanish through the surrounding catch block. Narrow to `else if (verificationStatus === 'derived')`. This predates M007; it simply never had a fourth/fifth verification status to expose it.
- Add optional `documentTypes` and `evidenceClass: 'official' | 'secondary_issuer' | 'secondary_news'` parameters to `executeResearchJob()`, defaulting to today's behavior.
- In `service.ts`, call secondary pipeline execution in soft `try/catch` blocks so a secondary feed timeout or missing config never fails or degrades the parent `research_job`.

### Slice 5 — Assumption Confirmation Gate
- **Files**: `lib/research/assumption-status.ts` (new), `lib/research/service.ts`, `app/api/assumptions/[id]/accept-secondary-evidence/route.ts` (new)
- On secondary-evidence insert, set an `'untested'` assumption with no official evidence to `'pending_confirmation'`.
- Official evidence arrival, in the same transaction, reverts `'pending_confirmation'` to `'untested'`.
- New route `POST /api/assumptions/[id]/accept-secondary-evidence` transitions status to `'user_confirmed_secondary'` — a status distinct from `'verified'` by deliberate choice, so accepted-secondary assumptions never look officially verified.

### Slice 6 — UI & Visual Badging
- **Files**: `components/ResearchPanel.tsx`, `components/Workspace.module.css`, `components/Sidebar.tsx`, `db/queries.ts`
- Add `secondary_issuer` ("Secondary: Issuer PR") / `secondary_news` ("Secondary: News Wire") badges with **genuinely new colors** — `.verified_ocr_matched` already occupies the amber/brown family (`#78350f`/`#fde68a`, shared with `.status_degraded`), so DEC-0015's "amber for secondary" needs distinct hex values to avoid colliding with existing OCR/degraded badges.
- Add the first assumption-status badge (`.status_pending_confirmation` — today status is plain text with no CSS class) plus an "Accept secondary evidence" action in the Research drawer.
- Add `sourceTier` to `getUnreadAlerts()`'s projection; badge it in `Sidebar.tsx` alongside the existing format badge.

### Slice 7 — Evaluator Cases & Unit Tests
- **Files**: `docs/evals/M001/multimodal-cases.json`, `scripts/eval-m001-multimodal.ts`, `tests/multimodal-eval.test.ts`
- Widen the case schema/type to include the two new verification statuses.
- Add cases proving correct labeling and the never-`exact_verified` invariant for secondary documents, including at least one **assertive** (not merely descriptive) case that calls `extractSecondaryCandidates` directly.
- Add a test proving search-snippet text is never written anywhere.

### Slice 8 — Governance & Codebase Map
- **Files**: `docs/RISK_REGISTER.md`, `docs/CODEBASE_MAP.md`, `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`
- Update R-010/R-013 with **honest** residual-risk language once behavior is actually verified — not asserted at draft time (see §8 below).
- Update `CODEBASE_MAP.md` flows and invariants.

---

## 6. Security and Provider Constraints

1. **Safety scanning**: every secondary HTML/text document passes `scanEmbeddedInstructions` (`lib/research/extractors/safety.ts`) before candidate extraction — identical to the official/vision paths (R-018, unchanged from M006).
2. **Domain allowlisting**: only URLs listed in `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` are ever fetched, through the existing `OfficialHttpClient` (host allowlist, rate limiting, retry/backoff, size cap, redirect re-validation, outbound audit log) — no new unaudited fetch path.
3. **Data classification**: portfolio/position data, credentials, and restricted personal/financial secrets never reach any secondary-source adapter — same DEC-0009/DEC-0011 boundary as everywhere else.
4. Class C's deferral is itself a security-scope decision: no search-provider API key, no query containing tracked-position data, and no promotion workflow exist in this milestone at all.

---

## 7. Evals & Acceptance Criteria

### Acceptance Criteria

- **AC-M007-01 (Secondary Extraction & Provenance)**: Class A IR releases and Class B news-wire feeds extract text with `secondary_issuer`/`secondary_news` status and full URL/timestamp provenance.
- **AC-M007-02 (R-010 Structural Hardening)**: secondary candidates can never mint `exact_verified`/`ocr_matched`, enforced structurally by `extractSecondaryCandidates` and `candidate.ts`, proven by regression test.
- **AC-M007-03 (Confirmation Gate)**: assumptions backed only by secondary evidence enter `pending_confirmation`; official evidence reverts to `untested`; user acceptance transitions to `user_confirmed_secondary`, never `verified`.
- **AC-M007-04 (R-013 Snippet Exclusion)**: pre-fetch candidate URLs are stored in `discovery_candidates`, which has no column capable of storing snippet/description text; a test confirms nothing writes such text anywhere.
- **AC-M007-05 (UI Badging)**: secondary evidence displays distinct badges (not colliding with `ocr_matched`) in the Research drawer.
- **AC-M007-06 (Ingestion Resilience)**: a secondary-source failure (missing feed config, HTTP error) never changes `research_jobs.status` away from the official-source outcome.

### Deterministic Tests
Full existing suite continues to pass unchanged; new coverage per Slices 1-5 above, no relaxed assertions.

### Model Evals
Widened `docs/evals/M001/multimodal-cases.json`; at least one assertive (non-descriptive-only) case for the new extraction path.

---

## 8. Assumptions, Risks, and Explicit Deferrals

- **Assumption:** at least one tracked ticker has a configured IR
  press-release URL and/or news-wire feed to exercise Class A/B against; if
  none are configured for a given ticker, the milestone's behavior (no
  secondary evidence, no error) is itself the correct, tested outcome.
- **Risk — R-010** (secondary evidence mistaken for official fact):
  addressed structurally (distinct evidence classes, distinct badging,
  confirmation gate) but not eliminated — a user can still misread a
  correctly-badged secondary source as authoritative. §8's risk-register
  update must state this honestly, matching M006's precedent for R-018
  rather than declaring the risk closed.
- **Risk — R-013** (search snippets treated as evidence): addressed by
  Class C's deferral and `discovery_candidates`'s structural snippet
  exclusion, but Class C itself — the actual search-snippet-handling code —
  does not exist yet in this milestone, so R-013 cannot be marked fully
  mitigated until Class C ships and is evaluated live, the same way M006
  could not fully close R-018 with a regex-only scanner.
- **Deferral:** Class C (web search discovery), broader trust-tier UI work
  beyond the badges specified here, and any production/hosted use (per
  DEC-0014) are explicitly out of scope.

## Options Considered

1. **Parameterize the existing `IssuerAdapter` for press releases** instead
   of a sibling class. Rejected: `IssuerAdapter` hardcodes
   `sourceTier: 'official'` for its actual role as `idx.ts`'s official-filing
   fallback; extending it in place risks a future edit hardcoding the wrong
   tier on the wrong path. A sibling class keeps the tier-safety property
   obvious at the type level.
2. **Branch inside `extractDeterministicCandidates`** for secondary classes,
   mirroring its existing `sourceVariant === 'scanned'` gate, instead of a
   dedicated `extractSecondaryCandidates` function. Rejected: that function's
   ungated branch already constructs evidence inline rather than through a
   factory; adding a third inline branch would let one function's source
   construct all five verification statuses — a weaker invariant than a
   dedicated function whose only exits are dedicated factories.
3. **Reuse the existing `sourceDiscoveries` table** for pre-fetch candidate
   tracking. Rejected: it requires a `NOT NULL documentHash`, i.e. a
   document that's already been fetched and hashed — structurally
   incompatible with a pre-fetch, possibly-never-resolved candidate.
   `discoveryCandidates` is a distinct table for a distinct lifecycle.
4. **Ship Class C alongside A/B** in one milestone. Rejected per R-005 (small
   vertical milestones) — A/B already deliver full secondary-source
   functionality without a search-API dependency; Class C's cost (API keys,
   quota, a separate promotion workflow, new UI) is disproportionate to its
   narrow incremental value once A/B exist.
