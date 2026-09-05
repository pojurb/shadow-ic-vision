# Execution prompt — M015 step 6a: WAL-safe database backup

> **COMPLETED 2026-09-05 — shipped in `30c36c0`.** Retained as the record of
> what was asked for, against which the delivered work was checked. Do not
> re-execute it. The outcome, the mechanism chosen (`VACUUM INTO` from a
> dedicated read-only connection), and why the two alternatives were rejected
> are in the M015 packet §4 step 6a. The next prompt is
> [`m015-step6b-export-import-roundtrip-prompt.md`](m015-step6b-export-import-roundtrip-prompt.md).
>
> One thing this prompt got wrong, worth carrying forward: it framed
> `VACUUM INTO` as needing verification that the installed SQLite cleared 3.27.
> That was right, but it understated the failure it was fixing — the old
> `copyFileSync` did not merely lose recent rows, it lost the **schema**, so
> the restored copy could not be queried at all.

Prepared 2026-09-05, immediately after step 5 closed. Hand this to a fresh
session as its opening instruction. It is scoped to **6a only** — not 6b
(export/import) and not 6c (CLI slice).

---

## Standing rule for this project (2026-09-05)

**Plan first, wait for the user's go-ahead, then execute.** The reason is model
/token efficiency, not doubt about correctness — a plan reviewed before
execution is the cheapest place to cut scope. Read-only investigation needed to
build a sound plan is fine without approval; keep it proportionate. Derive the
sequence yourself and present it — never hand back a bare menu.

## Objective

Make `backupExistingDatabase` produce a backup that is **consistent under WAL**,
and prove it by restoring to a separate path and reading the restored copy —
not by checking that a file exists.

This is half of **AC-M015-07**. The other half (export/import round-trip) is
step 6b and is explicitly **out of scope here**.

## Required reading, in order

1. `AGENTS.md` — the four constitution rules
2. `docs/CODEBASE_MAP.md` — "Critical Invariants", especially the migration/
   backup line
3. `ACTIVE_MILESTONE.md` — current status
4. `docs/milestones/M015-data-integrity-and-verified-output-recovery.md` — §4
   step 6, §5 AC-M015-07, §6 verification plan, §7 risks
5. Top entry of `SESSION_CHECKPOINT.md`
6. `db/client.ts` (68 lines, read all of it)

## The defect, stated precisely

`db/client.ts:32-39`:

```ts
function backupExistingDatabase(dbPath: string) {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return;

  const backupDirectory = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(dbPath, path.join(backupDirectory, `db-before-migrate-${timestamp}.sqlite`));
}
```

`fs.copyFileSync` copies **only the main database file**. `db/client.ts:49`
sets `journal_mode = WAL`, so committed transactions can live in `db.sqlite-wal`
until a checkpoint folds them into the main file. A backup taken while the WAL
holds committed-but-uncheckpointed pages silently loses them, and the loss is
invisible: the backup opens fine and simply lacks the most recent commits.

Confirm this live before fixing anything — do not take the paragraph above on
trust.

## The design constraint that decides the fix

`backupExistingDatabase` is called at `db/client.ts:44`, **before**
`new Database(dbPath)` at line 47. It is synchronous, inside a synchronous
`createDatabase`, called from a synchronous `getDatabase()` that is used
throughout the server. Three candidate mechanisms, and the trade-off is the
whole decision:

| Mechanism | Consistent under WAL | Sync? | Cost |
|---|---|---|---|
| `better-sqlite3`'s `db.backup()` (SQLite online backup API) | yes | **no — returns a Promise** | forces `createDatabase`/`getDatabase` async; ripples across every server caller |
| `VACUUM INTO '<path>'` | yes | **yes** | needs a connection open; output is compacted, so byte size differs from source |
| `wal_checkpoint(TRUNCATE)` then `copyFileSync` | yes | yes | **writes to the source database** — a backup routine that mutates the thing it is backing up |

Recommendation to evaluate, not to assume: **`VACUUM INTO`** keeps the function
synchronous, needs no API change, and is read-only with respect to the source.
Verify that claim against the installed SQLite version before building on it
(`VACUUM INTO` requires SQLite ≥ 3.27). If it does not hold, say so and present
the alternatives with their real costs rather than silently switching.

## One distinction that must not be blurred

AC-M015-07 says the backup must restore "with the in-flight transaction
intact." Read that as **committed but not yet checkpointed**. A transaction that
was still open and uncommitted at backup time must **not** appear in the
restored copy — including it would be the actual bug, not the fix. Say which
of the two the test exercises, explicitly.

## Definition of done

1. A backup taken while `db.sqlite-wal` is **non-empty** restores to a separate
   path and, when opened and queried, contains the committed rows that lived
   only in the WAL at backup time.
2. Proven **fail-first**: the same test fails against the current
   `copyFileSync` implementation and passes after the change. Show both runs.
3. The restored copy passes an integrity check (`PRAGMA integrity_check`) and
   its row counts match the source for at least the tables M015 cares about
   (`evidence`, `source_snapshots`, `assumptions`, `assumption_measurements`).
4. No signature change to `getDatabase()` unless proven unavoidable — and if it
   is, that ripple is its own decision to put to the user first.

## Verification

- Focused test, then `npm run typecheck`, `npm run lint`, then full
  `npm run verify:full`.
- `npm run doctor -- --json` before and after. **Do not read the overall exit
  code as the signal** — it exits 1 on the accepted XBRL Tier B failure. Compare
  `tierA` violations and `tierC.current` counts instead; both must be unchanged.
- Record `logs/outbound.log` line count and `api.tavily.com` count before and
  after. Expected delta: **0** for both. Baseline at the time of writing:
  **5,209 lines / 3,155 Tavily**.
- Fingerprint the live database before and after (all tables, row count +
  SHA-256 of the serialised rows). This work should not mutate it at all.

## Hard constraints

- **Never test against the live database.** Use a temp-directory SQLite file.
  The live DB is at `../jp-invest-data/db.sqlite` (`DB_PATH` in `.env`).
- Any live-DB mutation must be preceded by a verified backup — and 6a should
  need none, because it changes a code path, not data.
- Do **not** create `docs/generated/doctor-baseline.json`.
- Do **not** add an XBRL exception, change `doctor` behaviour, or add `doctor`
  to `verify:full`.
- Do **not** touch M014, step 6b, or step 6c.
- Do **not** push without an explicit instruction. Note: `git push origin main`
  was blocked by the auto-mode permission classifier on 2026-09-05 — if a push
  is asked for and blocked again, report it rather than working around it.
- Before committing: `git diff --check`, `npm run context:check`,
  `npm run status:check`; confirm `next-env.d.ts`, `.claude/`, live DB files and
  generated test artifacts are not staged. `next-env.d.ts` regenerates a
  `.next/types` → `.next/dev/types` diff on every dev/build run — restore it
  with `git restore --worktree -- next-env.d.ts`, don't commit it.

## Documentation on completion

Status facts belong only in `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`, and
the M015 packet. Record the chosen mechanism **and why the other two were
rejected**, the fail-first evidence, and the restore proof. If 6a alone
completes, AC-M015-07 stays **partially** met — say so plainly; 6b is still
required for the export/import half.

## Adjacent items deliberately not in scope

- **Snapshot bytes still have no automated backup.** `backupExistingDatabase`
  covers `db.sqlite` only; the 306 MB across `snapshots/` and
  `source-snapshots/` was backed up once by hand in step 1
  (`../jp-invest-data/backups/snapshots-backup-20260905T052656Z/`) and nothing
  keeps it current. Worth raising with the user as a follow-on; not 6a's job.
- `source-adequacy:record` writing durable state from CLI flags with no browser
  gate — a Constitution rule 3 problem, and a **user decision** with three
  options laid out for step 6c.
- `IdxAdapter.REPORT_TERMS` admitting only periodic financial reports.
- **A4** as the next candidate for a real directional verdict (A1's blocker is
  a calendar, not a defect).
