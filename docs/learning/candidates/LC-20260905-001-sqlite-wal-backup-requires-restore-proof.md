# LC-20260905-001 - SQLite WAL Backup Requires Restore Proof

Status: `promoted`

Captured: `2026-09-05`

Milestone: `cross-cutting`

Task type: `review`

Classification: `quality`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

JP Invest enables SQLite WAL mode but its database initialization backup copies
only the main database file. A synthetic reproduction committed a row through
an active WAL connection, triggered the existing backup path from a second
connection, and then opened the copied database. The committed row was absent
from the copy.

This confirms that successful file copying and a readable SQLite header do not
establish that a backup contains all committed state.

## Evidence

- Commit, run, or evidence ID: project-wide audit against
  `0ab929500c586d97ef96cfb4e1c48ae990d9bc4f`, 2026-09-05
- Commands or checks: synthetic Vitest reproduction in
  `.tmp-review/audit.test.ts`; `npm test -- --config
  .tmp-review/vitest.config.ts`
- Exact result: the diagnostic assertion reproduced a committed row present in
  the live WAL database but absent from the copied main-file backup; 7/7 audit
  reproductions passed
- Related review finding or incident:
  `outputs/reviews/project-review-2026-09-05.md`, P0 data-integrity finding;
  `outputs/reviews/cli-workflow-review-2026-09-05.md`, maintenance backup
  finding

No confidential investment data, restricted data, or secrets are included.

## Proposed Reusable Lesson

When SQLite can be in WAL mode, create backups through a database-aware
snapshot mechanism such as SQLite's Online Backup API, or through an explicitly
controlled checkpoint and copy procedure whose concurrency guarantees have
been established. A backup-related change is not verified until a clean
restore opens successfully and deterministic sentinel data committed before
the backup can be read with its relationships intact.

Apply this check to migration backups, maintenance safety copies, export or
restore tooling that claims database-level recovery, and release recovery
procedures. Do not infer completeness from file existence, copy success, file
size, or the ability to open the copied main file.

## Scope And Risks

- Applies to: SQLite backup, migration, cleanup, restore, and disaster-recovery
  procedures when WAL may be active
- Does not apply to: logical exports that deliberately define and test a
  narrower data contract
- Known failure modes: copying only the main file; copying WAL-related files at
  different instants; testing readability without checking committed data;
  treating an automatic startup copy as an operation-specific restore point
- Conflicting authority checked: `AGENTS.md`, `.agents/QUALITY.md`,
  `docs/CODEBASE_MAP.md`, and `DEC-0017`; this candidate changes no approved
  persistence architecture or product behavior

## Independent Review

- Reviewer: independent review agent (separate agent session)
- Review date: 2026-09-05
- Evidence reproduced: `yes`
- Duplicate or conflict check: no existing learning candidate covers WAL-safe
  backup and restore verification
- Privacy check: synthetic data only
- Disposition: `validated`
- Reason: independent reviewer reproduced the 7/7 diagnostic suite, confirmed
  the WAL data-loss behavior, found no duplicate candidate, and confirmed the
  lesson is generalizable to SQLite backup and restore procedures

## Promotion Or Supersession

- Decision authority: user for any change to required quality gates
- Decision date: 2026-09-05
- Promotion target: `.agents/QUALITY.md`
- Promotion registry entry: `PROMOTIONS.md`, active promotion for
  `LC-20260905-001`
- Supersedes: none
- Superseded by:
- Rollback path: remove any promoted quality guidance and mark this candidate
  superseded; retain the reproduction evidence
