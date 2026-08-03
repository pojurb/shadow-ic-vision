# M011: Evidence Polarity, Measurement Contracts, and Coverage

Status: `complete`

Date drafted: 2026-08-03

Date accepted: 2026-08-03

Date completed: 2026-08-03

Approval authority: user

Depends on: [`M007`](M007-secondary-source-ingestion.md) (the evidence classes polarity is attached to), [`M009`](M009-secondary-evidence-boilerplate-filtering.md) and [`M010`](M010-structural-evidence-precision.md) (evidence *vocabulary* and *shape*; this milestone adds *meaning*). One new decision record **is** required, unlike M009 and M010: [`DEC-0016`](../decisions/DEC-0016-evidence-polarity-classifier-boundary.md) governs the optional `PolarityClassifier` seam, which is a new provider call over document-derived text. Everything else in this milestone hardens behaviour inside scope [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md) and [`DEC-0009`](../decisions/DEC-0009-provider-security-gate.md) already govern.

Addresses:

- **R-027** (new) — *A retrieved fact contradicts the assumption it was retrieved for, but is presented neutrally* → `Mitigated`.
- **R-025** (`Open`) — semantic relevance of secondary evidence. Narrowed, **not** closed: polarity gives structured-fact evidence a direction, but text-derived evidence stays `inconclusive`, which is exactly R-025's unsolved territory.

---

## Slice Outcomes (2026-08-03)

Verified: `npm run typecheck`, `npm run lint`, `npm run build` clean. Full suite **354 passed / 3 skipped**, up from a confirmed 255 baseline measured at session start (not assumed from a stale count). `npm run test:e2e` **7/7**, up from 5 — the two new cases are the clarification hard block and the rendered verdict. `npm run eval:m001:multimodal` and `eval:m001:provider --mode deterministic`: `additionalCaseCount` 23 → **25**, **0 hard-gate failures** in both. `context:generate`/`context:check` and `status:check` pass.

- **AC-M011-01 (An ambiguous claim cannot start research):** met. `draftClarificationBlock` (`lib/domain/contracts.ts`) is one pure predicate shared by the client and the server; `ChatUI` disables "Confirm & Research" and `confirmDraft` refuses outright before any insert, because a disabled button is not a control. Proven by unit tests asserting all four tables stay empty on a refused confirmation, and by a Playwright case asserting the button is genuinely `toBeDisabled()`.
- **AC-M011-02 (A breach is reported as a breach):** met. `classifyPolarity` returns `contradicts` with a signed delta; `deriveThesisVerdict` renders `THESIS BREACHED — automotive gross margin is 16.9% versus the at least 20% this thesis requires (310bps below)`. Eval case `MM-025` hard-gates the classification.
- **AC-M011-03 (A balance is never offered for a flow claim):** met. `factSatisfiesTimeBasis` (`lib/research/adapters/sec-xbrl.ts`) refuses an instant fact for any duration claim, with `classifyPolarity`'s `time_basis_mismatch` as a second layer behind it. Eval case `MM-024` hard-gates it, and an end-to-end test confirms a `DeferredRevenueCurrent` tag pointed at a quarterly claim yields zero evidence and leaves `research_jobs.status` untouched.
- **AC-M011-04 (Absence of evidence is reported):** met. `deriveCoverageLedger` names every unevidenced assumption with a reason, and suppresses the confidence gate below `MIN_COVERAGE_RATIO` or on any unresolved contract.
- **AC-M011-05 (The verdict cannot be buried):** met structurally, in two of three layers. The verdict is a JSX node lexically outside `.panelContent`, and `generateDecisionRecommendation`'s output schema is *narrowed* so a breached thesis cannot return `'No Change'` — enforced by `safeParse` and propagated into the model's own grammar by `z.toJSONSchema`. The third layer (prepending the headline to a rationale that ignores the breach) is a mitigation and is labelled as one.

**A real crash the Playwright suite caught, not a fixture problem.** `polarityBadge` read `record.deltaVsThreshold.toFixed()` without checking the field was present. A route-mocked `/api/research` payload predating M011 omits it entirely, which white-screened the whole Research panel — `Cannot read properties of undefined`. Any older client cache or partial response would have done the same in production. Fixed by reading both `polarity` and the delta defensively. This is the second milestone running in which the browser layer, not vitest, caught the real regression.

**A pre-existing e2e fragility, fixed incidentally and flagged as out of scope.** `sidebar title updates from "New Thesis"` matched that link text globally, and the suite shares one SQLite file across tests, so four conversations still titled "New Thesis" accumulated and tripped Playwright strict mode. Confirmed pre-existing by re-running the suite with M011's new case excluded — it still failed. Fixed by scoping the assertion to the conversation under test via its own `href`.

**The eval cases were proven capable of failing, not assumed to be.** Following M010's lesson that a case absent from `deterministicNotes`' dispatch can never fail, both new cases were tampered with — `MM-025`'s expected outcome flipped to `supports`, `MM-024`'s time basis relaxed to `instant` — and the report was confirmed to emit `MM-024:balance_offered_for_flow_claim` and `MM-025:contradiction_reported_as_support` with both cases marked `unsupported`. The tamper was then reverted and the clean result re-verified.

**Design decision — polarity is computed at persistence, not in the pipeline.** `CitationPipeline`'s per-candidate loop swallows any throw (`pipeline.ts`'s `catch {}`), so a polarity bug there would present as *silently missing evidence* rather than a wrong verdict. `evidenceInsertValues` is the single choke point every evidence row passes through, and it is synchronous, so the optional classifier resolves *before* the transaction opens rather than holding a write lock across a network round trip.

**Live verification against real SEC data, and the limit that remains.** A read-only probe drove the real `SecCompanyConceptSource` → `selectFact` → `createXbrlFactCandidate` → `classifyPolarity` chain against `data.sec.gov`, writing nothing:

- `TSLA` / `GrossProfit` returned **282 facts, every one `duration`**; the most recent 10-Q quarter (2026-04-01→2026-06-30, $4.751B) was selected and classified `supports` against a $3B threshold.
- `TSLA` / `DeferredRevenueCurrent` returned **58 facts, every one `instant`**, and a `duration_quarter` claim pointed at it selected **nothing**. The deferred-revenue conflation is therefore refused against genuinely filed data, not merely against a fixture built to demonstrate it.
- Restated as an `instant` claim, the same tag was accepted — and revealed something no fixture would have: its newest fact ends **2018-03-31**, because Tesla migrated off that tag at ASC 606 adoption. Real tag drift over time is a live-only finding, and it argues for contracts naming several candidate tags.
- A USD fact against a `percent` claim came back `inconclusive`/`no_observed_value`; an unreported tag came back `not_found`, softly.
- `logs/outbound.log` recorded every request per ADR-0006, and `company_tickers_exchange.json` was fetched **once** across four concept lookups — confirming the shared-`OfficialHttpClient` cache rather than assuming it.

**What is still unproven:** no evidence row has been *persisted* from a live XBRL response. The live database holds only an ID-market thesis, and creating a US one would mean writing to real user data. The retrieval and classification path is live-verified; the persistence path is proven by tests only.

---

## 0. Why This Exists

A multi-model QA audit of a Tesla thesis — *"automotive gross margin will remain above 20% through 2026"* — found three defects that no amount of prompt tuning would fix.

1. **The system retrieved the right evidence and buried it.** Automotive gross margin of **16.9%** was retrieved: the thesis is breached by 310bps at its own starting line. It appeared as the fourth of five neutral bullets. Energy-storage margin contracting 30.3% → 20.4% — which falsifies an assumption outright — was presented as context. Evidence was matched on topical relevance with no notion of *direction*, so disconfirming facts read exactly like supporting ones.

2. **The claim was never made measurable.** "Automotive gross margin" has at least four defensible definitions (GAAP, ex-credits, ex-credits-ex-leasing, blended) and "through 2026" has three time bases. A claim that resolves differently under each is **not falsifiable**, which means the app's central promise fails at claim #0. The same gap produced a subtler error: FSD *deferred revenue* ($4.05B — a balance-sheet stock) was surfaced as support for an assumption about *recognized revenue* growth (an income-statement flow).

3. **Absence of evidence was silently converted into absence of concern.** Ten assumptions, five evidence items, four assumptions with **zero** evidence, and no report of the gap anywhere.

The through-line: the system could retrieve, but it could not *judge*, and it presented an unjudged ledger as if judgement had happened. M009 fixed evidence **vocabulary**; M010 fixed evidence **shape**; M011 adds **meaning** — what the number is, and which way it points.

## 1. User-Visible Outcome

A user states a thesis. If a claim cannot be measured as stated, the draft card shows one clarifying question and **Confirm & Research stays disabled** until it is answered. Once research runs, the Research panel opens with a thesis status block above everything else — `THESIS BREACHED`, `AT RISK`, `HOLDING`, or `INSUFFICIENT EVIDENCE` — and, beneath it, a coverage ledger naming every assumption that has no evidence and why. Individual evidence rows carry a direction badge (`Contradicts (−3.1 vs threshold)`) alongside their existing trust-class badge. When coverage is too thin, the AI recommendation cannot be requested at all, and cannot return a position action if it is.

## 2. Scope and Non-Goals

### In Scope

- A measurement contract per assumption: metric, definition variant, operator, threshold, unit, time basis, candidate XBRL tags, and an explicit resolution state.
- A hard block on confirming a draft whose contract is unresolved.
- Evidence polarity (`supports` / `contradicts` / `inconclusive`) with a signed delta and the method that produced it, as real columns.
- Structured XBRL fact retrieval from SEC company-concept, US market only, with a mechanical instant-versus-duration gate.
- A deterministic thesis verdict and coverage ledger, computed server-side and rendered outside the scrollable content region.
- Output-schema narrowing on the AI recommendation under a breach or a suppressed confidence gate.

### Out of Scope

- **Auto-transitioning `assumptions.status`.** `deriveAssumptionStatus`'s documented invariant — nothing in this app auto-marks an assumption — is deliberately preserved. A contradiction surfaces via the evidence row, the verdict, and the ledger only. Consequence, stated rather than discovered: the Top-10 Queue does **not** react to a breach, because `hasChallengedAssumptions` reads `assumptions.status`. Recorded as a deferral, not an oversight.
- **Enabling the polarity classifier.** The seam ships unexercised under DEC-0016.
- **A non-US structured fact source.** IDX publishes no company-concept equivalent; the ID path fails closed to a named gap.
- **Two-tag ratio computation.** `calculateGrossMarginFromFacts` exists but is not wired to the retrieval path; a contract naming two tags retrieves them independently today.
- **Re-deriving polarity for existing evidence.** The `0009` defaults are semantically correct for pre-M011 rows (`inconclusive` / `no_contract`), so no sweep is needed.

## 3. Workflows, States, and Recovery Behavior

### Workflow: intake with an unresolved claim

The model always drafts — the anti-withholding property from 2026-07-30 is preserved and pinned by a test — but declares ambiguity *inside* the measurement block. `draftClarificationBlock` blocks confirmation; the user answers in the next chat turn; extraction re-runs naturally, because a blocked draft never creates a thesis and so never trips the "skip extraction once a thesis exists" gate. That gate needed no change, and adding a branch to it would have been dead code by construction.

### Workflow: structured fact retrieval

`runXbrlFactCall` sits alongside `runSecondaryResearchCall` and `runDiscoveryAndPromotion`, before the official try/catch, with the identical soft-failure boundary: a missing source, an unreported tag, a 404, or a thrown error never touches `research_jobs.status`. A market with no source and a contract with no tags both return immediately.

### Workflow: judgement

Deterministic first, always. `classifyPolarity` refuses in six named ways — no contract, not measurable, no observed value, unit mismatch, time-basis mismatch, no comparison stated — and each refusal is a distinct `polarity_method`, because a ledger that cannot distinguish "we have no contract" from "the fact was for the wrong period" cannot tell the user what to fix.

## 4. Data Inputs, Outputs, and Persistence

- **`assumption_measurements`** (new, migration `0008`): 1:1 with `assumptions` via `assumption_id` as primary key, cascade-deleted. Row presence *is* the state machine. The migration hand-appends an idempotent backfill giving every pre-M011 assumption a `legacy_unspecified` row.
- **`evidence.polarity` / `delta_vs_threshold` / `polarity_method`** (migration `0009`): three `ALTER TABLE ADD` statements with constant defaults, so every existing row is valid with zero backfill and the defaults are semantically true rather than placeholder.
- **Export/import**: `measurement` on the assumption and the three polarity fields on evidence, all `.optional()`/`.default()` — every export file written before M011 still imports. Polarity is carried through on import rather than recomputed, because re-deriving it against a contract that may have been re-drafted since would silently rewrite history.

**Backward-compatibility consequence, accepted deliberately:** every pre-M011 thesis now reports `confidenceGate: 'suppressed'` and `verdict.level: 'insufficient_evidence'`. That is *true* — those theses have no contract against which any claim could be checked. The backfill exists so the UI can say the accurate thing ("created before measurement contracts; re-confirm to record one") rather than the ambiguous thing.

## 5. Implementation Slices

- **Slice 1 — Measurement contract.** Zod schemas with a `.superRefine` covering every way a claim could look measured while remaining unfalsifiable; the `assumption_measurements` table and migration `0008`; `confirmDraft` and `importThesisData` persistence; mock fixtures.
- **Slice 2 — Clarification hard block.** Prompt amended (not reversed) so ambiguity routes into the measurement block; `confirmDraft` refusal; disabled-but-present button; a third mock fixture keyed on `simulate ambiguous measurement`, following the existing in-band convention.
- **Slice 3 — Evidence polarity.** `lib/research/polarity.ts`; three evidence columns and migration `0009`; the required `contract` argument on `evidenceInsertValues`, which forced a compile error at all three call sites; the eight DTO/export sync sites; the polarity badge; the `PolarityClassifier` seam and its source-mode gate.
- **Slice 4 — SEC XBRL.** `resolveSecCik` lifted out of `SecAdapter` (proven behaviour-neutral by `tests/source-adapters.test.ts` passing unmodified); `SecCompanyConceptSource`; `contextKindOf`/`factSatisfiesTimeBasis`/`selectFact`; `createXbrlFactCandidate`; the factory and `runXbrlFactCall`; the deterministic mock source.
- **Slice 5 — Coverage and verdict.** `coverage.ts` and `verdict.ts`; `getResearchPanel` gains both plus a stable `ORDER BY` it never had; schema narrowing in `generateDecisionRecommendation`; the render placement outside `.panelContent`.
- **Slice 6 — Evals and governance close-out.** `MM-024`/`MM-025` with real dispatch arms; DEC-0016; R-027; ROADMAP, `ACTIVE_MILESTONE.md`, `docs/CODEBASE_MAP.md`, `SESSION_CHECKPOINT.md`, `context:generate`.

## 6. Security and Provider Constraints

- **No new allowlisted domain.** `data.sec.gov` was already in the SEC client's `allowedHosts`, so DEC-0015 §3.2's domain gate is untouched.
- **One new provider call site**, off by default and gated on live research mode — governed by DEC-0016, which exists specifically because the analogous 2026-07-29 change shipped without one and was reverted.
- **R-018's boundary is unchanged.** `scanEmbeddedInstructions` still runs on evidence quotes at the `generateDecisionRecommendation` prompt edge. The verdict and coverage lines prepended to that prompt are app-generated arithmetic, not document text, and are deliberately not scanned.
- **No new data class.** The classifier would send an assumption statement and one evidence quote under `poc_workflow_confidential`, the class DEC-0009 already permits.

## 7. Evals & Acceptance Criteria

### Acceptance Criteria

1. **AC-M011-01: An ambiguous claim cannot start research.** A draft whose measurement contract is unresolved cannot be confirmed, from the UI or by a direct POST, and the refusal carries the clarifying question.
2. **AC-M011-02: A breach is reported as a breach.** A retrieved fact that fails its claim's threshold is persisted as `contradicts` with a signed delta and surfaced in the thesis verdict.
3. **AC-M011-03: A balance is never offered for a flow claim.** An instant XBRL fact is refused for any duration claim, at retrieval and again at judgement.
4. **AC-M011-04: Absence of evidence is reported.** Every unevidenced assumption is named with a reason, and thin coverage suppresses the confidence gate.
5. **AC-M011-05: The verdict cannot be buried.** It is not model output, it renders outside the scrollable content region, and a breached thesis cannot produce a `'No Change'` recommendation.

### Pass Thresholds

Same bar as prior milestones: 0 hard-gate failures, `additionalCaseCount` moving 23 → 25 with both new cases *demonstrably* capable of failing, and the full existing suite green including Playwright.

### Deterministic Tests

`tests/measurement-contract.test.ts` (every `superRefine` branch, the legacy sentinel, and a pin on the Zod 4 behaviour the `.default()` design rests on), `tests/polarity.test.ts` (every classification and every refusal, including the anti-regex-scrape guard and the classifier gate), `tests/xbrl-facts.test.ts` (the instant/duration gate, day bands, fact selection, unit conversion), `tests/coverage-verdict.test.ts` (every ledger count, every suppression reason, every verdict level), plus end-to-end coverage in `tests/research-service.test.ts` and `tests/decisions.test.ts`, and two new Playwright cases.

## 8. Assumptions, Risks, and Explicit Deferrals

- **Assumption:** the extraction model can produce plausible `us-gaap` tag names. Unvalidated against a live run; if it cannot, XBRL retrieval simply yields nothing and the ledger reports a named gap rather than a wrong answer.
- **Assumption:** `MIN_COVERAGE_RATIO = 0.7` is a defensible line. It is a product judgment, stated as one, with no data behind that value specifically.
- **Risk — polarity coverage is narrower than it looks.** Only structured-fact evidence can produce a non-`inconclusive` polarity, and structured facts are US-only. The app's live tracked ticker is Indonesian, so in practice today it gets none. Recorded in R-027's residual risk.
- **Risk — suppression does not constrain prose.** The narrowed schema controls the structured decision; a model can still write reassuring `rationale` text beneath a breach.
- **Deferral:** auto-transitioning `assumptions.status` on a contradiction, and therefore surfacing breaches in the Top-10 Queue.
- **Deferral:** two-tag ratio computation, a non-US structured source, and enabling the classifier.

## Options Considered

1. **A separate `assumption_measurements` table (adopted)** over nullable columns on `assumptions` or a JSON column. Eight nullable columns would represent "unresolved" in 2^8 indistinguishable ways; a JSON blob that fails to parse degrades silently to "no contract", which degrades to "no breach detected" — the exact failure class this milestone exists to fix, failing in the direction of reassurance.
2. **Polarity computed in `evidenceInsertValues` (adopted)** over the candidate extractors or `CitationPipeline`. The extractors have no access to a DB-derived contract; the pipeline swallows throws, so a bug there would delete evidence rather than misjudge it.
3. **Real columns for polarity (adopted)** over riding `evidence.metadata` as R-018's flag does. That flag failing to parse costs a visible warning banner; polarity failing to parse costs "no contradiction found", silently.
4. **Refusing to parse numbers out of quote text (adopted)** over scraping the quote when no structured value exists. `numbers()` matches any digit run with no idea what it denotes; letting it drive a breach verdict is how a figure from a different line item gets compared against an unrelated threshold. Text-only evidence is honestly `inconclusive` instead — accepting narrower coverage as the price of not being wrong.
5. **Amending the anti-withholding prompt sentence (adopted)** over reversing it. That sentence exists because the model once withheld drafts entirely; ambiguity belongs inside the measurement block, and only *confirmation* is blocked.
6. **Leaving the re-extraction gate untouched (adopted)** over adding a `hasPendingClarification` branch. A blocked draft never creates a thesis, so the next turn re-extracts anyway — the branch would have been unreachable, and dead code in a gate is worse than none.
7. **XBRL as a fact source, not a `SourceAdapter` (adopted).** `SourceAdapter` produces bytes that become text a quote is verified against; a keyed numeric fact series has no prose to quote. It becomes `derived` evidence, inheriting the correct trust ceiling for free.
8. **Shipping the classifier seam under DEC-0016 (adopted)** over shipping it undocumented or dropping it. "Inert today" is a property of the current call sites, not of the code — and that exact argument was available on 2026-07-29, when it did not survive review.
