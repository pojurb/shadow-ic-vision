# Builder Learning Promotion Registry

Status: `active`

This registry records promotion decisions; it does not grant authority by
itself. Each entry must link to the current authoritative target and the
evidence-bearing candidate.

## Active Promotions

| Candidate ID | Authoritative target | Scope | Evidence | Reviewer | Approver | Effective date | Last gate review |
|---|---|---|---|---|---|---|---|
| LC-20260703-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | planning | [LC-20260703-001](candidates/LC-20260703-001-adr-completeness-checklist.md) | user | user | 2026-07-03 | 2026-07-03 |
| LC-20260704-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | [LC-20260704-001](candidates/LC-20260704-001-repository-owned-browser-qa.md) | Antigravity (Claude Sonnet 4.6) | user | 2026-07-05 | 2026-07-05 |

## Rejected Candidates

| Candidate ID | Reason | Reviewer | Decision date |
|---|---|---|---|
| _None_ | | | |

## Superseded Promotions

| Candidate ID | Prior target | Superseded by | Reason | Rollback evidence | Date |
|---|---|---|---|---|---|
| _None_ | | | | | |

## Promotion Rules

- Candidate evidence must be reproducible or deterministically verifiable.
- The reviewer must be independent from the candidate author.
- The approver must have authority for the affected target.
- Consequential changes require explicit user approval.
- Candidate status and the index must be updated in the same change.
- A promotion without a current authoritative target is invalid.
