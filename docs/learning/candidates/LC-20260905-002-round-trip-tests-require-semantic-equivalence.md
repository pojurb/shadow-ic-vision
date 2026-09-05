# LC-20260905-002 - Round-Trip Tests Require Semantic Equivalence

Status: `promoted`

Captured: `2026-09-05`

Milestone: `cross-cutting`

Task type: `review`

Classification: `quality`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

JP Invest's thesis export/import round trip remained structurally valid while
dropping source-adequacy and assurance semantics and retaining decision
evidence references to pre-import IDs. In a synthetic reproduction, a coverage
gate that was `suppressed` before export became `open` after import, the verdict
became `holding`, audited assurance became unknown, and decision references no
longer pointed to the newly imported evidence rows.

This confirms that schema validation, successful insertion, and row-count
checks can all pass while the imported domain object means something different.

## Evidence

- Commit, run, or evidence ID: project-wide audit against
  `0ab929500c586d97ef96cfb4e1c48ae990d9bc4f`, 2026-09-05
- Commands or checks: synthetic export/import reproduction in
  `.tmp-review/audit.test.ts`; `npm test -- --config
  .tmp-review/vitest.config.ts`
- Exact result: the diagnostic assertion reproduced changed gate/verdict and
  broken evidence-ID relationships after a successful round trip; 7/7 audit
  reproductions passed
- Related review finding or incident:
  `outputs/reviews/project-review-2026-09-05.md`, P0 assessment-integrity
  finding

No confidential investment data, restricted data, or secrets are included.

## Proposed Reusable Lesson

For a logical export/import, migration, synchronization, or entity-cloning
contract, verify semantic equivalence at the domain boundary. Tests should compare the
relationships, provenance, user-owned classifications, version fields, and
material derived results that the application shows or uses after restoration.
When IDs are regenerated, every internal reference must be remapped and tested.

Schema validity and row counts remain useful structural checks, but they are
not acceptance evidence for a package whose restored state can change coverage,
assessment, or history.

## Scope And Risks

- Applies to: logical export/import, schema migration, synchronization, and
  entity-cloning paths
- Backup/restore-specific WAL safety is covered separately by
  `LC-20260905-001`.
- Does not apply to: explicitly lossy exports whose omitted semantics are named
  in the format contract and cannot be mistaken for a complete restoration
- Known failure modes: comparing only row counts; validating only the serialized
  schema; regenerating IDs without remapping references; failing to compare
  derived domain results before and after the round trip
- Conflicting authority checked: `AGENTS.md`, `.agents/QUALITY.md`, and
  `DEC-0017`; this candidate does not redefine the export product contract

## Independent Review

- Reviewer: independent review agent (separate agent session)
- Review date: 2026-09-05
- Evidence reproduced: `yes`
- Duplicate or conflict check: `.agents/QUALITY.md` already names round-trip
  testing generally, but no promoted lesson defines semantic-equivalence
  assertions or the confirmed failure mode captured here. The scope was
  narrowed to avoid overlap with `LC-20260905-001` on backup/restore.
- Privacy check: synthetic data only
- Disposition: `validated`
- Reason: independent reviewer reproduced the export/import failure and found
  the lesson generalizable after narrowing its scope to logical portability and
  migration paths

## Promotion Or Supersession

- Decision authority: user for any change to required quality gates
- Decision date: 2026-09-05
- Promotion target: `.agents/QUALITY.md`
- Promotion registry entry: `PROMOTIONS.md`, active promotion for
  `LC-20260905-002`
- Supersedes: none
- Superseded by:
- Rollback path: remove any promoted quality guidance and mark this candidate
  superseded; retain the reproduction evidence
