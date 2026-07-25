# DEC-0014 - Local-Only Scope Reaffirmation: Production Provider Approval Deferred

Status: `accepted`

Date proposed: 2026-07-25

Date accepted: 2026-07-25

Approving authority: user

Supersedes: none

Amends: [`DEC-0009`](DEC-0009-provider-security-gate.md) (defers the "later
production provider decision" it anticipates); withdraws the milestone subject
previously planned as M006 in [`ROADMAP.md`](../milestones/ROADMAP.md)

## Context

[`ROADMAP.md`](../milestones/ROADMAP.md) planned M006 as "Production
Confidential-Data Provider Approval": complete `DEC-0009`'s "Provider Approval
Requirements" checklist (retention, deletion, training-use, logging,
subprocessors, region terms) against current primary vendor sources, and record
a production-eligible provider decision.

Scoping that work surfaced a blocking dependency that was not visible when the
roadmap was written.

[`ADR-0006`](ADR-0006-m001-stack.md) §1 ("Deployment Contract (local-only)")
binds the application to `127.0.0.1`, bars SQLite from any Vercel-hosted
deployment, authorizes Vercel only for the public `index.html` documentation
page, and states:

> If remote access (LAN or cloud) becomes necessary in a future milestone, a
> new ADR must be created covering managed persistence and authentication
> before any such deployment.

There is therefore no production or hosted deployment for a production provider
approval to govern, and no accepted ADR that would create one. This is not
merely a sequencing inconvenience:

1. **The checklist is not answerable in the abstract.** Retention, region,
   subprocessor, and logging terms must be assessed against a specific
   deployment shape — which host, which managed persistence layer, which
   authentication boundary. None of those are chosen. An approval written now
   would either state terms for a hypothetical architecture or silently assume
   one.
2. **Approving an unused production path adds risk without adding capability.**
   A standing production-eligible provider approval is exactly the artifact
   `R-020` warns about ("POC external-processing approval is treated as
   production approval") — it would make production routing look sanctioned
   while the deployment contract still forbids it.
3. **The work would likely be redone.** Any future hosted deployment ADR would
   change the facts the checklist depends on, invalidating the approval before
   it was ever exercised.

The user's decision, recorded here, is that JP Invest remains local-only for
now.

## Decision Requested

1. **Defer production and hosted-demo confidential processing out of scope**
   until a hosted deployment is actually intended. `ADR-0006` §1's local-only
   deployment contract stands unamended.
2. **Withdraw the roadmapped M006 subject** ("Production Confidential-Data
   Provider Approval"). It is withdrawn, not completed and not rejected on the
   merits — it is deferred pending the prerequisite in the Reactivation Path
   below. `ROADMAP.md`'s M006 slot is re-planned to a different subject; this
   record is the traceable reason.
3. **Close M001 as `local-only complete`.** `ACTIVE_MILESTONE.md` currently
   records M001 as "not fully closed because provider-specific current-source
   approval and production confidential-data provider approval remain
   unapproved." Under this decision, production approval is out of scope rather
   than outstanding, so it no longer holds M001 open. The remaining
   current-source approval item is restated as an in-scope open boundary rather
   than a blocker inherited from a withdrawn milestone.
4. **Record production confidential processing as explicitly rejected from
   scope**, satisfying `docs/RISK_REGISTER.md`'s Review Rule that a critical
   trust, privacy, or data-integrity risk "blocks milestone closure and release
   until mitigated **or explicitly rejected from scope**."

## Approved Scope If Accepted

This decision **narrows** scope. It approves no new processing, no new
provider, no new model, and no new data class.

`DEC-0009`'s Data Classification Gate is unchanged in every row. In
particular, "Production confidential processing" remains **No**, and this
record makes that a deliberate, dated position rather than a pending item:

| Data class | Status after this decision |
|---|---|
| Public market data | Unchanged — allowed |
| Synthetic fixtures | Unchanged — allowed |
| POC workflow confidential data | Unchanged — allowed only through the configured POC provider boundary with outbound logging |
| Portfolio and position data | Unchanged — blocked (per `DEC-0011`) |
| Restricted personal or financial secrets | Unchanged — blocked |
| Production confidential processing | **No — now explicitly out of scope**, not pending approval |

`DEC-0010`'s five-model POC allowlist (as amended by `DEC-0013`) and
`DEC-0012`'s `minimax-m3:cloud` OCR/vision POC eligibility are unaffected.
Local POC traffic through the project-owned provider boundary continues
exactly as governed today.

## Risk Register Effects

- **R-003** (confidential investment data sent to an unapproved cloud model)
  stays `Open`. Its production leg is deferred by this decision, but its POC
  leg remains live — real confidential POC traffic still reaches Ollama Cloud
  under `DEC-0009`/`DEC-0010`. This decision must not be read as closing
  R-003.
- **R-020** (POC approval mistaken for production approval) stays `Open`, with
  this record added as a mitigation: there is now no production approval in
  existence to be confused with the POC one, and the absence is deliberate and
  documented.
- No risk is closed by this decision.

## Reactivation Path

The withdrawn subject becomes actionable again only when both hold:

1. A hosted or LAN deployment is actually intended, **and**
2. A new ADR covering managed persistence and authentication is accepted, as
   `ADR-0006` §1 requires.

At that point the `DEC-0009` Provider Approval Requirements checklist becomes
answerable against a concrete deployment shape, and a production provider
decision should be drafted then — not before. Reactivation is a new decision
record, not an edit to this one.

## Eval And Verification Path

No eval is required — this decision removes scope rather than authorizing
processing. Verification is documentation and status consistency:

- `docs/decisions/INDEX.md` lists this record with matching status.
- `DEC-0009` carries a signpost to this decision (a pointer, not a rewrite of
  its original text), per the amend-via-new-decision convention used by
  `DEC-0011` and `DEC-0013`.
- `docs/milestones/ROADMAP.md` records the M006 withdrawal and re-plan with a
  reference to this decision.
- `ACTIVE_MILESTONE.md` no longer describes production provider approval as an
  outstanding next step, and states M001's `local-only complete` status.
- `docs/RISK_REGISTER.md` reflects the R-003 / R-020 notes above without
  closing either risk.
- `npm run status:check`, `npm run context:check`, `git diff --check`.

## Revocation And Incident Response

- If confidential JP Invest data is ever found routed to a hosted or production
  provider path while this decision stands, that is a deployment-contract
  breach under `ADR-0006` §1 and a `DEC-0009` gate failure — handle it under
  `DEC-0009`'s existing incident response, not as a scope question.
- If a hosted deployment is stood up without the prerequisite ADR, this
  decision is violated regardless of whether any provider call was made.
- This decision may be revoked by accepting the Reactivation Path prerequisites
  above; revocation is expected and unexceptional, not an incident.

## Acceptance Criteria

- This record is accepted by the user or remains explicitly `proposed`.
- `docs/decisions/INDEX.md` matches this record's status.
- `DEC-0009` carries a signpost to this decision without its original text
  being rewritten.
- `docs/milestones/ROADMAP.md` reflects the withdrawal and the re-planned M006
  subject.
- `ACTIVE_MILESTONE.md` and `SESSION_CHECKPOINT.md` stop listing production
  provider approval as the next actionable step.
- `docs/RISK_REGISTER.md` records the R-003 and R-020 effects, with neither
  risk closed.
- `npm run status:check` and `npm run context:check` pass.
