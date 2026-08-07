# DEC-0018 - Conditions For The Verdict's Positive State

Status: `accepted`

Date proposed: 2026-08-06

Date accepted: 2026-08-06

Approving authority: user

Supersedes: none

Amends: none. Narrows a claim `M011` shipped; adds no capability, provider, or
data class.

## Context

`deriveThesisVerdict` (`lib/research/verdict.ts`, M011) reached its positive
state, `holding`, whenever there was no contradiction and the confidence gate
was open. Neither condition requires that anything is actually supported.

On the real TLKM thesis (`168cd37c-a6ce-473e-9b2a-943f253c0ef6`), verified
directly against the live database on 2026-08-06, that produced a positive
verdict from a thesis where **all 42 evidence rows are `inconclusive`** — none
`supports`, none `contradicts` — and `coverage.supported` is `0`. The reason no
contradiction existed was not that the thesis was intact: it was that no
evidence carried an observed value, so nothing *could* be classified in either
direction. The system reported confidence derived from its own inability to
measure.

Three prior corrections this session narrowed the verdict *wording* toward
honesty (`d6cf84e`, `efe2e4c`, `747396f`), each time leaving the level itself
untouched at the user's explicit direction. This record closes the remaining
gap: the level, not only its sentence.

The failure shape is the one `VISION.md` §7 names directly — *"Missing a
relevant source, change, or risk is a possible product failure that must be
visible and reviewable, not hidden behind confidence language."* A verdict
reading `HOLDING` over nothing measurable is confidence language hiding a
coverage failure.

An option to delete the positive state entirely was considered and rejected on
independent review: "evidence supports a measurable claim", "no contradiction
found", and "not enough evidence" are three different states, and collapsing
the first into the third loses a distinction the product needs when structured
facts genuinely do support an assumption.

## Decision Requested

Approve that the verdict's positive state requires at least one **supported**
assumption, and that absence of contradiction alone is not evidence of support.

## Approved Scope If Accepted

1. **`holding` requires `coverage.supported > 0`.** The level derivation adds
   that condition alongside the existing suppressed-gate check:

   ```
   contradictions > 0                          → breached
   softContradictionCount > 0                  → at_risk
   gate === 'suppressed' OR supported === 0    → insufficient_evidence
   otherwise                                   → holding
   ```

   `coverage.supported` counts assumptions with at least one supporting
   evidence row and no contradicting one (`deriveCoverageLedger`). It was
   computed but read by nothing until `d6cf84e`.

2. **The positive state is retained, not removed.** It remains reachable, and
   should be, for a thesis whose structured facts actually clear their
   thresholds — the M011 PLTR path, where an XBRL fact yields
   `polarity: 'supports'`.

3. **`insufficient_evidence` gains a reason it did not previously have.** This
   record opens a route to that level where the confidence gate is **open** and
   `suppressionReasons` is therefore empty — coverage can be complete while
   nothing is supported. `buildHeadline` composed that branch's sentence purely
   from those reasons, so without a new clause it would have emitted the
   malformed `"INSUFFICIENT EVIDENCE — . No conclusion..."`. The clause states
   that no assumption is supported, and, when applicable, how many carry quotes
   verified verbatim but never checked for relevance to the claim.

4. **Wording may not swing to the opposite overclaim.** The pipeline cannot
   distinguish an off-topic passage from an on-topic one with no extractable
   figure, so verdict copy must not assert irrelevance. The existing regression
   assertion forbidding `/irrelevant|unrelated|off-topic/` in verdict copy
   (`tests/coverage-verdict.test.ts`) continues to apply.

5. **Direct consequence, recorded rather than discovered later:** the live TLKM
   thesis moves from `HOLDING` to `INSUFFICIENT_EVIDENCE`. That is the intended
   outcome, not a regression. Its verdict now reads:

   > INSUFFICIENT EVIDENCE — no assumption is supported by evidence; 6 have
   > quotes verified verbatim from their source but never checked for relevance
   > to the claim. No conclusion about this thesis is supported yet.

6. **Not authorized here:** any change to what *counts* as support. Whether a
   relevance-assessed passage may ever yield `supports` without a structured
   fact belongs to the relevance milestone and `DEC-0016`'s boundary, not to
   this record.

## Risk Register Effects

- **R-025** (`Open`, unchanged): this record does not close or narrow it. It
  stops the verdict *reporting* confidence over relevance-unassessed material;
  it does nothing about the relevance defect itself.
- **R-027** (`Mitigated`, unchanged): M011's mitigation stands. This tightens
  one of its stated residual risks — that polarity is only ever non-
  `inconclusive` for structured-fact evidence, which meant a text-only thesis
  could reach the positive state without any direction ever being determined.

## Eval And Verification Path

- `tests/coverage-verdict.test.ts`: the all-inconclusive case now asserts
  `level === 'insufficient_evidence'` with an open gate and empty
  `suppressionReasons`, and asserts the headline is well-formed (no `"— ."`).
  Confirmed to fail before the change and pass after.
- `tests/portfolio-briefing.test.ts`: asserts a secondary passage raises
  `relevanceUnassessedCount` without raising `supported`, and that the verdict
  stays negative.
- The M011 positive path is unregressed: the existing `holding` test uses
  evidence with `polarity: 'supports'`, and the Playwright vertical slice
  asserts `THESIS HOLDING` on a fixture carrying a supporting XBRL fact.
- Full suite and `tsc --noEmit` clean; verified against the real local database
  via `npm run research:panel`.

## Revocation And Incident Response

Revocation is a one-line change: drop `|| input.coverage.supported === 0` from
the level derivation. No data migration is involved — the verdict is derived at
read time from persisted polarity and is never stored, so no row needs
backfilling in either direction.

## Acceptance Criteria

1. A thesis with `supported === 0` never renders the positive state, regardless
   of confidence gate. *(Proven by test.)*
2. A thesis with at least one supporting assumption and no contradiction still
   renders it. *(Proven by the unchanged M011 test and e2e slice.)*
3. The `insufficient_evidence` headline is well-formed on the open-gate path.
   *(Proven by test and by live output.)*
4. Verdict copy asserts nothing about topical relevance in either direction.
   *(Proven by the existing regression assertion.)*

## Options Considered

1. **Gate the positive state on `supported > 0` (adopted).** Preserves the
   three-way distinction while refusing confidence the evidence has not earned.
2. **Delete the positive state entirely (rejected).** Simpler, and it would
   close the same hole, but it collapses "supported" into "not enough
   evidence" and would make a genuinely evidenced thesis indistinguishable from
   an unevidenced one. Raised and rejected on independent review.
3. **Rename `holding` to something less affirmative, keeping its conditions
   (rejected).** Cheapest, but it treats a naming problem as the defect. The
   defect is that a state was reachable without support, not that its label
   sounded confident.

## Consequences If Accepted

- The positive state becomes a claim about evidence rather than about the
  absence of a finding, and any future change to the level derivation should be
  checked against that.
- `MIN_COVERAGE_RATIO = 0.7` becomes less load-bearing for the positive state,
  since coverage alone can no longer produce it. That constant's own calibration
  (M011 records it as a stated product judgment, not a measured value) is
  untouched here and remains the user's.
- Theses in markets with no structured-fact source — the ID market has none,
  `createXbrlFactSources` returns `ID: undefined` in every branch — cannot reach
  the positive state at all today, because nothing there can produce
  `polarity: 'supports'`. That is an honest reflection of current capability and
  is tracked under R-025's narrative, not resolved by this record.

## Affected Files If Accepted

- `lib/research/verdict.ts` (level derivation and the `insufficient_evidence`
  headline branch)
- `tests/coverage-verdict.test.ts`, `tests/portfolio-briefing.test.ts`
