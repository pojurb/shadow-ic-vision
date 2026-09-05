# Execution prompt — M015 step 6b: export/import round-trip integrity

Prepared 2026-09-05, after 6a (WAL-safe backup) was implemented and verified.
Hand this to a fresh session as its opening instruction. Scoped to **6b only**
— not 6c (CLI slice), not M014.

---

## Standing rule for this project (2026-09-05)

**Plan first, wait for the user's go-ahead, then execute.** The motivation is
model/token efficiency, not doubt about correctness — a plan reviewed before
execution is the cheapest place to cut scope. Read-only investigation needed to
*build* a sound plan is fine without approval; keep it proportionate and say
what it cost. Derive the sequence yourself and present it — never hand back a
bare menu. State explicitly what you are **not** doing and where the cheap
exits are.

## Starting state — 6a is committed, the tree is clean

**6a landed in `30c36c0`** (`feat(db): make the database backup
WAL-consistent`), and this prompt itself in `4baf2f9`. Working tree clean at
that point. 6a was independently re-verified before being committed, not taken
on the completing session's word: full suite **481 passed / 3 skipped**,
`tsc --noEmit` clean, `lint` 0 errors, `context:check` and `status:check`
clean, `git diff --check` clean, live database untouched (`db.sqlite` mtime
unchanged), and the newest file in `../jp-invest-data/backups/` predating 6a's
work — so 6a wrote nothing to live data.

6b gets its **own commit**, separate from 6a. This repo's standing practice is
one `git revert`-able commit per behavioral change (M015 §8), and 6b touches
`lib/research/service.ts` and `lib/domain/contracts.ts` — different files, the
other half of the acceptance criterion, a different failure mode.

Also outstanding, unrelated to 6b: **`git push origin main` was denied by the
auto-mode permission classifier** on 2026-09-05, so **6 commits** sit ahead of
`origin/main`. Do not work around it. Report it and let the user push or grant
the permission.

## Two environment gotchas that will otherwise cost you a session

**Do not run `npm test` in parallel with `lint`/`context:check`/`build`.** On
Windows this reliably produces a spurious **42-of-42 test-file failure** —
`TypeError: Cannot read properties of undefined (reading 'config')`, with
`Test Files 42 failed` and `Tests no tests`, failing at the transform/collect
stage (`import 0ms`). It is esbuild contention between two concurrent Node
toolchains on the same tree, not a regression. Observed and diagnosed
2026-09-05; re-running `npm test` alone passed immediately. Run the suite on
its own.

**`.tmp-review/` is not yours.** A concurrent session left a gitignored
`.tmp-review/` directory (containing `audit.test.ts`, `vitest.config.ts` and
`wal-*` temp dirs) in the working tree. It is the sole source of `lint`'s one
remaining warning (`import/no-anonymous-default-export`). Do not attribute that
warning to your own work, and do not delete the directory — it belongs to
another session, the same reasoning that left `stash@{0}` alone in M015 step 2.

## Objective

Make a thesis survive `exportThesisData` → `importThesisData` with its **source
adequacy**, **assurance level**, and **decision→evidence linkage** intact.

This closes the remaining half of **AC-M015-07** (6a closed the backup half).
Its definition of done is deliberately behavioural: *"verified by comparing the
coverage ledger and verdict before export and after import, not by field-count
alone."*

## Required reading, in order

1. `AGENTS.md` — the four constitution rules
2. `docs/CODEBASE_MAP.md` — "Data Relationships" and "Critical Invariants",
   especially the `Decision.evidenceIds` paragraph, which is load-bearing here
3. `ACTIVE_MILESTONE.md`
4. `docs/milestones/M015-data-integrity-and-verified-output-recovery.md` — §4
   step 6, §5 AC-M015-07, §6 verification plan
5. Top entry of `SESSION_CHECKPOINT.md`
6. `lib/research/service.ts:1192-1415` — `exportThesisData` and
   `importThesisData`, read as one unit
7. `lib/domain/contracts.ts:379-433` — `thesisExportSchema`
8. `db/schema.ts` — `evidence`, `decisions`, `sourceAdequacyAssessments`

## The three defects, verified live against current code 2026-09-05

Line numbers were re-derived from the working tree, not copied from the earlier
audit — the audit's `1226-1246` / `1367` / `1405` have all shifted.

**1. `assuranceLevel` is dropped.** The evidence field map inside
`exportThesisData` (`lib/research/service.ts:1220-1245`) lists 21 fields and
`assuranceLevel` is not among them. The import counterpart
(`service.ts:1368-1394`) does not set it either, so every re-imported evidence
row falls to the column default `'unknown'`. An audited filing and an
unestablished one become indistinguishable across a round trip — the exact
distinction `a2f766f` shipped to create.

**2. `sourceAdequacyAssessments` is never exported.** `exportThesisData`
selects `theses`, `assumptions`, `evidence`, `decisions` and
`assumptionMeasurements`, and nothing else. The table is real and populated —
3 live rows, read at `service.ts:370` for the research panel — and there is no
import counterpart to write it back. Note the design intent recorded in
`db/schema.ts`: adequacy is a **user judgment**, never derived, and
`contractFingerprint` is what keeps a stale judgment from silently applying.
Both facts must survive the round trip, not just the classification letter.

**3. Decision→evidence linkage breaks — and the obvious fix is not
implementable as-is.** `service.ts:1368` mints a fresh `id: randomUUID()` for
every imported evidence row, while `service.ts:1406` writes
`evidenceIds: JSON.stringify(d.evidenceIds ?? [])` verbatim. Those ids came
from the *source* database, so after import they resolve to nothing.

**The part the earlier report missed, and the constraint that decides the
approach: the export carries no evidence identifier at all.** Read
`service.ts:1220-1245` — the exported evidence object has no `id` field, and
`thesisExportSchema` (`lib/domain/contracts.ts:400-432`) does not define one.
So "remap ids on import" cannot be written today: there is nothing to map
*from*. Any fix must first give each exported evidence row a stable key.

Three ways to do that, and the trade-off is the decision:

| Approach | Cost |
|---|---|
| **(a)** Export the real `evidence.id`; import builds an old→new map | Smallest diff. Puts internal UUIDs in the package file — low harm, they are opaque |
| **(b)** Synthesize a package-local key (e.g. `assumptionIndex:evidenceIndex`) | No internal ids leak, but `decisions.evidenceIds` must also be rewritten into that key space **at export time**, so export and import must agree on the scheme |
| **(c)** Match on `documentHash` + quote text | No schema change, and genuinely fragile — the corpus has multiple evidence rows per document hash, so the match is not unique |

**(a)** is the candidate to evaluate first, not a conclusion. Verify the claim
about (c)'s ambiguity against the live corpus before dismissing it.

## Two correctness traps

**A dangling `evidenceId` is by design — do not "fix" it.**
`docs/CODEBASE_MAP.md` states that `Decision.evidenceIds` is *"a point-in-time
snapshot of what was on the panel when the decision was recorded, not a foreign
key, so it survives that evidence later being superseded or deleted."* So an
id that resolves to nothing is legitimate history, not corruption. A remap must
translate the ids it **can** resolve and preserve the rest unchanged. Silently
dropping unresolvable entries would delete the record of what the user was
looking at — a worse bug than the one being fixed.

**Do not bump `version`.** `thesisExportSchema` pins `version: z.literal(1)`
and has an explicit, documented posture for fields added later: make them
`.optional()`, so every export file written before the field existed still
imports (`contracts.ts:396-399` says this in as many words, about M011's
`measurement`). Follow that precedent. Bumping to `2` would break every
existing package file, and nothing here requires it.

## Definition of done

1. A thesis exported and re-imported preserves, per evidence row, its
   `assuranceLevel`; per assumption, its `sourceAdequacyAssessments` row
   including `classification`, `reasoning`, `contractFingerprint` and
   `assessedBy`; and per decision, `evidenceIds` pointing at the **imported**
   evidence rows.
2. Verified the way AC-M015-07 demands: **compare the coverage ledger and the
   verdict before export and after import** (`deriveCoverageLedger` /
   `deriveThesisVerdict`, or `getResearchPanel` end to end) — not by counting
   fields.
3. Proven **fail-first**: each of the three defects has a test that fails
   against current code and passes after. Show both runs. Three separate
   assertions, not one bundled round-trip test — they fail independently and a
   single test would let two regressions hide behind one fix.
4. An export file written **before** this change still imports (the
   `.optional()` posture, exercised by an actual old-shaped fixture).
5. `importThesisData` keeps working for a package whose assumptions are
   `legacy_unspecified` — the real ISAT dogfood case. `tests/decisions.test.ts`
   already guards the clarification-gate half of this; do not regress it.

## Verification

- Focused tests first, then `npm run typecheck`, `npm run lint`, then full
  `npm run verify:full`.
- `npm run doctor -- --json` before and after. **Do not read the overall exit
  code as the signal** — it exits 1 on the accepted XBRL Tier B failure.
  Compare `tierA` violations and `tierC.current` counts; both must be
  unchanged. Baseline 2026-09-05: 116 paths checked / 0 violations, polarity
  0 supports / 0 contradicts / 276 inconclusive, assurance 6 audited / 0
  unaudited / 270 unknown, `nonInconclusiveEvidenceCount` 0, decisions 1.
- `logs/outbound.log` before and after. Expected delta **0** for both total
  lines and `api.tavily.com` — 6b touches no network path. Baseline at the time
  of writing: **5,209 lines / 3,155 Tavily**.
- Fingerprint the live database before and after (row count + SHA-256 of the
  serialised rows, per table). 6b should not mutate it at all.

## Hard constraints

- **Never run export or import against the live database.** Build fixtures in
  a temp SQLite file. The live DB is `../jp-invest-data/db.sqlite` (`DB_PATH`).
- If a live-DB mutation ever becomes genuinely necessary, it must be preceded
  by a verified backup — and `backupExistingDatabase` is now WAL-safe (6a), so
  use it rather than `copyFileSync`.
- Do **not** create `docs/generated/doctor-baseline.json`.
- Do **not** add an XBRL exception, change `doctor` behaviour, or add `doctor`
  to `verify:full`.
- Do **not** touch M014 or step 6c.
- Do **not** push without an explicit instruction; if a push is asked for and
  blocked by the permission classifier again, report it rather than working
  around it.
- Before committing: `git diff --check`, `npm run context:check`,
  `npm run status:check`; confirm `next-env.d.ts`, `.claude/`, live DB files and
  generated test artifacts are not staged. `next-env.d.ts` regenerates a
  `.next/types` → `.next/dev/types` diff on every dev/build run — restore it
  with `git restore --worktree -- next-env.d.ts`, never commit it.

## Documentation on completion

Status facts belong only in `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md` and
the M015 packet. Record the chosen identifier approach **and why the other two
were rejected**, the fail-first evidence, and the before/after coverage-ledger
and verdict comparison. With 6a and 6b both done, **AC-M015-07 is fully met** —
say so explicitly, and note that only 6c then stands between M015 and closure.

## Adjacent items deliberately not in scope

- **6c — CLI slice**: `thesis:stage` prints no thesis id while
  `research:queue` requires `--thesis-id`; staging is two non-atomic `.run()`
  calls; `CLI_WORKFLOW.md` describes one lane where five run; and
  `source-adequacy:record` writes durable state from CLI flags with no browser
  gate — a **Constitution rule 3** problem and a **user decision**, with three
  options already drafted (browser-confirm URL / write-but-mark-unconfirmed /
  record as a deliberate exception).
- **Snapshot bytes still have no automated backup.** 6a made the *database*
  backup WAL-safe; the 306 MB across `snapshots/` and `source-snapshots/` was
  backed up once by hand in step 1 and nothing keeps it current.
- `IdxAdapter.REPORT_TERMS` admitting only periodic financial reports.
- **A4** as the next candidate for a real directional verdict — A1's blocker is
  a calendar, not a defect.
