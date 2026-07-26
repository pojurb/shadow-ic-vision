# M009: Secondary Evidence Boilerplate Filtering

Status: `complete`

Date drafted: 2026-07-26

Date accepted: 2026-07-26

Date completed: 2026-07-26

Approval authority: user

Depends on: M007 ([`M007-secondary-source-ingestion.md`](M007-secondary-source-ingestion.md))
and M008 ([`M008-web-search-discovery.md`](M008-web-search-discovery.md)), both
`complete`. No new decision record is needed — this milestone changes no
product boundary, evidence class, or trust tier; it hardens extraction
quality inside the scope [`DEC-0015`](../decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
already governs.

Addresses: R-025 (site-wide web boilerplate persisted as secondary evidence) —
`Mitigated`. Three layered mechanisms implemented and tested; see "Slice
Outcomes" for what is and isn't proven.

---

## Slice Outcomes (2026-07-26)

All four slices implemented and verified: `typecheck`/`lint`/`test`/`build`
clean; full test suite grew 199 → 206 (7 new adversarial cases, all in
`tests/document-extraction.test.ts`); `npm run eval:m001:multimodal` and
`npm run eval:m001:provider` (deterministic mode) both show unchanged
`additionalCaseCount: 23` and 0 hard-gate failures, confirming official-filing
recall is unregressed; `npm run status:check`/`context:check` pass.
`npm run test:e2e` (Playwright) 4/4 pass, after restarting the stale dev
server on port 3000 (a pre-existing Turbopack compiler-worker crash left over
from the prior session, unrelated to this milestone — M009 touches no UI
code).

- **AC-M009-01 (Known boilerplate is excluded):** met. The three real TLKM
  examples from the 2026-07-26 run no longer produce evidence candidates:
  the cookie/privacy-policy sentence and a repeated nav-skip paragraph are
  caught by the new phrase denylist in `rankSentenceCandidates`
  (`lib/research/extractors/candidate.ts`); the genuine-but-unrelated
  CSR/coral-reef article — which no phrase denylist or DOM rule can reach,
  since it isn't boilerplate at all — is caught by the new
  `sourceTier`-gated qualifying-token rule (Slice 3), the mechanism sharpened
  by two independent reviews before implementation. Proven by 5 new
  adversarial tests reproducing all three failures directly.
- **AC-M009-02 (Official-filing recall is unregressed):** met, and proven
  more concretely than the original packet's regression guard could have —
  no existing fixture, for either tier, contained realistic HTML page chrome
  before this milestone (confirmed by direct inspection during planning), so
  a new official-tier HTML-chrome fixture (Slice 1) was added specifically to
  close that gap, proving `extractDeterministicCandidates` returns an
  identical candidate whether or not the source page has full chrome. The
  `sourceTier`-gated qualifying-token rule (Slice 3) never fires for the
  official path (`extractDeterministicCandidates` always calls with
  `sourceTier: 'official'`), so its filter/sort/output is byte-for-byte
  unchanged for every existing fixture. The full M001 multimodal/provider
  eval suites also show unchanged case counts and 0 hard-gate failures.
- **AC-M009-03 (Structural trust-class gate still holds):** met, unregressed.
  No change to which function can produce `exact_verified`/`ocr_matched`;
  the existing R-010 adversarial tests pass unmodified.
- **AC-M009-04 (Governance closed honestly):** met. R-025 → `Mitigated` in
  `docs/RISK_REGISTER.md`, with residual-risk language stating plainly what
  is and isn't guaranteed — see the design-decision note below.

**Design decision — company-name tokens excluded from Slice 3's scope.** The
packet's §2 named "ticker/company-name/year tokens" as candidate exclusions
for the qualifying-token rule. Direct inspection of the call chain
(`lib/research/pipeline.ts` → `extractSecondaryCandidates` →
`rankSentenceCandidates`) confirmed no company-display-name field exists
anywhere in it today — only `ticker` and `assumption` text do. Threading one
through would have added a new input beyond this milestone's own §4 scope
("pure extraction-quality change... no new inputs"). Per explicit user
decision during planning: implement ticker + bare-year exclusion only, and
record the company-name gap as honest residual risk in R-025's close-out
rather than silently widening scope or silently covering it.

**Recorded follow-ups closed:** R-025 → `Mitigated` (`docs/RISK_REGISTER.md`).
`docs/CODEBASE_MAP.md`'s Critical Invariants and Task Routing sections
updated to name `rankSentenceCandidates` for the first time and route future
secondary-evidence work to the new mechanisms.

---

## 0. Why This Exists

M008 was exercised live end-to-end for the first time on 2026-07-26 (real
TLKM thesis, conversation `f5f230f6-23ea-4e86-a73a-cb55b04630c3`). The
discovery → domain-gate → promotion mechanism worked exactly as designed: 10
Tavily candidates, 8 correctly rejected as `domain_not_allowlisted`
(including `idx.id`'s own static-data URL and `telkomsel.com`, a TLKM
subsidiary on a different domain), 2 fetched and promoted.

But inspecting the 15 `secondary_issuer` evidence rows the run actually
persisted surfaced a problem no prior milestone's testing caught, because
none of M001–M006 ever fed raw web HTML through this path: several quotes
are site-wide boilerplate, not substantive text about the assumption they're
attached to —

- An assumption about competitive data-center pricing was backed by
  telkom.co.id's **cookie/privacy policy** text.
- An assumption about macro/IT-budget conditions was backed by an unrelated
  **CSR coral-reef-restoration** press release.
- The identical nav-menu paragraph was persisted, verbatim, as "evidence"
  for three different, unrelated assumptions.

Root cause, confirmed by reading the code directly (independently
cross-checked by a second AI collaborator working in the same workspace,
who reached the same diagnosis from the same two files):

- `rankSentenceCandidates` (`lib/research/extractors/candidate.ts:84-108`)
  scores every sentence as `tokenMatches*3 + numberMatches*5 +
  (hasNumericFact ? 2 : 0)` and keeps anything with `tokenMatches >= 2 &&
  score >= 8 && quote.length >= 20`. `STOP_WORDS` is 35 words; ticker names,
  years, and generic business vocabulary (`data`, `center`, `enterprise`)
  all count as significant tokens. Two of those plus any digit in the
  sentence (a copyright year, a phone number, a date) clears the bar.
- `extractHtml` (`lib/research/extractors/document.ts:81`) strips only
  `script, style, noscript, template, svg`. `nav`, `header`, `footer`,
  `aside`, and cookie/legal-notice containers are **not** stripped and flow
  straight into `canonicalText`.
- This threshold was reasonable for its original context: M001–M006 sourced
  exclusively from official SEC/IDX filings, which are dense, boilerplate-free
  financial text where a low threshold prevents dropping genuinely short,
  valid metrics. M007/M008 reused the same function unchanged when they
  opened raw web HTML (issuer press-release pages, Tavily-discovered pages)
  into the identical extraction path — the mismatch between the threshold's
  original assumptions and its new input is the defect.

R-010's structural gate is not compromised — nothing was mislabeled
`exact_verified`/`ocr_matched`, every row here correctly reads
`secondary_issuer`. This is a **precision** problem, not a **classification**
problem: the evidence is honestly tiered as secondary and unverified, but a
user reading "Accept secondary evidence" on a `pending_confirmation`
assumption has no way to tell, without opening the quote, that it's cookie
policy text.

---

## 1. User-Visible Outcome

Today: any web-sourced page (Class A issuer press releases, Class C
Tavily-promoted pages) can produce evidence rows whose quotes are nav menus,
footers, or unrelated boilerplate — visually indistinguishable in the
Research drawer from a genuine excerpt, and capable of moving an assumption
into `pending_confirmation`.

After this milestone: known boilerplate classes (structural nav/header/
footer/aside DOM, common cookie/legal/copyright phrasing) are excluded
before a candidate is scored, for both the primary (M001–M006) and secondary
(M007/M008) extraction paths. Dense official-filing text is unaffected —
that fixture set is the regression guard this milestone must not break.

---

## 2. Scope and Non-Goals

### In Scope
- **DOM-level boilerplate stripping** in `extractHtml` for structural
  elements (`nav`, `header`, `footer`, `aside`) and common cookie-banner/
  legal-notice containers, ahead of `canonicalText` construction.
- **Phrase-level rejection** in `rankSentenceCandidates`: a small,
  explicit denylist of boilerplate phrasing ("all rights reserved", "cookie
  policy", "privacy policy", "terms of use", "skip to content", and
  Indonesian equivalents already partially present as stop words) that
  disqualifies a candidate regardless of score.
- **Re-evaluating the shared threshold** for web-derived secondary
  candidates specifically (`sourceTier === 'secondary'`) — either a higher
  minimum token-match count, a match-ratio-relative-to-assumption-length
  requirement, or excluding ticker/company-name/year tokens from counting
  toward the minimum on their own. Official-path (`sourceTier === 'official'`)
  behavior on PDF/SEC/IDX fixtures must not regress.
- Regression fixtures: at minimum, the real TLKM boilerplate text found in
  this run (cookie policy, CSR press release, repeated nav paragraph),
  encoded as adversarial test cases so a future change can't silently
  reopen this gap.

### Out of Scope
- Re-scoring or retracting the 15 evidence rows already persisted from the
  2026-07-26 TLKM run — this milestone fixes the extractor going forward; a
  data-cleanup pass is a separate, explicit decision if wanted.
- Improving `discoverIssuerPressReleases`'s 20-result-cap crowding (the
  already-tracked, distinct **yield** caveat in R-013) — this milestone is
  about the relevance of what *does* get fetched, not about fetching more of
  the right pages.
- Any change to the domain gate, promotion mechanism, or trust-class
  structure (R-010/R-013) — those are confirmed working correctly and are
  not touched here.
- A general-purpose readability/boilerplate-removal library dependency
  (e.g. Mozilla Readability). A todo for consideration in §8, not adopted
  here — keeps this milestone dependency-free like the rest of `lib/research`.

---

## 3. Workflows, States, and Recovery Behavior

### Workflow: HTML Extraction → Candidate Ranking

1. `extractHtml` loads the page, strips non-content elements (expanded set),
   and builds `canonicalText` as today.
2. `rankSentenceCandidates` scores each sentence per-page as today, but a
   sentence matching the boilerplate-phrase denylist is excluded before
   scoring, not merely scored low.
3. For `sourceTier === 'secondary'` candidates, the pass threshold is
   re-tuned per §2; `sourceTier === 'official'` keeps today's threshold
   unchanged.
4. *Recovery:* a page that is *entirely* boilerplate (e.g., a listing page
   with no article body) now correctly yields zero candidates rather than
   nav-menu candidates — this must surface as the existing "no evidence
   found" / degraded state, not a new error class.

No change to `research_jobs` state machine, evidence classes, or the
assumption confirmation gate (`lib/research/assumption-status.ts`) — this
milestone only changes which candidates are *offered* to that machinery.

---

## 4. Data Inputs, Outputs, and Persistence Rules

No schema change expected. No new evidence class, no new `EvidenceCandidate`
branch, no migration. This is a pure extraction-quality change inside
`lib/research/extractors/document.ts` and `lib/research/extractors/candidate.ts`.

---

## 5. Implementation Slices

- **Slice 1 — DOM boilerplate stripping.** Expand `extractHtml`'s removal
  selector to include `nav, header, footer, aside` and common cookie-banner/
  legal-notice class/id patterns. Verify against existing SEC/IDX HTML
  fixtures that no genuine content is lost (official filings rarely carry
  these elements, but the assertion should be explicit, not assumed).
- **Slice 2 — Phrase-level denylist in `rankSentenceCandidates`.** Add a
  boilerplate-phrase check (English + Indonesian) that disqualifies a
  candidate outright, independent of its token score. Cover with the real
  TLKM examples found in this run (cookie/privacy text, the CSR
  coral-reef release, the repeated nav paragraph) as adversarial fixtures.
- **Slice 3 — Secondary-path threshold re-tuning.** Adjust the pass bar for
  `sourceTier === 'secondary'` candidates (design choice deferred to
  implementation — ratio-based vs. raised minimum vs. token-class exclusion,
  whichever the Slice 2 fixtures show is necessary without over-filtering).
  Prove the *official* path's existing behavior is byte-for-byte unchanged
  on the current fixture set.
- **Slice 4 — Governance close-out.** Re-run the full deterministic and live
  M001 evals to confirm no regression to official-filing extraction; update
  `docs/RISK_REGISTER.md` (R-025 → `Mitigated` with honest residual-risk
  language — a phrase denylist and DOM-element list cannot guarantee full
  semantic relevance, only remove known boilerplate classes); update
  `ACTIVE_MILESTONE.md`, `docs/milestones/ROADMAP.md`,
  `docs/CODEBASE_MAP.md`.

---

## 6. Security and Provider Constraints

None. This milestone is pure local extraction logic — no new provider call,
no new fetch path, no change to the DEC-0009 gate or DEC-0015 domain gate.

---

## 7. Evals & Acceptance Criteria

### Acceptance Criteria

1. **AC-M009-01: Known boilerplate is excluded.** The three real TLKM
   examples from the 2026-07-26 run (cookie policy, CSR press release,
   repeated nav paragraph) no longer produce evidence candidates when run
   through the extractor as regression fixtures.
2. **AC-M009-02: Official-filing recall is unregressed.** Every existing
   `exact_verified`-producing fixture and eval case (M001–M006) still
   produces the same candidates it does today — proven by the full existing
   test/eval suite passing unchanged, not just by inspection.
3. **AC-M009-03: Structural trust-class gate still holds.** No change to
   which function can produce `exact_verified`/`ocr_matched` — the existing
   R-010 adversarial test continues to pass unmodified.
4. **AC-M009-04: Governance closed honestly.** R-025 moves to `Mitigated`
   with residual-risk language that states what is and isn't guaranteed
   (known boilerplate classes removed; no general semantic-relevance
   guarantee).

### Pass Thresholds

Same bar as prior milestones: 0% citation hallucination on
`exact_verified`-class claims, 0 hard-gate failures, full existing suite
green.

### Deterministic Tests

Full existing suite continues to pass unchanged for the official path; new
adversarial cases added for the secondary/web path per Slice 2.

---

## 8. Assumptions, Risks, and Explicit Deferrals

- **Assumption:** the fix can be scoped as denylist/DOM-stripping rules
  rather than a full readability/boilerplate-detection library. If Slice 2's
  real fixtures prove a hand-rolled denylist is too narrow (misses
  boilerplate shapes beyond the three found so far), adopting a small
  dependency (e.g. Mozilla Readability, already a common `cheerio`-adjacent
  choice) should be raised at acceptance review, not silently substituted
  mid-slice.
- **Risk — false negatives remain possible.** A denylist only catches known
  patterns. Boilerplate phrased differently, or non-English boilerplate
  outside the current phrase list, can still pass. R-025's residual-risk
  language must say so plainly, matching this project's convention (see
  R-018's honest residual-risk language for the injection scanner).
  Repeated-across-pages detection (candidate text that recurs identically
  across multiple fetched pages of the same domain snapshot) was suggested
  as a possible Layer 2 addition but depends on whether the pipeline
  actually fetches and compares multiple pages per domain per run — to be
  confirmed in Slice 2 before committing to it, not assumed.
- **Risk — over-filtering.** Raising the secondary-path threshold too far
  could drop genuine short, valid secondary evidence (a real one-sentence
  press-release fact). Slice 3 must show both the false-positive fixtures
  now failing *and* representative genuine secondary-evidence fixtures
  (from M007's existing test suite) still passing.
- **Deferral:** cleanup of the 15 already-persisted low-quality evidence
  rows from the 2026-07-26 TLKM run; `discoverIssuerPressReleases`'s
  20-result-cap crowding (tracked separately, R-013); a general readability
  library dependency (only if the denylist proves insufficient).

## Options Considered

1. **Raise `tokenMatches`/`score` thresholds globally.** Rejected as the
   primary fix: risks dropping legitimate concise financial statements in
   official filings, which the current low threshold was deliberately tuned
   to admit. A secondary-path-specific adjustment (Slice 3) is preferred
   over a global change.
2. **Do nothing; rely on the existing badge/tier distinction.** Rejected:
   the badge correctly says "secondary, unverified," but that's a claim
   about *provenance*, not *relevance* — it does not help a user notice a
   quote is cookie-policy text, and "Accept secondary evidence" offers no
   friction against accepting it.
3. **Adopt a general-purpose readability library immediately.** Viable, but
   adds a new dependency to `lib/research` (which is currently
   dependency-light — only `cheerio` and `pdfjs-dist`) before confirming a
   hand-rolled fix is insufficient. Deferred per §8 rather than adopted
   up front.
