# DEC-0011 - Decision Record Classification Amendment

Status: `proposed`

Date proposed: 2026-07-19

Approving authority: user

Supersedes: none

Amends: [`DEC-0009`](DEC-0009-provider-security-gate.md)

## Context

DEC-0009's Data Classification Gate table contains two rows that describe
user-recorded decision data inconsistently:

> Line 80 — POC workflow confidential data | Thesis text, assumptions,
> decisions, conversation text, and user-provided evidence needed to
> exercise M001 | Yes, only through the configured POC provider boundary
> with outbound logging

> Line 81 — Portfolio and position data | Holdings, position sizes, cost
> basis, personal returns, and user-recorded Buy/Hold/Reduce/Exit decision
> records | No; treated as restricted and requires a later explicit
> decision if POC use is ever needed

Row 80's use of the word "decisions" is ambiguous: read literally, it could
be understood to cover the same user-recorded Buy/Hold/Reduce/Exit decision
records that row 81 explicitly names and blocks. No other section of
DEC-0009 resolves which reading governs.

This has been treated as an open item since Milestone 4's Review History
Retention work. `DEC-0010` (Ollama Cloud POC provider approval), which
depends on DEC-0009, already adopted the strict reading for its own scope —
it lists `portfolio_position_data` as a blocked data class and states its
approval "would not approve portfolio/position data." `ACTIVE_MILESTONE.md`,
`SESSION_CHECKPOINT.md`, and `docs/CODEBASE_MAP.md` have all been treating
the blocked reading as binding pending a formal amendment, and
`tests/decisions.test.ts` carries a regression test asserting that
`generateDecisionRecommendation` never sends recorded decision text to a
provider.

Per this repository's convention, decisions are not rewritten in place
(see `DEC-0008-m001-multimodal-amendment.md`, which amends earlier M001
scope via its own new decision number rather than editing the document it
amends). This decision follows that same pattern for DEC-0009.

## Decision Requested

Amend DEC-0009's Data Classification Gate so that:

1. **User-recorded decision outcomes** — the `outcome`, `action`, and
   `rationale` fields persisted by `recordDecision` (Buy, Hold, Reduce, Exit,
   and the associated `No Change` / `Investigate Further` / `Update Thesis` /
   `Archive` outcomes) — are governed **exclusively** by the "Portfolio and
   position data" row and remain blocked from external provider processing.
2. Row 80 ("POC workflow confidential data") is corrected to read:

   > Thesis text, assumptions, in-flight workflow actions (e.g. thesis
   > confirmation, assumption challenge responses), conversation text, and
   > user-provided evidence needed to exercise M001. Excludes durable
   > recorded decision outcomes — see "Portfolio and position data" below.

3. Row 81 is unchanged in substance; its existing wording already correctly
   blocks recorded Buy/Hold/Reduce/Exit decision records.

This amendment does not change current application behavior. Review-history
data has been local-only since Milestone 4 shipped, and this decision makes
that existing behavior the explicit, binding interpretation rather than an
inferred one.

## Acceptance Criteria

- `docs/decisions/INDEX.md` lists DEC-0011 with matching status.
- `DEC-0009-provider-security-gate.md` carries a one-line signpost to this
  decision (not a rewrite of its original content).
- `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`, and
  `docs/CODEBASE_MAP.md` no longer describe the row 80/81 classification as
  unresolved.
- No code change is required; `tests/decisions.test.ts`'s existing
  regression guard already enforces the resulting behavior.

## Options Considered

1. Leave DEC-0009 as-is and continue treating the blocked reading as an
   informal team convention. Rejected — an unresolved textual contradiction
   in an accepted security decision is a governance gap, not a style choice.
2. Edit DEC-0009's table directly in place. Rejected — inconsistent with
   this repo's convention that decisions are amended via a new decision
   record, not rewritten.
3. Issue a new amendment decision (this document) that resolves the
   ambiguity and is cross-referenced from DEC-0009. Adopted.

## Consequences If Accepted

- The Data Classification Gate has one unambiguous reading: recorded
  decision outcomes are portfolio data and remain blocked from external
  providers absent a future explicit decision.
- `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`, and
  `docs/CODEBASE_MAP.md` drop their "unresolved" language for this item.
- No new engineering work is triggered; this is a clarification of existing,
  already-shipped behavior.

## Reversal Or Supersession

Supersede this decision if a later, more general decision restructures the
Data Classification Gate entirely. Reversal must not retroactively imply
that recorded decision data was ever permitted to leave the local runtime
before an explicit decision allowed it.

## Affected Files If Accepted

- `docs/decisions/INDEX.md`
- `docs/decisions/DEC-0009-provider-security-gate.md` (signpost only)
- `ACTIVE_MILESTONE.md`
- `SESSION_CHECKPOINT.md`
- `docs/CODEBASE_MAP.md`
