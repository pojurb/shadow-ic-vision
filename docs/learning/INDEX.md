# Builder Learning Index

Status: `active`

DEC-0007 was accepted on 2026-07-03. This index is now active. Candidates are evidence; only `promoted` entries with a current authoritative target may guide future work.

Candidates are evidence, not authority. Only entries recorded as `promoted`
with a current authoritative target may guide future work.

## Candidate Registry

| ID | Status | Classification | Milestone | Summary | Candidate file | Review date |
|---|---|---|---|---|---|---|
| LC-20260703-001 | `promoted` | `quality` | M001 | ADR first drafts miss deployment contract, pipeline stages, source adapter contracts, provider status, and testing architecture | [LC-20260703-001](candidates/LC-20260703-001-adr-completeness-checklist.md) | 2026-07-03 |
| LC-20260704-001 | `promoted` | `quality` | M001 | Required browser gates need a repeatable repository-owned harness; interactive browser control is supplementary | [LC-20260704-001](candidates/LC-20260704-001-repository-owned-browser-qa.md) | 2026-07-05 |
| LC-20260705-001 | `validated` | `quality` | M001 | Scheduled workers must share the approved durable persistence boundary and pass a real scheduler execution check | [LC-20260705-001](candidates/LC-20260705-001-local-scheduled-worker-boundary.md) | 2026-07-05 |

## Current Promoted Knowledge

The authoritative promotion history is maintained in
[`PROMOTIONS.md`](PROMOTIONS.md).

| Candidate ID | Target | Scope | Approved by | Effective date |
|---|---|---|---|---|
| LC-20260703-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | planning | user | 2026-07-03 |
| LC-20260704-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | user | 2026-07-05 |

## Retrieval Rules

1. Filter by task type, milestone, and classification.
2. Load only current promoted entries relevant to the task.
3. Follow the authoritative target rather than the candidate wording.
4. Ignore rejected or superseded entries.
5. Report the consulted candidate IDs, or `none`, at task completion.
