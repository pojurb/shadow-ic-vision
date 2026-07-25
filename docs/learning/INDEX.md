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
| LC-20260705-001 | `promoted` | `quality` | M001 | Scheduled workers must share the approved durable persistence boundary and pass a real scheduler execution check | [LC-20260705-001](candidates/LC-20260705-001-local-scheduled-worker-boundary.md) | 2026-07-05 |
| LC-20260708-001 | `promoted` | `quality` | M001 | Playwright mutation-triggered navigation checks should synchronize on app-owned API responses before asserting the destination route | [LC-20260708-001](candidates/LC-20260708-001-playwright-navigation-synchronization.md) | 2026-07-25 |
| LC-20260725-001 | `candidate` | `quality` | M006 | Open-ended document ingestion requires dedicated transcribe-first extraction seams rather than quote-verification functions | [LC-20260725-001](candidates/LC-20260725-001-open-ended-pipeline-extraction-seams.md) |  |
| LC-20260725-002 | `candidate` | `security` | M006 | Security and prompt injection scanners must be wired into production ingestion pipelines, not solely executed inside offline evaluators | [LC-20260725-002](candidates/LC-20260725-002-production-wiring-of-evaluator-safeguards.md) |  |
| LC-20260725-003 | `candidate` | `process` | M006 | Milestone scoping must verify baseline architecture deployment contracts before scheduling production provider sign-offs | [LC-20260725-003](candidates/LC-20260725-003-deployment-contract-prerequisites.md) |  |

## Current Promoted Knowledge

The authoritative promotion history is maintained in
[`PROMOTIONS.md`](PROMOTIONS.md).

| Candidate ID | Target | Scope | Approved by | Effective date |
|---|---|---|---|---|
| LC-20260703-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | planning | user | 2026-07-03 |
| LC-20260704-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | user | 2026-07-05 |
| LC-20260705-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | scheduled-worker verification | user | 2026-07-05 |
| LC-20260708-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | user | 2026-07-25 |

## Retrieval Rules

1. Filter by task type, milestone, and classification.
2. Load only current promoted entries relevant to the task.
3. Follow the authoritative target rather than the candidate wording.
4. Ignore rejected or superseded entries.
5. Report the consulted candidate IDs, or `none`, at task completion.
