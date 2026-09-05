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
| LC-20260725-001 | `promoted` | `quality` | M006 | Open-ended document ingestion requires dedicated transcribe-first extraction seams rather than quote-verification functions | [LC-20260725-001](candidates/LC-20260725-001-open-ended-pipeline-extraction-seams.md) | 2026-07-26 |
| LC-20260725-002 | `promoted` | `security` | M006 | Security and prompt injection scanners must be wired into production ingestion pipelines, not solely executed inside offline evaluators | [LC-20260725-002](candidates/LC-20260725-002-production-wiring-of-evaluator-safeguards.md) | 2026-07-26 |
| LC-20260725-003 | `promoted` | `process` | M006 | Milestone scoping must verify baseline architecture deployment contracts before scheduling production provider sign-offs | [LC-20260725-003](candidates/LC-20260725-003-deployment-contract-prerequisites.md) | 2026-07-26 |
| LC-20260726-001 | `promoted` | `quality` | M008 | Document extraction thresholds and HTML DOM cleaning must be isolated across source tiers to prevent raw web HTML boilerplate from clearing low filing-oriented sentence overlap thresholds | [LC-20260726-001](candidates/LC-20260726-001-document-extractor-threshold-isolation.md) | 2026-07-26 |
| LC-20260730-001 | `promoted` | `security` | cross-cutting | A default-on provider-calling change must be checked against every mode axis the codebase uses to distinguish deterministic/local from live/external behavior, not just the one the change is about | [LC-20260730-001](candidates/LC-20260730-001-security-default-change-needs-mode-parity-check.md) | 2026-08-04 |
| LC-20260804-001 | `promoted` | `process` | cross-cutting | When resolving a user-owned calibration value (e.g. a measurement contract), an assisting agent should propose methodology/conventions with reasoning but never the final calibrated number | [LC-20260804-001](candidates/LC-20260804-001-ai-proposes-methodology-not-final-thresholds.md) | 2026-08-04 |
| LC-20260804-002 | `promoted` | `quality` | cross-cutting | An AI reviewer fabricated a specific measurement-contract example ("Operating Margin ≥22%") and presented it as read from a real ISAT thesis during a verification task; caught by a second reviewer and confirmed false by direct database query | [LC-20260804-002](candidates/LC-20260804-002-ai-reviewer-fabricated-example-during-verification-task.md) | 2026-08-04 |
| LC-20260905-001 | `promoted` | `quality` | cross-cutting | SQLite backups under WAL require a database-aware snapshot and a clean restore check that proves committed data is present | [LC-20260905-001](candidates/LC-20260905-001-sqlite-wal-backup-requires-restore-proof.md) | 2026-09-05 |
| LC-20260905-002 | `promoted` | `quality` | cross-cutting | Round-trip verification must preserve domain meaning, relationships, and material derived results rather than only schema and row counts | [LC-20260905-002](candidates/LC-20260905-002-round-trip-tests-require-semantic-equivalence.md) | 2026-09-05 |
| LC-20260905-003 | `promoted` | `quality` | cross-cutting | Multi-lane orchestration needs explicit per-lane outcomes and an aggregate status that cannot hide soft failures | [LC-20260905-003](candidates/LC-20260905-003-multi-lane-runs-need-explicit-outcomes.md) | 2026-09-05 |
| LC-20260905-004 | `promoted` | `process` | cross-cutting | Cross-surface workflows need a stable handle or deterministic resolver that connects every user-visible stage | [LC-20260905-004](candidates/LC-20260905-004-cross-surface-workflows-need-a-stable-handle.md) | 2026-09-05 |

## Current Promoted Knowledge

The authoritative promotion history is maintained in
[`PROMOTIONS.md`](PROMOTIONS.md).

| Candidate ID | Target | Scope | Approved by | Effective date |
|---|---|---|---|---|
| LC-20260703-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | planning | user | 2026-07-03 |
| LC-20260704-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | user | 2026-07-05 |
| LC-20260705-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | scheduled-worker verification | user | 2026-07-05 |
| LC-20260708-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | browser verification | user | 2026-07-25 |
| LC-20260725-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | pipeline extraction | user | 2026-07-26 |
| LC-20260725-002 | [.agents/SECURITY.md](../../.agents/SECURITY.md) | production safety wiring | user | 2026-07-26 |
| LC-20260725-003 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | roadmap planning | user | 2026-07-26 |
| LC-20260726-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | document extraction tuning | user | 2026-07-26 |
| LC-20260804-001 | [AGENTS.md](../../AGENTS.md) | CLI agent product-constitution rule | user | 2026-08-04 |
| LC-20260730-001 | [.agents/SECURITY.md](../../.agents/SECURITY.md) | mode-parity check for default-on provider changes | user | 2026-08-04 |
| LC-20260804-002 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | verifying AI-reported examples against primary sources | user | 2026-08-04 |
| LC-20260905-001 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | SQLite WAL backup and restore verification | user | 2026-09-05 |
| LC-20260905-002 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | semantic round-trip verification | user | 2026-09-05 |
| LC-20260905-003 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | multi-lane run outcomes | user | 2026-09-05 |
| LC-20260905-004 | [.agents/QUALITY.md](../../.agents/QUALITY.md) | cross-surface workflow handles | user | 2026-09-05 |

## Retrieval Rules

1. Filter by task type, milestone, and classification.
2. Load only current promoted entries relevant to the task.
3. Follow the authoritative target rather than the candidate wording.
4. Ignore rejected or superseded entries.
5. Report the consulted candidate IDs, or `none`, at task completion.
