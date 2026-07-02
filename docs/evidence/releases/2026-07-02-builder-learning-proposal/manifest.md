# Builder-Learning Proposal Verification

Run ID: `2026-07-02-builder-learning-proposal`

Status: `verified_docs_only_not_active`

Base commit: `22b7a89`

Environment: Windows PowerShell, repository `D:\jp-invest`

## Scope

- proposed `DEC-0007` governance decision
- proposed builder-learning policy
- candidate, index, and promotion artifact contracts
- authority boundary preventing activation before user approval

## Checks Performed

1. Confirmed every proposed learning file exists.
2. Confirmed `DEC-0007` and `.agents/LEARNING.md` both declare status
   `proposed`.
3. Confirmed root `AGENTS.md` does not reference or activate the proposed
   policy.
4. Confirmed the candidate template contains task context, evidence,
   classification, privacy, independent-review, promotion, supersession, and
   rollback fields.
5. Confirmed no trailing whitespace in the changed authority and proposed
   learning files.
6. Confirmed README and `ACTIVE_MILESTONE.md` identify accepted DEC-0005 and
   ADR-0006 as the next M001 step.
7. Searched those status files for the superseded Gate 4 drafting language; no
   matches were returned.
8. Ran `git diff --cached --check` for the proposed package; it exited
   successfully with no output.

## Scenario Review

| Scenario | Proposed control | Result |
|---|---|---|
| Evidence-backed procedural candidate | Independent review, deterministic evidence, explicit target and registry entry | Defined |
| Unsupported candidate | `rejected` status and rejection registry | Defined |
| Duplicate, contradictory, or stale lesson | Gate review plus `superseded` status and rollback record | Defined |
| Product or policy change | Explicit user approval required | Blocked by policy |
| Confidential or restricted content | Exclusion, redaction, and re-review required | Blocked by policy |
| Model with a hard failure | Every authority and safety hard gate must pass before recommendation | Blocked by policy |
| Future retrieval of a promoted lesson | Filter index and follow only current authoritative targets | Defined; not runnable until activation and first promotion |

## Verification Not Applicable

No application code, product schema, dependency, runtime prompt, model route,
or approved evaluation baseline changed. Build, lint, unit, browser, migration,
import/export, and model evaluation runs were therefore not applicable.

The proposed learning process cannot be behaviorally exercised until DEC-0007
is accepted and at least one real candidate has been independently reviewed.

## Residual Risks

- Markdown policy is not technical enforcement; later tooling or CI must enforce
  the approved contract using the milestone-approved toolchain.
- Active-day review overhead and lesson quality require observation during M001
  Slice 1.
- No model comparison has been run; model selection remains manual and
  advisory.

## Outcome

The proposal is internally defined, remains inactive, and is ready for user
review. Acceptance of DEC-0007 is the required next step before synchronizing
the canonical playbook or using the learning workflow operationally.
