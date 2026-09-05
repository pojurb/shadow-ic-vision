# Session Checkpoint - 2026-09-05 (6a independently re-verified and committed; 6b prompt prepared)

A review-and-commit session, not an implementation one. No code was written
here: 6a's implementation arrived from a separate session as a completion
report, and this session's job was to check it against reality rather than
accept it, then commit it and prepare what comes next.

## Why the report was re-derived rather than trusted

Parts of the incoming 6a report arrived corrupted mid-sentence, and this
project's standing rule is that another session's stated results are not
evidence until re-checked. Everything below was verified directly.

| Claim in the report | Result |
|---|---|
| `VACUUM INTO` from a `{ readonly: true }` connection | Confirmed, `db/client.ts:47-53` |
| New test file exists and passes | Confirmed, `tests/db-client-backup.test.ts`, 2 cases |
| Full suite 481 passed / 3 skipped | **Confirmed independently** |
| `typecheck` / `lint` / `context:check` / `status:check` clean | Confirmed (`lint`: 0 errors, 1 warning — see below, not ours) |
| No live-database access | Confirmed: `db.sqlite` mtime unchanged, and the newest file in `../jp-invest-data/backups/` predates 6a's work |
| `backupExistingDatabase` exported for tests | Confirmed |

The two test cases are the right two, and the second is the one that matters:
it holds an uncommitted `BEGIN IMMEDIATE` open on a live connection while the
backup runs, and asserts the uncommitted row is **absent** from the restore.
That is AC-M015-07's "in-flight" distinction made concrete — committed but
uncheckpointed must survive, uncommitted must not.

## A process failure worth recording, because the symptom is alarming

The **first** `npm test` run reported **42 of 42 test files failed**,
`TypeError: Cannot read properties of undefined (reading 'config')`,
`Tests: no tests`, everything dying at the transform/collect stage
(`import 0ms`). Nothing was wrong with the code. The cause was this session
running `npm test` **in parallel** with `lint`/`context:check`/`status:check`
in a single batch — two Node toolchains contending over esbuild on the same
Windows working tree. Re-run alone, the suite passed immediately with 481/3.

Recorded because the symptom looks exactly like a catastrophic regression and
would plausibly send the next session hunting a bug that does not exist. Both
execution prompts in `docs/drafts/` now carry the warning: **run the suite on
its own.**

## Committed

- **`30c36c0`** — `feat(db): make the database backup WAL-consistent`. 6 files,
  +419/−23, including the new `tests/db-client-backup.test.ts`.
- **`4baf2f9`** — `docs(m015): prepare the 6b export/import execution prompt`.

Split deliberately: 6a is a behavioural change to `db/client.ts`, the prompt is
a document. One `git revert`-able commit per behavioural change (M015 §8).

## The 6b prompt corrects the incoming report on a point that changes the fix

The report described 6b as "not remapping decision evidence IDs on import."
Accurate as a symptom, wrong as a specification: **that fix cannot be written
against current code.** The exported evidence object
(`lib/research/service.ts:1220-1245`) carries **no `id` field**, and
`thesisExportSchema` (`lib/domain/contracts.ts:400-432`) does not define one —
so there is nothing to map *from*. Any fix must first give each exported
evidence row a stable key. Three approaches with their real costs are in the
prompt; exporting the real `evidence.id` is the candidate to evaluate first,
and matching on `documentHash` + quote is flagged as likely ambiguous, since
the live corpus holds multiple evidence rows per document hash.

Every line reference in the earlier audit had drifted and was re-derived from
the working tree: the evidence field map is at `service.ts:1220-1245` (audit
said 1226-1246), the per-row `randomUUID()` at `:1368` (said 1367), the
verbatim `evidenceIds` write at `:1406` (said 1405).

Two correctness traps are pinned down in the prompt so 6b cannot get them
backwards. A **dangling `evidenceId` is by design** — `CODEBASE_MAP.md` records
`Decision.evidenceIds` as a point-in-time snapshot, not a foreign key, which
deliberately survives its evidence being deleted; a remap must translate what
it can resolve and leave the rest untouched, because silently dropping
unresolvable entries would erase the record of what the user was actually
looking at when they decided. And **`version` must stay `z.literal(1)`**: the
schema has an explicit documented posture of adding later fields as
`.optional()` so older export files still import, and a bump would break every
existing package.

## Housekeeping

`docs/drafts/m015-step6a-wal-safe-backup-prompt.md` now carries a **COMPLETED**
banner pointing at `30c36c0` and at the 6b prompt, so it is not mistaken for
pending work. It also records the one thing it got wrong: it treated the old
`copyFileSync` as losing recent rows, when the reproduction showed it losing
the **schema** — a restored copy that cannot be queried at all.

**`.tmp-review/` is a concurrent session's leftovers** — gitignored, holding
`audit.test.ts`, `vitest.config.ts` and three `wal-*` temp directories. It is
the sole source of `lint`'s one remaining warning. Left in place, not deleted:
it belongs to another session, the same reasoning that left `stash@{0}` alone
in step 2. Both prompts now say so, so the warning is not misattributed.

`docs/RISK_REGISTER.md` was checked and needs no edit — no register row covers
backup or source-byte preservation; those findings live in the M015 packet §7.
Worth noting as an open suggestion rather than acted on unilaterally: **source
*bytes* still have no automated backup.** 6a made the *database* backup
WAL-safe; the 306 MB across `snapshots/` and `source-snapshots/` was copied
once by hand in step 1 and nothing keeps it current. That is the finding §1
opened this packet with, and it is still true.

## State

- **Pushed on the user's instruction: `origin/main` is at `9c950fc`**
  (`7583295..9c950fc`), carrying steps 1–5, 6a, both execution prompts, and
  this sync. The earlier attempt the same day was **denied by the auto-mode
  permission classifier** — not a git failure — and went through once that mode
  was exited. No workaround was attempted in between.
- **AC-M015-07 half met**: backup done, export/import (6b) not started.
- Live database untouched this session: `db.sqlite` mtime `2026-09-05 13:40`.
- `logs/outbound.log` unchanged — 5,209 lines / 3,155 Tavily. Nothing here
  touches a network path.
- Next: **6b**, via
  [`docs/drafts/m015-step6b-export-import-roundtrip-prompt.md`](docs/drafts/m015-step6b-export-import-roundtrip-prompt.md).
  Then 6c is all that separates M015 from closure.

---

# Session Checkpoint - 2026-09-05 (M015 step 6a: WAL-safe backup implemented and verified)

Executed the prompt in `docs/drafts/m015-step6a-wal-safe-backup-prompt.md`
after the user's explicit go-ahead (the standing plan-first rule below was
followed: investigation and a plan were presented first, execution began only
after the user answered "Implement 6a now").

## The defect, reproduced live before any code changed

With a fresh temp-directory database, `journal_mode = WAL` and
`wal_autocheckpoint = 0`, a `CREATE TABLE` + a committed `INSERT` left
`<db>-wal` non-empty (12,392 bytes measured directly). Copying only the main
file — the old `backupExistingDatabase`'s `fs.copyFileSync` — produced a
backup where `SELECT * FROM t` failed with `no such table: theses`: the
schema itself existed only in the WAL. This is worse than "loses the most
recent rows" — it can lose the whole database.

## The fix and why the other two candidates were rejected

`VACUUM INTO`, run from a dedicated connection opened `{ readonly: true }`,
at the existing call site in `db/client.ts` (before the app's own connection
is created). Verified directly, not assumed:

- SQLite 3.53.2 (via better-sqlite3 12.11.1) — comfortably above the 3.27
  minimum `VACUUM INTO` requires.
- Captures committed-but-not-yet-checkpointed rows (the WAL-loss case above).
- **Correctly excludes a still-open, uncommitted write transaction** held by
  a *different* live connection — proven with two concurrent connections: one
  holds `BEGIN IMMEDIATE` with an uncommitted insert, the other runs
  `VACUUM INTO`, and the uncommitted row is absent from the result. This is
  the exact committed-vs-uncommitted distinction the packet's AC-M015-07 text
  requires and warns against inverting.
- Passes `PRAGMA integrity_check` on the output.
- Leaves the source's WAL file and `journal_mode` completely unchanged
  afterward — confirmed by measuring both before and after.
- Succeeds even when the connection running it is opened `readonly: true` —
  so the fix is structurally read-only with respect to the source, not
  merely "shouldn't write to it" by convention.
- Fully synchronous — no ripple to `getDatabase()`/`createDatabase()`.

`db.backup()` was rejected because it returns a `Promise` and
`backupExistingDatabase` runs inside the synchronous `createDatabase` that
`getDatabase()` — used throughout the server — depends on; making it async
would force every caller to become async. `wal_checkpoint(TRUNCATE)` +
`copyFileSync` was rejected because it writes to the source database before
copying it, which is a backup routine mutating the thing it backs up — the
opposite of what `VACUUM INTO` proved capable of.

## Fail-first proof, `tests/db-client-backup.test.ts`

Two cases, both run against the old `copyFileSync` code first (both failed —
`no such table: theses` in case 1, `backupExistingDatabase is not a function`
in case 2 until it was exported) and again after the fix (both passed):

1. Committed rows across `theses`/`assumptions`/`assumption_measurements`/
   `source_snapshots`/`evidence`, present only in a forced non-empty WAL,
   restore with row counts matching the source and a clean
   `integrity_check`.
2. A row inserted inside a still-open, uncommitted transaction on the live
   connection is excluded from a backup taken concurrently by a second
   connection.

`backupExistingDatabase` was module-private; exported so tests can call it
directly rather than going through the full `createDatabase`/migration path.
No other export or signature changed.

## Verification

- `npm run typecheck` / `npm run lint`: clean.
- `npm test`: **481 passed, 3 skipped** (up from 453 at step 3's close — the
  delta also includes step 4's `doctor` tests, committed by a concurrent
  session between this session's start and this work).
- `npm run build`: clean. `npm run test:e2e`: **7/7** pass.
- `npm run context:check` initially reported the generated index stale (the
  new `backupExistingDatabase` export); `npm run context:generate` then
  `context:check`/`status:check`: clean.
- `npm run doctor -- --json` before and after this work: identical except
  `generatedAt` — exit 1 (the accepted XBRL Tier B failure, unchanged),
  Tier A/B/C figures unchanged.
- `logs/outbound.log`: `api.tavily.com` count unchanged at **3,155** before
  and after (this step touches no network path). Total line count grew from
  5,209 to 5,223 over the session from pre-existing, unrelated
  `tests/ollama-provider.test.ts` synthetic-fixture logging that occurs on
  every full-suite run — confirmed by inspecting the new lines directly
  (`dataClass: synthetic_fixture`, `route: tests.ollama-provider`), not
  caused by this change.
- No live-database access anywhere in this work: every test runs against an
  `fs.mkdtempSync` temp directory. `next-env.d.ts`'s build-regenerated diff
  was restored to HEAD (`git restore --worktree`), not committed.

## State left uncommitted, by instruction

Per this repository's "only commit when the user asks" rule, three files are
modified/added and **not committed**: `db/client.ts`, regenerated
`docs/generated/code-index.json`, and new `tests/db-client-backup.test.ts`.
`git push origin main` also remains pending from earlier this session (4
local commits ahead of `origin/main`; the user was asked for go-ahead and the
conversation moved to this prompt instead of answering) — unrelated to this
work and still the user's call.

## AC-M015-07, updated

**Partially met.** The backup half (6a) is done, verified as above. The
export/import half (6b — `sourceAdequacyAssessments`, `assuranceLevel`, and
decision-evidence-ID remapping on import) has not been started. 6c (CLI
slice) has not been started either.

---

# Session Checkpoint - 2026-09-05 (M015 step 5: A1 attempted, recorded as a genuine failed attempt)

No code changed. No database write. No network call. The live database is
byte-identical across the whole session — all 11 tables fingerprinted before
and after (`theses`, `assumptions`, `assumption_measurements`,
`source_adequacy_assessments`, `evidence`, `research_jobs`, `source_snapshots`,
`research_job_sources`, `decisions`, `discovery_candidates`,
`source_discoveries`), `db.sqlite` mtime unchanged at `2026-09-05 13:40`,
`logs/outbound.log` unchanged at 5,209 lines / 3,155 Tavily. Everything below
was re-derived from the live database and the retained source bytes rather than
taken from the packet's own prose.

## Before-state, re-derived rather than trusted

`npm run doctor --json`, exit 1 (the accepted XBRL Tier B failure, untouched):
116 `storage_path` rows checked, 0 violations; 7 accepted zero-byte hashes; IDX
official 81 attempts / 11 snapshots / 28 evidence; evidence polarity
supports=0 contradicts=0 inconclusive=**276**; assurance audited=6 unaudited=0
unknown=270; `nonInconclusiveEvidenceCount` **0**; decisions 1; Tier D 8
unreferenced files. Every figure the session was briefed with reproduced.

## The A1 contract, printed from the live row

`assumption_measurements` for `42333c4e-6602-49a6-877f-9f7ec663fc79`
(`resolution = resolved`):

- metric — *Persentase kepemilikan TLKM di PT Telkom Data Ekosistem (NeutraDC)
  pasca-transaksi*
- definitionVariant — *Kepemilikan ekonomi langsung + tidak langsung TLKM,
  diukur setelah closing transaksi pelepasan ~70% saham yang sedang diproses*
- `gte` / `30` / `percent` / `instant`

Three independently binding requirements: **after closing**, **economic**
ownership, **direct + indirect**.

## Branch B — the corpus cannot settle A1, and no code would change that

A1 carries 56 evidence rows across 25 distinct documents, all `inconclusive` /
`no_observed_value`. Every document was re-hashed against its `document_hash`:
24 of 25 byte-exact, the 25th being `7c37e117…`, one of the seven accepted
zero-byte snapshots. Ten are `source_tier = 'official'` — 3 IDX disclosures
(one `assurance_level = 'audited'`) and 7 issuer filings.

Extracted evidence is not the same thing as retained bytes, so the search was
widened past the evidence rows: **all 116 snapshots were re-extracted through
the pipeline's own `extractDocument`** (109 yielded text; the 7 zero-byte
defects skipped) and searched for NeutraDC / PT Telkom Data Ekosistem / TDE.

**48 documents mention NeutraDC. None states a post-closing TLKM ownership
percentage. None states that the transaction closed.**

| document | hash | published | states a % | why it fails the contract |
|---|---|---|---|---|
| IDX Q2-2026 financial statement | `ec80a0bdc712…` | 2026-07-31 | `PT Telkom Data Ekosistem … 100.0` | pre-closing consolidated ownership |
| IDX FY2025 / Q1-2026 / FY2024 / 2025 Q1–Q3 | `9b766bb9f05d…`, `fbbe1b6d0c3d…`, `f425eebc9ade…`, `dfa170de1e23…`, `57f83d9256ea…`, `78832be2c8e1…` | 2025-04-17 → 2026-05-29 | `TDE … 100.0` | same, and older |
| IDX sustainability report (audited) | `c51b7770d952…` | 2025-04-21 | — | NeutraDC named only for green-DC development |
| Issuer AR 2024 (Bahasa) | `021cd384b94f…` | — | **79,93% + 20,07%** | ownership as at **10 Dec 2024**, disclosed for a land-and-building affiliate transaction |
| Issuer AR 2024 (EN) / AR 2025 | `1a4c1666082d…`, `c0294f44e842…`, `6834daad5d92…` | — / 2026-05-12 | `TDE … 100%` | pre-closing; *unlocK value* states intent to monetise DC assets, no transaction |
| Issuer PR — group DC consolidation | `9244428b1531…` | 2026-07-31 | — | future tense, and a *different* transaction |
| Issuer PR — NeutraDC × PLN MoU | `5adc8a8f1ffa…` | 2026-08-14 | — | NeutraDC still "operating company dari PT Telkom Indonesia (Persero) Tbk"; 200 MW is power, not ownership |
| Issuer PR (most recent in corpus) | `619e445e26d9…` | 2026-09-03 | — | NeutraDC mentioned only as an AI-ready DC capability |

The closest passage anywhere, verbatim from `021cd384b94f…`:

> "1. PT Telkom Data Ekosistem 79,93% dimiliki oleh PT Telkom Indonesia
> (Persero) Tbk; dan 20,07% dimiliki oleh PT Sigma Cipta Caraka (dimiliki
> 99,99% oleh PT Telkom Indonesia (Persero) Tbk."

Right entity, right ownership concept, right direct + indirect decomposition —
and unusable, because it is pre-transaction. Reading it as A1's answer would
mean reporting pre-closing ownership as post-closing ownership.

**The blocker: the transaction has not closed.** Source absence downstream of
an event that has not happened — not retrieval, not extraction, not a
definition mismatch. An `observedValue` here would require asserting that a
pre-closing figure survives a closing that has not occurred; that is a
prediction, not arithmetic over labelled source values. `classifyPolarity`
already answers correctly: all 56 rows read `no_observed_value`.

## Why no live run was made

A1's job is `succeeded`, 31 attempts, last updated **2026-09-05T06:40:08Z** —
a live run by a concurrent terminal-agent session that morning. It retrieved
exactly two documents, both from **2025** (`c51b7770d952…`, `f425eebc9ade…`),
sweeping backwards through the already-known set; the newest IDX document is
still the 2026-07-31 filing. `research:refresh` would have repeated the same
calls against the same corpus with no path to a figure that does not exist, so
it was not run and no network call was spent. Tavily delta **0**.

## An open question in the packet, now answered

Step 5's superseded text asked whether the IDX snapshots reading
`assurance_level = 'unknown'` meant the classifier did not run or ran and could
not decide. **It did not run.** `a2f766f` was committed 2026-09-04 15:44 +0700;
all 9 of those snapshots were written earlier that day (01:00 and 04:24) by the
scheduled refresh, before the classifier existed. The two IDX documents
retrieved after it shipped — 2026-09-05 06:40, `c51b7770d952…` and
`f425eebc9ade…` — both classify **`audited`**, and are the source of all 6
`audited` evidence rows, the only non-`unknown` assurance values in the corpus.
The classifier works; those rows are older than it. No backfill proposed:
`'unknown'` means *not established* by contract, and re-deriving it
retroactively is its own decision. IDX live counts have also moved since step 4
was written — **11 snapshots / 28 evidence rows**, up from 9 / 22.

## Two findings surfaced, neither acted on

**A documentation/data discrepancy: M013's A1 = (B) classification was never
persisted.** M013 records *"A = 1 (A4); B = 2 (A1, A3); C = 3 (A2, A5, A6)"*,
but `source_adequacy_assessments` holds exactly **3 rows**, all `classification
= 'C'` — A2 (`9e75f461`), A5 (`c21155c9`), A6 (`c6eb7d7b`), all `assessed_by =
'user'` on 2026-09-04. **A1, A3 and A4 have no row at all.** So A1's "(B)"
lives only in the packet's prose; the durable table cannot distinguish "class
B" from "never assessed". Reported, deliberately **not repaired** — the table's
own doc comment says the classification is the user's judgment, never derived,
so writing an A1 row would be exactly the thing that column exists to prevent.

**`IdxAdapter` structurally cannot retrieve a material-transaction
disclosure.** `REPORT_TERMS` (`lib/research/adapters/idx.ts:7`) admits only
`laporan keuangan`, `financial statement`, `annual report`, `laporan tahunan`,
`audited`. *"Transaksi Material Tanpa Persetujuan RUPS"* — the announcement
type M013 named as A1's likely source — is filtered out before its attachment
is ever seen. Left alone: widening a live adapter's discovery filter is a
retrieval-behaviour change needing its own fail-first proof and a live run, and
it would not have moved A1 today because the disclosure it would admit does not
exist yet. It becomes load-bearing the day the transaction closes.

## After-state and closure

`npm run doctor --json` re-run after the investigation: identical, exit 1,
`nonInconclusiveEvidenceCount` **0 → 0**. That is step 5's own before/after
gate, and it did not move — correctly.

AC-M015-06 is **met under its explicit failure-recording clause**, not by
producing a verdict. Step 6 remains open, M014 untouched,
`docs/generated/doctor-baseline.json` still ungenerated, no XBRL exception
added, `doctor` behaviour unchanged and still outside `verify:full`.

**A1 is no longer the best next candidate** — its blocker is a calendar, not a
defect. **A4** is: the one assumption M013 classified (A), whose contract asks
for a segment YoY differential TLKM's filings do publish.

## New standing workflow rule, same day

**"mulai detik ini sampai seterusnya gw mau ada rules harus bikin plan dulu,
sebelum eksekusi, karena gw mau ngejar efisiensi model."** From 2026-09-05
onward: present a plan and wait for the user's go-ahead before executing. The
motivation is model/token efficiency — a plan reviewed before execution is the
cheapest place to cut scope. Read-only investigation needed to *build* a sound
plan is fine without approval, kept proportionate. This amends the earlier
"derive the sequence and start" rule rather than reversing it: deriving the
order is still the assistant's job and a bare menu is still not an acceptable
hand-back, but execution now waits. Recorded in the assistant's persistent
memory, not in this repository's governance documents, since it is a working
preference rather than a product contract.

## Step 6 planned; 6a prepared, not started

Step 6 was broken into three independently committable chunks, ordered by
dependency rather than by size:

- **6a — WAL-safe backup** (`db/client.ts:32-39`). First, because 6b and 6c
  both write to the live database and a correct backup is their prerequisite.
- **6b — export/import round-trip.** Three leaks re-verified this session:
  `exportThesisData` never reads `sourceAdequacyAssessments`; the evidence field
  list at `service.ts:1226-1246` omits `assuranceLevel`; `service.ts:1367` mints
  a fresh `randomUUID()` per evidence row while `service.ts:1405` writes
  `evidenceIds` verbatim, so decision→evidence linkage breaks on import.
- **6c — CLI slice.** `thesis:stage` prints no thesis id but `research:queue`
  requires `--thesis-id`; staging is two `.run()` calls with no transaction;
  `CLI_WORKFLOW.md` describes one lane where five run.

**6a's execution prompt is written and committed** at
[`docs/drafts/m015-step6a-wal-safe-backup-prompt.md`](docs/drafts/m015-step6a-wal-safe-backup-prompt.md).
It carries the constraint that decides the fix: `backupExistingDatabase` is
synchronous and runs *before* the connection is opened, so
`better-sqlite3`'s `db.backup()` — the obvious choice — is async and would
force `getDatabase()` async across every server caller. `VACUUM INTO` is put
forward as the candidate to evaluate (synchronous, consistent, read-only with
respect to the source), explicitly to verify rather than assume. The prompt
also fixes a reading that would otherwise invert the fix: AC-M015-07's
"in-flight transaction" means **committed but not yet checkpointed** — an
uncommitted transaction must *not* survive into the restored copy.

**Not started, by the new rule.** Awaiting go-ahead.

## Push blocked, not failed

`git push origin main` was **denied by the auto-mode permission classifier**,
not by git. Three commits remain unpushed: `e1e87c1`, `9375a66`, `d184f70`.
Contents were verified safe to publish first — 8 files, all docs plus
`scripts/doctor.ts`, `tests/doctor.test.ts` and `playwright.config.ts`, with no
`.env`, `.sqlite`, snapshot, `private/` or `logs/` path among them. No
workaround was attempted; the user runs the push or grants the permission.

---

# Session Checkpoint - 2026-09-05 (M015 step 4: `npm run doctor` implemented and verified live)

Implemented `scripts/doctor.ts` (`npm run doctor`) per the M015 packet §4.
Read-only by construction: it opens its own
`new Database(dbPath, { readonly: true, fileMustExist: true })` rather than
`db/client.ts`'s `getDatabase()`, which runs migrations and sets a WAL pragma
on connect. `db/client.ts` (and every module in the live research pipeline)
starts with `import 'server-only'`, which throws unless the process carries
`--conditions=react-server`; doctor's npm script deliberately does not carry
that flag, matching `status-check.ts`'s plain invocation, so the database path
is resolved by a small function mirroring `db/client.ts`'s
`resolveDatabasePath` (same `DB_PATH` env var and fallback) instead of
importing it.

## Live verification — actual `npm run doctor` output, 2026-09-05

```
Tier A — integrity assertions: PASS
  A1 storage_path resolves to a file: 114/114
  A2 no zero-byte file for a verified outcome: 0 violation(s), 7 accepted exception(s)
  A3 storage_path under the canonical snapshot directory: 0 violation(s), 7 accepted exception(s)

Tier B — lane liveness (>= 10 attempts, 0 successes fails): FAIL
  ok   Issuer official: 238 attempt(s), 38 success(es)
  ok   IDX official: 78 attempt(s), 9 success(es)
  ok   Issuer press release: 231 attempt(s), 32 success(es)
  ok   News wire: 56 attempt(s), 8 success(es)
  ok   Issuer info memo: 238 attempt(s), 20 success(es)
  DEAD XBRL (SEC structured facts): 55 attempt(s), 0 success(es)
  ok   Discovery → promotion: 79 attempt(s), 2 success(es)

Tier C — yield facts vs. baseline: NO BASELINE
  evidence polarity: supports=0 contradicts=0 inconclusive=270
  evidence assurance: audited=0 unaudited=0 unknown=270
  non-inconclusive evidence count: 0
  decisions: 1
  IDX official: 9 snapshot(s), 22 evidence row(s)

Tier D — warnings (never failing):
  unreferenced snapshot files: 8

Exit code: 1
```

This reproduces, from a live run rather than by hand, all four facts the
milestone established directly against the database on 2026-09-05: 114/114
`storage_path` rows resolve; the 7 zero-byte hashes report as accepted
exceptions, listed by hash, never a silent pass; IDX official shows 9
snapshots / 22 evidence rows; non-inconclusive evidence reads 0. The 8
unreferenced-file and 7-accepted-hash counts also match step 2's own
verification exactly.

## A new finding, surfaced by the tool rather than fixed by it

Tier B genuinely fails today, on `XBRL (SEC structured facts)`: 55 attempts,
0 successes. Investigated rather than adjusted away: those 55
`www.sec.gov`/`data.sec.gov` lines in `logs/outbound.log` are the one-off
manual SEC/XBRL probe M011 ran on 2026-07-05, 07-30, and 08-03 against a real
TSLA CIK — not production traffic. There has never been a live US-market
thesis, so `processResearchJobs` has never actually invoked this lane; the
retrieval mechanism itself is live-verified working (M011: 282 real TSLA
facts, correctly classified). ADR-0006 logs every outbound call regardless of
caller, so the log carries no field distinguishing a manual probe from a
production call — this cannot be filtered out mechanically without adding an
exception mechanism the packet's step 4 text does not specify.

Because Tier B fails, `--update-baseline` correctly refuses — exactly its
documented job ("a broken state must never be baselined as normal"), proven
by a fail-first CLI test (`tests/doctor.test.ts`, "refuses --update-baseline
while Tier A is failing"). **Put to the user directly; decision, 2026-09-05:
ship `doctor` exactly as specified, no XBRL-specific carve-out, and leave
`docs/generated/doctor-baseline.json` ungenerated for now.** Recorded as an
open item in the M015 packet §4/§7 and `ACTIVE_MILESTONE.md`, not silently
worked around — resolved later by either a real US-market thesis exercising
the lane, or an explicit, visible Tier B exception mirroring A2/A3's hash
list.

## Testing

`tests/doctor.test.ts`: 26 cases against `computeDoctorReport` (Tier A
missing-file/zero-byte/accepted-hash/outside-directory violations, Tier B
dead-lane threshold and the discovery `status = 'fetched'` vs.
`resulting_document_hash` distinction, Tier C regression detection and exit
codes, `--strict`) plus 3 CLI-subprocess cases for `--update-baseline`
refusal/success and `--strict --json`. Five of the load-bearing assertions
were proven fail-first by temporarily reverting the specific line in
`scripts/doctor.ts` and confirming the test failed, then reverting back and
confirming it passed: the A2 exact-hash exception predicate, the Tier B
`successes === 0` half of the dead-lane rule, the discovery
`status === 'fetched'` success filter, the `<` (not `!==`) baseline
comparator, and the `--update-baseline` Tier A/B refusal guard.

Full suite: 479 passed, 3 skipped (up from 453 passed at step 3's close —
+26, exactly `tests/doctor.test.ts`'s own case count). `npm run typecheck`,
`npm run lint`, `npm run context:generate` + `context:check`, `npm run
status:check` all clean.
`logs/outbound.log` grew by 7 lines across the full local `npm test` run, all
`synthetic_fixture` ollama-provider entries from the existing provider-gate
tests — **zero new `api.tavily.com` lines**, confirming the M015 step 3 mock-
mode leak fix still holds. Separately, and not caused by this session: the
log also grew by 10 real lines (`www.telkom.co.id`, `www.idx.id`,
`www.cnbcindonesia.com`, `api.tavily.com`, all HTTP 200, 2026-09-05T06:40) from
another concurrent terminal-agent session's live research run against the
same working tree, per this packet's recorded concurrency risk (§7) —
observed, not investigated further, since it is that other session's activity
on its own thesis run.

`npm run doctor` is deliberately **not** added to `verify:full` — see the
packet §4 "Deliberately not part of verify:full". `verify:full` (typecheck,
lint, test, build, context:check, status:check[, test:e2e]) was re-run in
full after this change and is green.

---

# Session Checkpoint - 2026-09-05 (three external reviews audited against live code and data; execution order agreed)

No code changed this session. The live DB was read three times, read-only —
`db.sqlite` mtime is still `2026-09-04 16:05:29`, unchanged. Everything below
was re-derived from the repository and from the live database rather than
accepted as reported, per the standing rule that another agent's stated
results are not evidence until re-checked.

## What arrived, and what it actually is

Three review documents:

- `outputs/reviews/project-review-2026-09-05.md` (159 lines) — full product,
  method, implementation and roadmap audit against commit `0ab9295`.
- An "Astra" chat summary — **the same audit**, not a second opinion. Same 7
  reproductions, same 61 Tavily calls, same commit, and it links to the same
  report file. It must not be counted as corroboration; two documents agreeing
  adds nothing when one is a rendering of the other.
- `outputs/reviews/cli-workflow-review-2026-09-05.md` (242 lines, "Sol") —
  genuinely separate in scope: the CLI surface and `docs/CLI_WORKFLOW.md`.

**Astra's summary drops five findings from the report it summarizes**, and
they skew cheap: the ACTIVE_MILESTONE/SESSION_CHECKPOINT drift (~10 minutes),
per-lane observability, the per-assumption document-caching gap
(`service.ts:621`), the OCR/XLSX metadata items, and the `service.ts` size
note. Net effect: the summary reads as five heavy problems where the report
held a mix including several one-hour wins. Work from the report, not the
summary.

## Verification result: the findings hold

Every claim spot-checked was accurate. Re-verified directly:

| Claim | Location confirmed |
| --- | --- |
| Backup copies only the main SQLite file under WAL | `db/client.ts:38` copy, `db/client.ts:49` sets `journal_mode = WAL` |
| Export drops source adequacy and assurance | `exportThesisData` never reads `sourceAdequacyAssessments`; the evidence field list at `service.ts:1226-1246` has no `assuranceLevel` |
| Decision evidence refs are not remapped on import | new `randomUUID()` per evidence row at `service.ts:1367`, `evidenceIds` stringified verbatim at `service.ts:1405` |
| Mock mode still calls Tavily | `discovery/factory.ts:18` has no mode branch at all; `runDiscoveryAndPromotion` is called unconditionally at `service.ts:679` — `sourceMode` only reaches promotion |
| 1 supported + 5 inconclusive yields `holding` | `coverage.ts:145` increments `evidenced` for any polarity; `verdict.ts:158` needs only `supported > 0` |
| Archive does not change `theses.status` | `recordDecision` inserts only; `app/api/theses/[id]/decision/route.ts` adds no transition |
| Priority score is blind to verdict | `calculatePriorityScore` takes three arguments: alerts, staleness, challenged |
| Graph hangs everything off the first claim | `graph.ts:111` `primaryClaimId = claimIds[0]` |
| Exploration citation is an unverified model string | `contracts.ts:264`, `z.string().trim().min(1).max(500)` |
| 25 of 54 source cards are generic | live DB: 54 documents, 193 claims, and the string "The document provides structural financial or economic information." appears exactly **25 times**; the other 168 are unique |
| The audit spent 61 real Tavily calls | `logs/outbound.log`: 61 POSTs to `api.tavily.com`, all HTTP 200, all dated 2026-09-05 — ~18% of September's 348 |
| CLI/web snapshot directories diverge | `research-queue.ts:38` and `research-retry.ts:79` hardcode `<dbdir>/snapshots`; `lib/research/config.ts:15` uses `SOURCE_SNAPSHOT_DIR` or `<dbdir>/source-snapshots` |
| `thesis:stage` handoff is broken | it prints `{conversationId, url, clarificationNeeded, questions}` — no thesis id; `research-queue.ts:23` requires `--thesis-id` and accepts nothing else |
| `source-adequacy:record` writes durable state from flags | calls `recordSourceAdequacy` with no browser gate, and prints "will no longer be requeued by the daily refresh" itself |
| `CLI_WORKFLOW.md` understates `research:queue` | doc lines 61-63 say "the deterministic CitationPipeline"; `service.ts:640-684` runs secondary, XBRL, discovery and promotion first |
| Staging is not atomic | two separate `.run()` calls, no `db.transaction()` — while `importThesisData` in the same file does use one |
| Scheduled refresh contradicts V1 | `PRODUCT_STRATEGY.md:74` and `:276` defer background monitoring; `research:refresh` and `install-research-task.ps1` exist |
| No CLI contract tests | 41 test files, none spawns a script subprocess |

Astra's "data investasi asli tidak diubah" also holds: `db.sqlite` was last
written `2026-09-04 16:05`, untouched by the audit.

## Two findings none of the three reviews made

**1. The snapshot split is not a risk. It already happened.**

```
../jp-invest-data/snapshots/          15 files    36 MB   <- CLI hardcodes here
../jp-invest-data/source-snapshots/  107 files   270 MB   <- .env + web read here
```

`.env` sets `SOURCE_SNAPSHOT_DIR=../jp-invest-data/source-snapshots`, and the
two CLI scripts ignore it. Fifteen documents' raw bytes have been stranded in
an unread directory since 2026-08-08.

**2. Source bytes have zero backup coverage.**

A grep across `scripts/`, `db/` and `lib/` finds nothing that backs up either
snapshot directory. `backupExistingDatabase` copies `db.sqlite` only. So
**306 MB of source bytes across two directories has no backup at all** — not
"a backup that loses the WAL tail", no backup.

This lands on the one asset all three reviews praise as real: the immutable,
content-addressed SourceSnapshot store. Immutability is worthless if the bytes
are not preserved; the hashes in the DB would point at files that are gone,
and every provenance claim in the product rests on those files. **This is now
the most urgent item in the combined audit**, ahead of the WAL backup defect —
the WAL bug loses the last transaction, this loses the entire evidence base.

## One correction to Sol

Sol writes that `research:queue` calling Tavily "explains the 61 requests from
the earlier audit." The first half is right, the attribution is wrong: the
project review states the source explicitly — the vitest suite and the
Playwright E2E run, not `research:queue`, and there is no trace of
`research:queue` having run on 2026-09-05. Same root cause
(`discovery/factory.ts` ignores mode), different vector. **The patch belongs in
the factory, not in the CLI script** — patching the script leaves the test
suite leaking.

## Three systemic patterns, none named by the reviews

**1. Ship, green tests, zero real output.** Step 6 shipped in `a2f766f` with
450 tests passing — and all 270 evidence rows read `assurance_level =
unknown`. The IDX adapter made 67 HTTP 200 calls over two months and produced
0 documents. Discovery is 0-for-65. One cause: `verify:full` validates code and
`status:check` validates documents, and **nothing validates that a shipped
feature produced any real output**. Cheaper to fix than 13 of the 14 findings.

**2. Governing documents drift from code.** `ACTIVE_MILESTONE.md:5` and `:13`
still say step 6 is open; `PRODUCT_STRATEGY.md:74` still defers background
monitoring that ships today; `CLI_WORKFLOW.md:61` describes one lane where
five run. For a project whose whole method is document-based governance, this
is the method losing accuracy, not untidiness.

**3. All three reviews propose a next priority that presumes the core works.**
The report picks integrity hardening, Astra picks "one complete weekly review
cycle", Sol picks the CLI vertical slice. Each is defensible in isolation and
each runs on top of the same fact below.

## The number that reframes all three reviews

Live DB, read-only:

```
evidence polarity : inconclusive 270   (supports 0, contradicts 0)
assurance_level   : unknown      270
decisions         : 1 row, project lifetime
research_jobs     : degraded 8, succeeded 6
theses            : TLKM active, ISAT archived
```

Zero of 270. After thirteen milestones and two months of live operation the
system has never once produced a directional judgment on a real thesis. Every
other finding is scaffolding around a core that has not yet fired. A weekly
cycle over this data reports "nothing evaluable" 100% of the time; a coherent
CLI slice over it stays coherent and useless.

## Agreed execution order (user approved 2026-09-05)

1. **Copy both snapshot directories somewhere safe.** 306 MB, currently
   unbacked. Before anything else.
2. **Unify the snapshot directory.** Honour `SOURCE_SNAPSHOT_DIR` in
   `research-queue.ts:38` and `research-retry.ts:79`; relocate the 15 orphans.
3. **Close the mock leak in `discovery/factory.ts`** (not in the scripts), and
   sync the three drifted documents.
4. **`jp doctor`** — a preflight that also checks real output: snapshot
   directory consistency, count of non-inconclusive rows, per-lane success.
   Closes patterns 1 and 3.
5. **Drive one TLKM assumption to `supports` or `contradicts` on real
   documents.** If it cannot be done, that is a more valuable product finding
   than the remaining thirteen items combined.
6. Then backup/export/import, the CLI slice, and the weekly loop.

Note on step 3: `discovery/factory.ts`'s doc comment argues that an empty key
*is* the safe default in every environment including tests. That reasoning is
now disproved by the 61 calls, so the fix overturns a documented M008 Slice 1
decision — record it rather than editing quietly.

## Open decision, not taken

**Which categories of durable state the CLI may write without browser
confirmation.** `AGENTS.md` rule 3 says all of it needs the browser;
`source-adequacy:record` has been writing user calibration from flags since
M013. In practice the gate held socially — the user chose the classes after
reading three analyses — but not technically. Either tighten the code or widen
the constitution explicitly. Both drifting apart unrecorded is the one option
that is not acceptable. Options were offered and not yet requested.

# Session Checkpoint - 2026-09-04 (step 6 shipped; M014 verified and found NOT complete)

Two tracks run in parallel at the user's request: step 6 built in the main
session (repo-only, no live-DB writes while the other track ran), M014
verification delegated to a subagent with a hard no-commit constraint so all
writes stayed on one hand. Backup taken first:
`db-before-m014-verify-20260904T152833.sqlite`.

## Step 6 — the assurance axis, shipped (`a2f766f`)

`lib/research/assurance.ts` answers one question — does this document carry
an auditor's opinion — as `audited` / `unaudited` / `unknown`, and **never
defaults to `audited`**. Each adapter supplies the signal it actually has:
IDX the announcement title (strongest — it says so outright), SEC the form
code, the issuer crawl a filename falling back to period shape (`TW` vs
`AR`), XBRL facts the form code `selectFact` already reads.

Ordering inside the classifier is load-bearing, not style:
`"unaudited".includes("audited")` is true and `"tidak diaudit"` contains
`"diaudit"`, so negatives are checked first — the same trap `issuer.ts`
already documents, which is why its TIER1 lists carry no `audited` token.

Carried snapshot → pipeline → evidence row with each hop written explicitly,
because the column has a default and a missed hop would degrade silently to
`unknown` with typecheck still green. Panel states it on **every** row: shown
only-when-unaudited would make "nothing shown" indistinguishable from
"audited", which is the confusion being removed.

**User's decision: label only — do not let assurance affect the verdict.** So
step 6 is complete as scoped. It deliberately does not touch `DEC-0018`
territory ("what counts as support"), which would have needed its own
decision record rather than being folded in quietly.

450 tests (up from 442), typecheck/lint/context/status clean. Migration
`0015` applied to the live DB afterwards; **all 270 existing evidence rows
read `unknown`**, correctly — they were ingested before the column existed
and backfilling them as audited would assert something nobody checked. Real
values populate as new documents arrive.

## M014 — verified, and it CANNOT be marked complete

**This corrects what this session said earlier today.** On seeing 54/54
`graph_ready` and the right extractionMethod counts (22 docx / 2 xlsx / 1
ocr), the read given to the user was "M014 looks substantively done, just
never recorded — the work is verify-and-close-out." **That was wrong**, and
the deeper verification found why.

**What genuinely holds up (Slices 0–3).** The parsers are real and
deterministic: re-running `extractDocxBytes`/`extractXlsxBytes` in memory
against the real sources re-derives all 24 Office artifacts **byte-identical**.
Isolation holds — 0 contamination across every row of `evidence` (270),
`source_snapshots` (114), `theses`, `assumptions`, `portfolio_positions`.
Manifest/DB 1:1 on all 7 fields. Idempotence proven by two full re-runs: zero
row or artifact changes. Provenance gates all pass: 193/193 claims satisfy
`canonicalText.includes(quote)`, 914/914 edges have valid source claim ids.
`originals/` byte-unchanged, verified by hashing (note: it is gitignored, so
`git status` proves nothing there — the subagent caught that and hashed
instead).

**Three blockers, one serious:**

1. **Slice 0 criterion not implemented.** `knowledge:scan` must "output exact
   breakdowns of Office formats"; it emits only totals. The MIME map exists
   in `intake.ts` but is never surfaced.
2. **OCR provider metadata is clobbered.** §8 requires it in both tables.
   `extraction.ts` writes it correctly, then `batch.ts:141-150` overwrites the
   same three columns with digest metadata. The scanned PDF's row now reads
   `file-backed / fixture-file-v1`; the true values survive only in
   `knowledge_processing_runs`. A column collision between two stages, not
   data loss.
3. **SERIOUS — the 25 M014 documents are `graph_ready` on stub source cards.**
   `process_slice4.py` (recovered from `d243a7d`) slices the first 500
   characters of `canonicalText` as the "quote" and emits a fixed template.
   Measured across all 25: **one distinct claim text** ("The document provides
   structural financial or economic information."), `documentType: "Document"`
   for every one, and **0 concepts, 0 mechanisms, 0 definitions, 0 indicators,
   0 limitations**. Against the 29 M012 PDFs: 168 distinct claims, 212
   concepts, 75 mechanisms, 96 definitions. Every provenance check passes **by
   construction** — the quote was cut from the text it is checked against.
   This is risk **PR-038 ("false confidence from a successful parser run")
   realized**, and the packet's own §12.8 Slice 4 record ("all 25 claims had
   exact quotes present") is literally true and materially misleading.

**Untestable against this corpus, and should be recorded as gaps rather than
left implied-verified:** the live corpus has **0 tables across all 22 DOCX**,
**0 formula cells and 0 hidden sheets** in both workbooks — so DOCX table-cell
locators are entirely unverified (and the test named for them only asserts a
cell *value* appears, not the locator format). Password-protected fail-closed
and hash-mismatched OCR handoff are both required fixtures in §9 and neither
exists. Merged cells deviate from §4C: ExcelJS propagates the master value to
every slave cell and the parser emits each — **1325 of 1462 blocks (90.6%) in
`Centralbankassestment.xlsx` are merge-duplicates, 1462 cells carrying 70
distinct values**.

**To close M014 honestly:** fix the scan breakdown, stop `batch` clobbering
OCR provider metadata, and either regenerate the 25 source cards through a
real digest path or explicitly downgrade those documents and record Slice 4
coverage as nominal. Not done here — this was a verification pass, and the
remedy is the user's call.

**Verification side effects, disclosed:** `knowledge_processing_runs` grew
280 → 282 (two scan-stage audit rows), `m012-report.json` regenerated twice
(identical but for `generatedAt`). Nothing else changed.

## Resume point

- Step 6 done and closed by user decision. Nothing outstanding on it.
- M014's three blockers are open and unstarted. Blocker 3 is the one that
  matters: 25 documents currently counted as knowledge coverage contain no
  knowledge.
- The parallel-work pattern held up well: one hand on git, subagent
  read-mostly with an explicit no-commit rule, backup first.

---

# Session Checkpoint - 2026-09-04 (Option A: reviewed and committed the VISION/PRODUCT_STRATEGY terminal-agent edit)

Found sitting uncommitted (not from this session): substantial additions to
`VISION.md` §7/§8 and `docs/PRODUCT_STRATEGY.md` §4, formalizing a
"terminal-first interaction model" — the terminal agent as external
orchestrator, browser as the sole commitment gate for durable state and
investment actions, the agent's own web search staying "exploration only"
same as any other search.

**Provenance checked before touching anything.** Not this session's work.
Messaged the peer session (`jp-invest-58`, then renamed/reconnected as seen
in `ListAgents`) to ask whether it was theirs, mid-edit — it replied that
its session had never touched either file (first turn), and after
independently pulling and reading the same diff, corroborated it as complete
and internally coherent. So most likely a direct edit by the user outside
any Claude session, not another agent's in-progress work.

**Confirmed this isn't new policy — it's the vision/strategy docs catching
up to `DEC-0017`** (`Terminal-first CLI workflow and concurrency model`,
already `accepted`), which `docs/CODEBASE_MAP.md:591` already states plainly
("commitment gate is the browser, not the CLI"). Read every added
paragraph in full document context (not just diff hunks) in both files —
no fragments, no contradictions between the two files or with the rest of
either document.

**Committed** (`03d244e`). `status:check` and `context:check` clean.

## What this closes

This was "Opsi A" from the prior turn's menu — the uncommitted governance
work found alongside the "what's next" question. It's done. The other three
options from that menu (step 6/assurance metadata, M014, or stopping here)
are still open and unchosen.

## Resume point

No active task. Same fork in the road as before this digression:
- Step 6 (audited vs. unaudited assurance metadata) — independent of the
  closed IDX/XBRL chain, not started.
- M014 (private-knowledge coverage expansion) — still dormant.
- Or stop here; the M013 follow-on roadmap is substantively closed (5 of 6
  steps resolved, one declined by user decision).

---

# Session Checkpoint - 2026-09-04 (user decision: no vertical slice; roadmap effectively closed at step 4)

**User's decision, given the spike's findings above: do not build the IDX
XBRL vertical slice.** Chosen over "build anyway for future theses" and "fix
the two code gates first, then decide" — the recommendation (stop here) was
accepted as given. `ACTIVE_MILESTONE.md` updated to reflect this as the
current state, not a pending question.

## What this closes and what it leaves open

Of the six-step roadmap agreed 2026-09-03:

1. Sign off — done
2. Two independent fixes — done (`fe02f81`)
3. Q6 — done, built and applied to real data, one live bug found and fixed (`7ceeed6`, `ebe8f98`)
4. Bounded IDX spike — done (`b9755d2`)
5. Vertical slice — **declined.** Not deferred, not scoped for later — a
   considered no, on the evidence the spike produced.
6. Assurance/audit-tier metadata (audited annual vs. unaudited interim) —
   **still open, and analytically independent of steps 4–5.** It was
   sequenced after the vertical slice in the original roadmap because that
   roadmap assumed XBRL facts would be the trigger for caring about audit
   status. But the actual finding behind it doesn't depend on XBRL at all:
   `issuer.ts`'s `TIER1_PHRASE_PAIRS` already lands an unaudited interim
   report (confirmed live: *"Laporan Keuangan Interim Yang Tidak Diaudit"*)
   at `tier1`/official today, on the existing PDF path, capable of reaching
   `exact_verified` with no audit-status signal anywhere downstream. Whether
   to pursue this is a fresh question, not a resumption of the old one — not
   decided here.

**Two things found this session and never fixed, left as recorded debt, not
tracked against any open roadmap step:**
- `app/api/chat/route.ts` and other prompt/comment text may still have
  residual "no XBRL for non-US issuers" framing beyond the one instance
  corrected in step 2 — not swept exhaustively.
- `normalizeIdxAttachmentUrl`'s `.pdf`-only gate (found during the spike) —
  irrelevant unless XBRL work is picked up again later, in which case it's
  the first thing to fix.

## Resume point

No active roadmap item. The one open question is step 6, and it needs its
own framing (independent of IDX/XBRL) before any work starts — this is a
natural stopping point for the session, not a mid-task cutoff.

---

# Session Checkpoint - 2026-09-04 (roadmap step 4 done — bounded IDX spike, real XBRL downloaded and inspected)

Continuing the six-step post-sign-off roadmap in order. Step 4 closed —
research only, no code changed, nothing committed to the repo. Working tree
stayed clean throughout; files fetched live to a temp scratch directory.

## What the spike proved

**Transport works, on the correct host only.** `www.idx.id` serves
`StaticData/...` attachments (PDF, and — critically — `.zip`) with HTTP 200
and no auth, using the same `User-Agent` this app already sends. `www.idx.co.id`
(the host IDX's own announcement API returns in `FullSavePath`) returns a
blanket 403 from its WAF for every file type tried, PDF included — confirming
`normalizeIdxAttachmentUrl`'s existing hostname rewrite
(`idx.co.id`→`www.idx.id`) is load-bearing, not cosmetic.

**Downloaded and inspected two real TLKM XBRL packages** — Q1 2026 (filed
2026-05-29) and Q2 2026 (filed 2026-07-31), each an `instance.zip`
(`instance.xbrl` + `Taxonomy.xsd`) plus a separate `inlineXBRL.zip` (20 role-
coded HTML pages, e.g. `3410000.html` = statement of changes in equity).
Taxonomy confirmed **2020-01-01** (`idx-cor` namespace), not 2014, live in a
current filing. 518 distinct concepts, ~2,860 contexts in the Q1 instance —
a real, substantial filing, not a stub. Generated by "Fujitsu Interstage
XWand" (a known OJK e-reporting XBRL tool).

## The two findings that matter for what gets built next

**1. No segment dimension exists anywhere in the data.** Every `dimension=`
attribute used across both quarters: `ComponentsOfEquityAxis`,
`CarryingAmountPropertyPlantEquipmentAxis`, `ClassesPropertyPlantEquipmentAxis`,
`CreditorBankNameAxis`, `CurrencyAxis`. **None for business/operating
segments.** `idx-cor:SalesAndRevenue` appears exactly twice per instance —
current-period and prior-period **consolidated totals only**. The actual
segment breakdown lives solely in `idx-cor:SegmentReportingTextBlock`, a
free-text narrative disclosure citing PSAK 108 — the same extraction problem
class as a PDF paragraph, not solved by moving to XBRL.

**Consequence for A4:** its contract (Digital Infrastructure segment YoY
revenue growth minus consolidated YoY growth) **cannot be computed from
structured XBRL facts, full stop** — not "needs more adapter work", genuinely
absent from the data. This corrects the earlier framing (this session's
GPT/Gemini review round) that treated A4's gap as an app-side dimensional-
query limitation; the limitation is upstream, in what TLKM tags at all.

**2. NeutraDC/Ekosistem/divestment: zero mentions in either quarter's
instance file**, structured or narrative-tag. What IS present: `idx-cor:
NonControllingInterests` moved from **Rp19,852,000,000,000** (FY2025 year-
end) to **Rp16,515,000,000,000** (Q2 2026) — a real, structured, ~Rp3.3
trillion decline, directionally consistent with a dilutive divestment. But
it is an **aggregate across every TLKM subsidiary**, not NeutraDC-specific,
and the disposal sub-breakdown tags that would attribute it
(`ChangesInNonControllingInterestsDueToDisposalOfSubsidiaries`, per equity
component) are all `xsi:nil="true"` in the periods checked.

**Consequence for A1:** XBRL offers a corroborating aggregate signal, not a
clean answer to its specific contract (TLKM's post-divestment ownership % in
NeutraDC specifically). The transaction-specific detail, if disclosed at
all, lives in the separately-filed "Informasi atau Fakta Material" PDFs
(already in `IssuerAdapter`'s reach today) or in CALK narrative — not in a
structured tag XBRL parsing would add.

**3. A second, independent code gate, found by inspecting our own adapter
while running this spike:** `normalizeIdxAttachmentUrl`
(`lib/research/adapters/idx.ts:87`) hard-requires `.pathname.endsWith('.pdf')`.
Even with yesterday's `Kode_Emiten` fix, it would fetch the narrative PDF and
silently reject `instance.zip`/`inlineXBRL.zip` — the only files that carry
structured data. Not fixed; recorded as a prerequisite of any future build,
not done as part of this spike (spike = read-only, no code changes).

## What this changes about the roadmap

Step 5 ("if the spike succeeds: one vertical slice") assumed success would
mean "XBRL unlocks A1 and A4". **It doesn't, for either.** What a parser
would reliably deliver: clean consolidated figures (total revenue, balance-
sheet lines, etc.) for contracts that only need TLKM's own consolidated
numbers — a real capability, just not the one that motivated reopening the
IDX question this session. Whether that's worth building is now a narrower,
better-informed question than it was this morning, and it's the user's call,
not a default "yes, proceed to step 5."

No code touched, nothing committed. All downloaded files live only in this
session's temp scratch directory, not the repo.

## Resume point

Step 4 done. Steps 5 (vertical slice) and 6 (assurance axis) unchanged in
shape, but step 5's premise needs the user's explicit re-confirmation given
the finding above before any building starts.

---

# Session Checkpoint - 2026-09-04 (Q6 applied to real TLKM data; found and fixed a real disclosure bug live)

## A2/A5/A6 classified (C) on the live thesis — mechanism actually used

Ran `npm run source-adequacy:record` three times against the real TLKM
thesis (`168cd37c-a6ce-473e-9b2a-943f253c0ef6`), reasoning drawn verbatim
from the M013 packet's own already-established findings, not reworded:

| Assumption | ID | Reasoning source |
|---|---|---|
| A2 (competitive position) | `9e75f461-6002-45c8-82c7-dfbaa867aec8` | packet §A2, denominator is private-competitor MW no one publishes |
| A5 (hyperscaler commitments) | `c21155c9-399a-42a6-96dc-0db4a984daaa` | packet §A5, 43 rows, no named commitment ever appears |
| A6 (firm PLN power) | `c6eb7d7b-4d3c-48e6-8e18-2268ab147917` | packet §A6, 90+ docs, no MW/MVA/GW firm-PLN figure ever appears |

**Verified live, not just via test:** snapshotted `attempt_count`/`updated_at`
for all six TLKM jobs, ran a real `RESEARCH_SOURCE_MODE=live npm run
research:refresh`. A1/A3/A4 advanced normally (attempt +1, `updated_at`
bumped). **A2/A5/A6 were completely untouched** — identical `attempt_count`
and `updated_at` before and after. The requeue-exclusion mechanism built
yesterday works correctly in production, not only in the test suite.

## A real bug found live minutes later, fixed same session

`research:panel` after the classification still read *"retrieval reached 6
of 6 (100%) — confidence gate: open"* — no disclosure at all, despite three
assumptions now closed. Not a display quirk; a real defect in what was
committed yesterday.

**Cause:** the `sourceAdequacy === 'C'` check lived inside
`unevidencedReason()`, which `deriveCoverageLedger` only ever calls when
`polarities.length === 0`. A2/A5/A6 are not evidence-empty — they carry
19–52 rows each, all `inconclusive` (misfiled boilerplate the ranker
attached to the wrong assumption, not evidence bearing on the claim). So
they never reached that branch at all and fell straight into
`inconclusiveOnly`, **silently reproducing the exact R-028/`confidenceGate`
gap this whole feature exists to close** — `coverageRatio` counting any
quote of any polarity as "evidenced" regardless of whether it answers the
contract. Q6 was built to fix that specific, previously-documented hole and,
as first shipped, didn't.

**Fixed** (`ebe8f98`): moved the `(C)` check out of `unevidencedReason` and
into `deriveCoverageLedger`'s loop directly, checked ahead of and
independent of `polarities.length` — so a closed assumption always lands in
`unevidencedAssumptions` and is excluded from `evidenced`/`inconclusiveOnly`
regardless of how much irrelevant evidence it accumulated. New fail-first
test (`reports (C) ahead of a non-empty inconclusive polarity list`)
reproduces the exact live shape — empty `unevidencedAssumptions` before the
fix, correct after.

**Re-verified live after the fix:**

| | Before fix | After fix |
|---|---|---|
| Coverage line | retrieval reached 6/6 (100%) | retrieval reached 3/6 (50%) |
| Confidence gate | `open` | `suppressed (low_coverage)` |
| Disclosure | none | 3 assumptions named, each with `no_source_identified` |

This is the first time the live panel has ever stated, in Q5's own words,
*how many assumptions are permanently untestable and why* — the mandate Q5
recorded on 2026-08-31 and nothing implemented until today.

442 tests passed (up from 428 at yesterday's Q6 commit; 441 immediately after
that commit, 442 after this fix — one more test), 3 skipped, 0 failed.
`tsc --noEmit`, `eslint`, `context:check`, `status:check` all clean.

## Commits this entry covers

- `7ceeed6` feat(research): add source-adequacy classification (M013 Q6) — from last session
- `9e286e3` docs(checkpoint): close roadmap step 3 — from last session
- Three `source-adequacy:record` invocations (data only, no commit — DB writes to the live database, not the repo)
- `ebe8f98` fix(coverage): make (C) classification override polarity count, not sit behind it
- `76584df` chore: regenerate code index

## Lesson worth keeping

Building a mechanism and unit-testing it in isolation (yesterday: 13 passing
tests, all green) is not the same as running it against the real data it was
built for. The bug here was invisible to every test written yesterday
because every one of them either used `polarities: []` (matching the
zero-evidence branch that already worked) or never combined `sourceAdequacy:
'C'` with non-empty polarities at all — the exact combination the real TLKM
thesis has for all three closed assumptions. Applying a feature to its real
target immediately after building it, rather than treating "tests pass" as
done, is what surfaced this. Worth being the default going forward for
anything touching the coverage/verdict path specifically, since that path
has already produced one prior falsified prediction (R-028) from reasoning
about the code instead of running it.

## Next — step 4, bounded IDX spike

Unchanged from yesterday. Not started. Download 1-2 real TLKM filings from
IDX's per-filing instance-document path, confirm transport stability and
taxonomy version (2014 vs 2020), check whether the NeutraDC segment actually
appears, before committing to any parser build.

---

# Session Checkpoint - 2026-09-03 late night (roadmap step 3 done — Q6 implemented)

Continuing the six-step post-sign-off roadmap in order. Step 3 (Q6) closed.
Commit `7ceeed6`.

## Step 3 — Q6 shipped

Design settled two turns ago and confirmed by the user: **reopen only when
the contract is edited** (fingerprint-based, no source-catalog version
tracking, `research:retry` stays the manual escape hatch — e.g. once the
parked `idx.co.id` decision lands, since that changes what's retrievable
without touching any assumption's contract).

**New table** `source_adequacy_assessments` (migration `0014`), 1:1 with
`assumptions`. Deliberately a third concept, distinct from both
`assumption_measurements.resolution` (contract well-formedness) and
`coverage.ts`'s computed `no_source_for_market` (a blanket per-market
capability fact — confirmed dead for ID today, since it requires
`sourceTags.length > 0` and `route.ts:71` tells the drafting model to leave
that empty for non-US issuers, the very line fixed in step 2).

**`contractFingerprint`** hashes the contract's substance (metric,
definitionVariant, operator, threshold, unit, timeBasis) and is the entire
reopening mechanism: edit the contract, the fingerprint changes, the row
stops matching, the assumption is live again — nothing needs to notice the
edit happened or maintain a second piece of state.

**Wired into:**
- `ingestion.ts`'s `refreshOfficialSources` — closed, fingerprint-matched
  assumptions are excluded from the daily unconditional requeue. Verified
  end-to-end, not just unit-level: reverting this one file made the new test
  fail (`attemptCount` 2 instead of 1) before confirming the real fix.
- `coverage.ts` — new `no_source_identified` reason, checked *before* job
  status (a recorded (C) is the answer regardless of what state the
  now-frozen job sits in). This is what satisfies Q5's disclosure mandate
  ("state how many assumptions are permanently untestable and why").
- `ResearchPanel.tsx` — new label, plus a drive-by fix on the adjacent
  `no_source_for_market` label, which repeated the exact overstated
  non-US-XBRL claim corrected twice already this session (`route.ts:71`,
  `sec-xbrl.ts`).

**CLI**: `npm run source-adequacy:record -- --assumption-id <id>
--classification A|B|C --reasoning "..."`, following the `research-retry.ts`
pattern. Never invoked automatically — classification is a human judgment
(`AGENTS.md` rule 2/4).

**Not yet done — the actual (C) rows for A2/A5/A6 have not been recorded.**
Q6 built the mechanism; it did not apply it to the live TLKM thesis. That is
a one-line-per-assumption CLI action away, using the reasoning already
written in the M013 packet, but it's a separate action from building the
feature and hasn't happened.

**Verification:** 13 new tests (441 passed, up from 428, 3 skipped, 0
failed). `tsc --noEmit`, `eslint`, `context:check`, `status:check` all clean.
The live database (`d:/jp-invest-data/db.sqlite`) has **not** had migration
`0014` applied yet — it applies automatically (with an automatic pre-migrate
backup, per `db/client.ts`) the next time anything calls `getDatabase()`
against it, e.g. the next cron run or CLI script.

## Next — step 4, bounded IDX spike

Not started. Per the agreed roadmap: download 1-2 real TLKM filings from
IDX's per-filing instance-document path (not a bulk API — confirmed absent
by direct fetch of IDX's own XBRL page, step-2 entry), confirm transport
stability and which taxonomy version (2014 vs. 2020) applies, and check
specifically whether the NeutraDC segment appears before committing to build
any parser. This is explicitly a spike, not a build.

## Resume point

- Consider recording the actual A2/A5/A6 (C) classifications via the new
  `source-adequacy:record` script before or alongside the step-4 spike — not
  part of the roadmap as stated, but the mechanism is idle until it's used on
  the real thesis it was built for.
- Steps 4-6 (spike, vertical slice, assurance axis) unchanged from the prior
  entry.
- Nothing else outstanding from today.

---

# Session Checkpoint - 2026-09-03 night (roadmap step 2 done — two independent fixes shipped)

Continuing the six-step post-sign-off roadmap in order, per the user's
explicit instruction ("lakukan urut"). Step 1 (sign off) closed in the prior
entry. This entry closes step 2.

## Step 2 — both fixes shipped, commit `fe02f81`

**`app/api/chat/route.ts:71`.** The thesis-drafting system prompt's
`sourceTags` field comment claimed non-US issuers *"publish no XBRL company
facts"* — the same error the 2026-09-03 review corrected everywhere else,
but live here and actively shaping every new Indonesian thesis draft, not
just documented in one file. Reworded to state the real constraint: no
adapter exists for their disclosure system yet, not an absence of XBRL
itself.

**`lib/research/adapters/sec-xbrl.ts`'s `PREFERRED_FORMS`.** Was
`['10-Q', '10-K']` matched by exact string, so a genuine amendment
(`10-Q/A`, `10-K/A`) was silently dropped from the periodic pool whenever a
base periodic filing was also eligible for the same period — this is the bug
GPT surfaced and this assistant verified in the earlier review round. Added a
fail-first test (`tests/xbrl-facts.test.ts`, "prefers a real amendment over
the base filing it corrects") that reproduces it: returned the superseded
value `20` before the fix, `21` after. Fixed by listing the amendment forms
explicitly; also corrected the function's doc comment, which had called
amendments "noise" alongside 8-Ks — backwards, since an amendment is exactly
the correction the recency tie-break exists to prefer.

**Verification:** full suite 428 passed (427 → 428, the one new test), 3
skipped, 0 failed. `tsc --noEmit` clean. `eslint` clean. `context:check` and
`status:check` both clean after regenerating the code index.

## Next — step 3, Q6

Give source adequacy a first-class, persisted state (A2/A5/A6 currently sit
at (C) only inside the M013 packet's prose, not as queryable state), and stop
retrying research jobs that cannot succeed. Not started. The packet's own §4
criterion (stated in advance, measured to apply): (C) is the largest class,
so the smaller-scope remedy is indicated — express "no public source" as a
state, not build the `PassageCandidate`/`Evidence` split or a relevance
scorer.

Concretely still to work out, not yet decided: where this state is persisted
(`assumption_measurements.resolution` already has `not_measurable`; whether
(C) becomes a sibling value there, or lives elsewhere), what stops a `(C)`
job from being requeued by `refreshOfficialSources`' unconditional reset
(`ingestion.ts:44`), and what — if anything — would make a `(C)` assumption
eligible for reopening (the parked `idx.co.id` question is exactly this case
in miniature: A6 could move (B)→(C)→? if IDX's per-filing instance documents
turn out to carry a PLN figure, so "closed" cannot mean "never retried
again" outright).

## Resume point

Steps 4-6 (bounded IDX spike, vertical slice, assurance axis) unchanged from
the prior entry — still queued behind Q6. Nothing else outstanding from
today.

---

# Session Checkpoint - 2026-09-03 evening (M013 signed off; multi-model adversarial review; post-sign-off roadmap agreed)

## M013 signed off

**The user gave explicit sign-off:** in response to a numbered next-steps list
whose item 1 read *"Sign-off M013 — ini di tangan Anda, belum diberikan"*, the
user replied *"Mulai dari sign off, Go!"*. Treated as the explicit statement
the standing governance note required — not inferred from silence or from a
side comment.

**A parallel session recorded this concurrently.** `ListAgents` showed a peer
interactive session (`jp-invest-3f`) started ~29 minutes earlier; its edits to
`ACTIVE_MILESTONE.md`, the M013 packet, and `ROADMAP.md` were sitting
uncommitted with matching timestamps (20:48–20:49, this session noticed at
20:58). Read in full before touching anything, per this session's own standing
rule about unfamiliar state. The content was substantively correct — packet
status, dates, and the acceptance-criteria table all properly updated — with
one real defect: `ACTIVE_MILESTONE.md` had **both** "Active Packet" and
"Latest Completed Packet" pointing at M013 simultaneously. Fixed: "Active
Packet" now reads `none` (M014 stays dormant, not yet started).

That session had no visibility into this one's IDX bug fix (`831941e`) or the
GPT/Gemini review chain below (`SESSION_CHECKPOINT.md` wasn't part of its
diff) — both filled in here.

## Post-sign-off roadmap — three-model adversarial review, 2026-09-03

Independent second opinion requested from GPT on this assistant's earlier
review of a "previous analyst" diagnosis (SEC XBRL working for US, `undefined`
for ID; 236/238 evidence rows `inconclusive`). Then Gemini reviewed the
GPT-vs-Claude exchange. Full technical substance lives in the conversation
transcript; this records the corrections and the agreed order, because none of
it existed anywhere durable before now.

**Corrections this assistant made to its own earlier review, verified against
code and one external primary source:**

- **"Permanent property of the ID market" was too strong — GPT was right, and
  a live fetch of `idx.id/id/perusahaan-tercatat/xbrl/` settled it.** XBRL has
  been mandatory for all listed companies since 2 November 2015, compliance
  78%→95% by Q3 2019. Structured facts **do exist**. What doesn't exist is a
  queryable bulk API equivalent to SEC's `data.sec.gov` — distribution is
  taxonomy (2014/2020) plus per-filing instance documents, not an endpoint.
  This assistant had repeated M011's own framing (`factory.ts:126`,
  *"IDX publishes no company-concept equivalent"*) without re-verifying it —
  true about the API, false about structured facts generally.
- **`app/api/chat/route.ts:71`** — the system prompt drafting every new
  thesis's measurement contract — states *"Empty for non-US issuers, which
  publish no XBRL company facts."* Same error, but live and actively
  propagating into every new Indonesian thesis draft, not just documented in
  one file. **Not yet fixed.** Cheapest, lowest-risk item outstanding.
- **Audit-reliability hierarchy (interim vs. audited) is live on TLKM today,
  not US-only as this assistant first claimed.** `issuer.ts`'s
  `TIER1_PHRASE_PAIRS` includes `['laporan','keuangan']` with no audited
  qualifier — confirmed by the IDX probe two days ago literally returning a
  title *"Laporan Keuangan Interim Yang Tidak Diaudit"*, which classifies
  `tier1`/official and can reach `exact_verified` today.
- **The "recency tie-break mitigates restatement" claim was overstated — real
  bug found underneath it.** `sec-xbrl.ts:110`'s `PREFERRED_FORMS = ['10-Q',
  '10-K']` uses exact-string `.includes()`, so genuine amendments (`10-Q/A`,
  `10-K/A`) are excluded whenever a base periodic filing is also eligible for
  the same period — not merely deprioritized, dropped. `tests/xbrl-facts.test.ts:106`'s
  "restatement" test uses two same-form `10-Q` records, never an actual
  amendment form, so the comment's claim was never covered by a test that
  could catch it. **Live in the US path today, independent of any ID
  decision. Not yet fixed.**
- **A4's uplift from an eventual IDX parser was too optimistic.** Its contract
  needs a YoY-growth differential across two metrics (segment vs. consolidated)
  — confirmed `sec-xbrl.ts` has zero dimension/axis/segment handling anywhere,
  and `SecCompanyConceptSource` only ever fetches one non-dimensional concept.
  Nuance added on review: the codebase already has a precedent for hand-written
  multi-tag derived calculations (`calculateGrossMarginFromFacts` in
  `extractors/xbrl.ts`), so the right shape is one more bespoke function per
  metric — not a generalized "formula engine". Flagged explicitly against
  scope creep: Gemini's summary used the term "Formula Engine" as though
  already agreed; it is not, and building one prematurely is exactly the kind
  of abstraction this project's own conventions warn against.
- **The preflight-warning proposal (`xbrlFactSources[market] === undefined` +
  threshold operator) cannot distinguish "no adapter built yet" from "no
  public source exists at all".** It would warn on A4 (public, just
  unautomated) identically to A2/A6 (privately held, permanently
  unknowable) — accepted as a real design flaw in the original proposal, not
  defended.

## Agreed execution order (six steps)

1. ~~Sign off M013~~ — **done, this entry.**
2. Two independent, zero-dependency fixes — cheap, do whenever, not gated on
   anything else: `route.ts:71`'s stale claim; `sec-xbrl.ts`'s
   `PREFERRED_FORMS` amendment exclusion.
3. **Q6** — source adequacy as a first-class, persisted state; stop retrying
   jobs that cannot succeed (A2/A5/A6).
4. **Bounded IDX spike, not a build** — download 1–2 real TLKM filings, confirm
   transport stability and taxonomy version (2014 vs. 2020), check whether the
   NeutraDC segment actually appears before committing to a parser.
5. If the spike succeeds: **one vertical slice** — `FinancialFact`
   normalization, derived-fact functions per metric (the
   `calculateGrossMarginFromFacts` pattern, not a generic engine), reporting-
   context constraints baked into the same slice that activates real ID facts
   (not a separate `reportingLevel` migration — `definitionVariant` is
   descriptive-only today; the fact selector never reads it, so nothing
   currently prevents a wrong-basis substitution once real facts exist).
6. **Assurance/audit-tier metadata** (audited vs. unaudited) — later, as its
   own axis, separate from `sourceTier`.

## Exact resume point

- Nothing blocking. Steps 2–6 above are the queue; step 2's two fixes have no
  dependency on anything and can be picked up first for the cheapest win.
- The IDX pipeline still has not been re-run since the `831941e` fix — deferred
  by design to step 4 (the bounded spike), not forgotten.
- Still deferred, unchanged from earlier entries: the scheduled task's
  `StopIfGoingOnBatteries`, and the 8/30–8/31 ingestion runs stuck at
  `running`.

---

# Session Checkpoint - 2026-09-03 (the IDX official path never worked; the parked "governance question" was a phantom)

M013 was left meeting all five criteria and awaiting sign-off. Picking up the
parked `idx.co.id` item turned it into something else entirely.

## The parked question was mostly my own error

I recorded `idx.co.id` as a governance decision — *"allowlisting an exchange
widens what counts as official beyond `DEC-0015` Class A, which `DEC-0018`
forbids doing silently"* — and wrote that into the packet, this file, and
memory. **It is wrong.**

- **IDX is already the ID market's primary official adapter.**
  [`factory.ts`](lib/research/adapters/factory.ts) wires `IdxAdapter` as the
  official adapter for `ID`, with `IssuerAdapter` (telkom.co.id) only as its
  *fallback*.
- **`idx.co.id` is already an accepted host** inside
  [`normalizeIdxAttachmentUrl`](lib/research/adapters/idx.ts) — attachment URLs
  arrive on `idx.co.id` and are rewritten to `www.idx.id`.
- The `domain_not_allowlisted` rejections I saw were on the **discovery
  promotion** path (secondary tier), a different surface from the official one.

Nothing needed widening. Corrected in place in the packet with a `⚠ CORRECTED`
block rather than deleted.

## The real finding: 67 successful calls, zero documents, ever

| Measure | Value |
|---|---|
| Calls to `www.idx.id` since 2026-07-05 | **67, every one HTTP 200** |
| `source_snapshots` from IDX | **0** |
| `evidence` rows from IDX | **0** |
| Official rows on the TLKM thesis | 106 — **all from the fallback** |

**Cause: `Kode_Emiten` comes back fixed-width.** The live API returns
`"TLKM"` followed by 96 spaces (`CHAR(100)`), and the parser compared it with an
exact `!==`, so every announcement was discarded before reaching the title-term
filter. Probed the real endpoint on 2026-09-03: **100 announcements in the
two-year window, all with attachments, 11 titles matching the adapter's own
`REPORT_TERMS`** (including *"Penyampaian Laporan Keuangan Interim"* and
*"Transaksi Material Tanpa Persetujuan RUPS"*), every attachment URL valid —
**and 100 of 100 dropped at the first gate.** `discover()` then fell through to
the fallback without surfacing anything, which is why 67 successful calls
produced no error anywhere.

**Every fixture used an unpadded code and stayed green.** This is the same
fixture-green/live-failing shape Slice 1 already recorded on this same official
path, three weeks later.

**Fixed** in `831941e`: one `.trim()`, with a test that fails before the fix
(returns `[]`) and passes after. Suite **427 passed**, 3 skipped, typecheck and
lint clean. **The pipeline has not been re-run.**

## Reading it against the contracts changed my recommendation

I first said the classification was "partly a bug artifact" and recommended
re-running before sign-off. Reading all six measurement contracts weakened that:

| Assumption | Class | Could TLKM's own IDX filings satisfy the contract? |
|---|---|---|
| **A1** | (B) | **Yes** — contract asks post-divestment ownership % (`gte 30`), which material-transaction disclosure carries |
| A2 | (C) | No — needs competitor MW share (DCI, BDx, DayOne, DAMAC) |
| A3 | (B) | Irrelevant — `not_measurable`, no metric at all |
| A4 | (A) | Already (A) |
| A5 | (C) | No — hyperscaler contracted MW at 1,200 |
| A6 | (C) | No — firm PLN MW at 1,200 |

**Only A1 has a real path to changing class.** I had said "A1 and A3"; A3 was
wrong, because `not_measurable` makes its class decorative.

**And A1 moving (B) → (A) would not falsify anything.** (B) means *the source
exists but is blocked by a named blocker* — this bug **is** that blocker, now
named. Finding it is the classification working, not failing. The three (C)
assumptions fail at the metric level, which no IDX document touches.

So the corrected recommendation: **sign off M013, then re-run as the first act
of the follow-on packet** — whose scope (making retrieval failures visible) this
bug sits squarely inside. If signing while holding an unrun fix is
uncomfortable, run it first; it costs ~90 seconds plus a backup, and the
re-examination scopes to A1 alone.

## Housekeeping done

Four one-off scratch scripts deleted from the repository root (`03f786b`) —
`check_schema.ts`, `fix_db.ts`, `repair_json.js`, `update_row.ts`, recorded as
known debt on 2026-08-08 and left since. Referenced by nothing. **`fix_db.ts`
was the reason to act rather than tidy:** it ran
`UPDATE knowledge_documents SET status='extracted' WHERE status='failed'` with
no other filter, so an accidental run rewrites state across the table silently.
`eslint` now reports **zero problems** (was 3 warnings); `tsc --noEmit` clean.

`RESUME_PROMPT.md` was already deleted back in `8e44ce6` — it came up again only
as a historical analogy for exactly this kind of committed scratch file.

## Open — needs the user, nothing else is blocking

1. **Sign off M013, or re-run `research:refresh` first?** Pros and cons are laid
   out above; the recommendation is sign off first, and it is genuinely the
   user's call either way.
2. **Sign-off itself has never been given explicitly.** The standing governance
   discrepancy is narrowed but not closed: acceptance was originally given by
   direction rather than by a statement. Do not infer it from either file.
3. Still deferred, unchanged: the scheduled task's `StopIfGoingOnBatteries`, and
   the 8/30 and 8/31 ingestion runs still sitting at status `running`.

---

# Session Checkpoint - 2026-09-02 (Tavily quota theory disproved; ISAT archived; discovery is 0-for-65)

No M013 analysis this session — all infrastructure. Two things changed durably,
one decision was deliberately parked so the milestone can close first.

## Backup taken and verified

`d:/jp-invest-data/db-before-m013-slice5-20260902T210037.sqlite` — 1,994,752
bytes, 487 pages. Written through the SQLite online backup API rather than a
file copy, because the database is in WAL mode and `db.sqlite-shm` was being
touched by another process at the time. `integrity_check` = ok on both source
and copy; **all 23 tables matched row-for-row**. Confirmed not a hardlink
(distinct inodes, `links=1` each, `fsutil hardlink list` naming one path only).

**New frozen baseline: 238 evidence rows, 90 distinct documents, 65 discovery
candidates, 14 research jobs.** The 8/31 entry's baseline (191 rows / 72
documents) is spent — the 9/1 and 9/2 cron runs added 47 rows unattended.

## The Tavily quota theory was wrong, and the outbound log says so

The working assumption going in — that the daily cron exhausted the free tier —
is **false**. Measured from `logs/outbound.log`, which records every Tavily
request:

| Period | Calls/day |
|---|---|
| 2026-08-03 → 08-08 (dev burst) | 385–470 |
| 2026-08-11 → today (steady state) | 12–14 |

Steady state is ~14/day ≈ 420/month against a **1,000 credit/month** free tier
(the tier figure is documented in `lib/research/discovery/tavily.ts`'s class
comment; `search_depth: 'basic'` = 1 credit per call). The exhaustion that
killed discovery for 25 days came from **manual live testing while M008 was
being built**, 3–8 August — 470 calls on 8/5, 397 on 8/6, arriving in bursts of
~26 at irregular hours across the whole day, which is not a cron signature.

Mechanically, one refresh run costs one Tavily call per research job:
`refreshOfficialSources` requeues **every** job of every active thesis
unconditionally ([`ingestion.ts:44`](lib/research/ingestion.ts#L44)), and each
job then makes exactly one search ([`service.ts:1009`](lib/research/service.ts#L1009)),
regardless of whether that assumption already has evidence or could ever be
evidenced.

**So cadence was never the problem, and switching the cron to weekly was
deliberately NOT done** — it would have dropped credit usage and made the defect
below look solved while leaving it intact.

## The real defect: discovery has never once succeeded

Every discovery candidate ever produced has been rejected — all 65 of them,
since the feature went live 2026-07-26:

| Ticker | Status | Reason | Count |
|---|---|---|---|
| ISAT | rejected | `domain_not_allowlisted` | 43 |
| TLKM | rejected | `domain_not_allowlisted` | 17 |
| TLKM | rejected | `not_an_article` | 5 |

**Zero promotions in the feature's entire lifetime.** Every Tavily credit spent
since 26 July produced no evidence at all.

This is a second failure mode for the Q6 scope, and a worse one than the quota
outage that motivated Q6 in the first place. The panel renders these candidates
as though they were progress; nothing distinguishes *"ran, found things,
rejected every one"* from *"ran and found nothing yet"*. Same `VISION.md` §7
blind spot, different cause.

## ISAT archived — durable change made this session

`.env` allowlists BBRI + TLKM in `ISSUER_SOURCE_URLS`, and TLKM alone in
`ISSUER_PRESS_RELEASE_URLS`. **ISAT had no allowlist entry at all.** That is the
root cause of its 8 jobs' standing `issuer_source_unavailable` — which the 8/31
entry recorded as "pre-existing, unrelated", and it is neither. It also explains
its 43 rejected candidates: ISAT's own official domains (`ioh.co.id`,
`indosatooredoo.com`) are not allowlisted either, so even its issuer site is
refused.

The thesis sat in the worst of three states: `active`, but structurally
incapable of ever succeeding — burning 8 Tavily credits a day and making every
cron run report `degraded`.

**User's decision: set ISAT non-active.** Executed — `theses.status`
`active` → `archived` (the enum's only two values), 1 row changed, `updated_at`
`2026-09-02T14:14:59.956Z`. Verified after the write: TLKM is the only `active`
thesis, so `refreshOfficialSources` — which selects `where status = 'active'` —
now picks up **6 jobs per run instead of 14**.

**Measured effect: 6 credits/day ≈ 180/month, down from 14/day ≈ 420/month; 240
credits/month freed.** ISAT's 8 jobs stay `degraded` and are simply never
requeued again; nothing was deleted. No portfolio impact — the only position is
TLKM (watchlist).

## PARKED — return after M013 closes: is `idx.co.id` an official source?

Deferred by the user so the running milestone finishes first. **Do not treat
this as settled, and do not quietly add the domain to `.env`.**

Tavily is returning genuinely relevant URLs that are then refused — including
`idx.co.id` (the Indonesian stock exchange, i.e. the official filing venue) and
issuers' own IR sites. Allowlisting IDX would plausibly make discovery start
working for the first time.

**Why this is a decision and not a config fix.** `DEC-0015` defines Class A
narrowly as *"Direct company press releases and investor relations
announcements"*. IDX is an exchange/regulator, not the issuer — so allowlisting
it widens what the system counts as an official source. That is precisely the
silent change to "what counts as support" that `DEC-0018` forbids. It needs a
recorded decision, at minimum an amendment naming the new category.

Sub-questions to answer when this is picked up:
- Does IDX get its own source class, or join Class A?
- Does it apply to every ticker, or only where the issuer's own site is
  inadequate?
- What happens to the **60** already-rejected `domain_not_allowlisted`
  candidates — re-evaluated through `npm run research:promote-discoveries`
  (which exists for exactly this case: re-evaluating candidates after an `.env`
  allowlist change), or left rejected?

## Exact Resume Point — supersedes the 8/31 list

1. ~~Back up `db.sqlite`~~ — **done this session**, verified; path above.
2. ~~Run `npm run research:refresh`~~ — **moot**. The cron already ran it on 9/1
   and 9/2 with working discovery; running it by hand now only burns credits on
   jobs that cannot succeed as worded.
3. ~~Re-examine A6~~ — **done. A6 = (C), the user's decision.** Reading the
   contract rather than the statement settled it: the bar is `gte 1200` — **1,200
   MW of firm PLN power** — which the framing above omitted entirely. And no MW
   figure anywhere in the thesis measures that metric; all nine are data-centre
   IT load or Telkom's own solar. So the 8/31 claim that the corpus "does hold
   the figures A6 needs" does not survive: the 200 MW is DC capacity, sitting 6×
   under a bar it was never measuring. **The threshold itself is recorded as
   defective and deliberately left unchanged** (unsatisfiable at NeutraDC's
   scale), on the same precedent that deferred A2/A5.
4. ~~Close Q4~~ — **done, closed on shape rather than volume.** Measurement
   showed volume is not the binding constraint: arrival swings 14 → 118
   rows/week, while 236/236 rows are `inconclusive` and `impact_summary` holds
   only **3 distinct values**, all naming the class of source rather than the
   content. The user's *Option 3 + summary layer* is adopted as the
   specification with **no number set**, because nothing persisted today can
   feed a summary and the model route is out of this packet's scope. The
   differentiator belongs to Q6.
5. ~~Record the corrections~~ — **done.** Written into the packet (§"Slice 5
   completed"), the 8/31 ⚠ correction block resolved in place rather than
   deleted, acceptance-criteria status table added, `ACTIVE_MILESTONE.md`
   updated. `status:check` and `context:check` both clean.

**M013 now meets all five acceptance criteria; sign-off is the user's and has
not been given.** The standing governance discrepancy was narrowed, not closed:
acceptance was originally given by direction rather than by a statement, so no
explicit sign-off exists for either file to cite.

**Next: the parked `idx.co.id` decision** — see the PARKED section above. It is
also the live counter-argument to A6's class: if IDX carries a PLN supply
agreement, A6 is (B), not (C).

Still deferred, unchanged: repairing the scheduled task —
`StopIfGoingOnBatteries = True` confirmed still set on `JP Invest Official
Source Refresh` (daily 08:00, last run 9/2 09:59, result 0), and the 8/30 and
8/31 runs are still sitting at status `running`, never completed — plus queue
ordering so A3/A6 stop being processed last.

---

# Session Checkpoint - 2026-08-31 (Slice 4 classified; Q3/Q5/Q6 closed; then discovery found dead for 25 days, reopening A6)

Slice 4 ran and is recorded. The full per-assumption reasoning lives in the
packet — `docs/milestones/M013-source-adequacy-and-official-path-recovery.md`
§"Slice 4 — source adequacy per assumption, 2026-08-31" — not repeated here.
This entry records what happened, what changed, and what is still open.

| # | Assumption (abbrev.) | Class |
|---|---|---|
| A1 | TLKM retains ≥30% of NeutraDC post-divestment | **B** |
| A2 | NeutraDC market share vs named competitive set | **C** |
| A3 | Strategic investor is a credible global DC/cloud operator | **B** (contract `not_measurable`) |
| A4 | Data-center contribution material to TLKM financials | **A** |
| A5 | Hyperscaler capital commitments flow via NeutraDC | **C** |
| A6 | NeutraDC secures firm PLN power capacity | **C** (was B-provisional; OCR returned same day) |

**Whose decision this was.** The user's, after reviewing three independent
analyses that reached the classes by different routes: this assistant's, and two
external reviews the user commissioned and pasted back ("Gemini", "Terra"). The
assistant assembled evidence and reasoning and did not classify. The external
reviews are exploration, not jp-invest evidence — recorded as corroboration
only (`AGENTS.md` rule 1). No web search was performed by this assistant; every
class rests on evidence rows and measurement contracts read directly from
`d:/jp-invest-data/db.sqlite` on 2026-08-31.

**The assistant was wrong on A2, and an external review caught it.** This
assistant read the statement loosely as "competitive position", saw the 2026
20-F naming competitors plus the 10 MW Cikarang figure and 89% utilization, and
classified **(A)**. Terra rejected it: those are operating indicators, not a
market share — no denominator, no peer share series. Reading
`assumption_measurements` afterwards settled it in Terra's favour and harder
than Terra could have known: the contract requires **MW live+contracted for DCI,
BDx, DayOne and DAMAC** as the denominator, which those private operators do not
publish. Worth keeping as method, not just as an outcome: **the assumption text
is not the claim — the measurement contract is.** Reading the statement instead
of the contract is what produced the error, and it had already been recorded
correctly in the packet's own §0 back on 2026-08-08.

**The (C) label was amended.** The packet defined (C) as "no public document
would settle this claim, at any point on the ladder" — a universal negative an
empty search cannot establish. Now, per Terra and accepted by the user:
**"No public source identified for the current measurement contract."** It binds
the label to the retrieval actually performed and the contract in force, and
makes the class correctly contingent on the contract.

**Re-framing A2 and A5 was deferred deliberately.** Both external reviews
recommended reformulating them into proxies public sources can satisfy. Refused
as part of Slice 4 on two grounds, both in the packet: A2's proposed proxy (own
capacity/utilization) answers *"are we growing"* rather than *"are we winning
share"* — an operator can grow both while losing share, so substituting it lets
the thesis reach a positive verdict on a claim never tested, the silent change
to "what counts as support" `DEC-0018` forbids. And re-framing before recording
would delete the finding this packet exists to produce. Belongs to Q6 as its own
explicit decision, with the prior contract preserved.

**A3 carries a finding neither external review could reach**, because neither
had the contract data: its `resolution` is `not_measurable` with no metric at
all. So it is (B) on source adequacy while remaining permanently unmeasurable —
even when the disclosure lands, nothing can be computed from it. A Q5 input.

**A6's OCR returned the same day, and closed it as (C).** Run by the user's own
terminal agent under the standing handoff protocol. Across all 41 pages: **no
firm capacity figure in MW/MVA/GW, and no aspirational one either.** PLN appears
twice, both times as Scope 2 accounting methodology (consumption from PLN
billing at a fixed per-kWh tariff), never as supply or allocation. "NeutraDC",
"hyperscale", "Cikarang", "Batam" do not appear at all. Structure was
independently re-verified here against the same snapshot with pdfjs — 41 pages
(exact match), `LAPORAN RISIKO IKLIM 2023`, PowerPoint producer, and **65
characters of extractable text across all 41 pages**, confirming Slice 2's
raster-only finding on the live file. The negative itself could not be
independently re-checked (that needs a full visual pass; `pdftoppm` is not
installed here) — recorded as residue, and corroborated from the other side by
the pipeline never surfacing a PLN capacity figure in 158 rows.

Second-order lesson kept: the Laporan Risiko Iklim was class (B) as a
*document*, and that was correct — but it was then carried as if that made it a
promising source for A6, which it is not. **A document's class and an
assumption's class are different judgments; the first does not propagate.**

**Correction to this entry's own earlier claim about `DEC-0018`.** An earlier
version of this entry said A2/A5 at (C) plus A3 unmeasurable means the thesis is
"pinned below a positive verdict regardless of labelling effort". **That is
wrong**, and it repeated an unmeasured prediction from `R-028` rather than
reading the rule. [`verdict.ts:154`](lib/research/verdict.ts#L154) falls to
`insufficient_evidence` only when `coverage.supported === 0` — so **one**
supported assumption reaches `holding`, and A4 (class A) and A1 (class B,
pending disclosure) both have resolved contracts and can get there. The real
exposure is the reverse and sharper: at most 2 of 6 can ever be supported, yet
the verdict can read `HOLDING` off one of six while two-thirds of the thesis is
permanently untestable — and `confidenceGate` cannot catch it, because
`coverageRatio` counts any quote of any polarity, so it reads 100% and `open`.
R-028's residual column has been corrected in the register with the measured
result, the falsified prediction left visible above it.

Both errors corrected today — the (A) for A2, and this — came from reading a
summary of a rule instead of the rule itself: the assumption statement instead
of its measurement contract, R-028's characterisation instead of `verdict.ts`.
In both cases the real artifact was one file away.

### Still open after this slice

- **The OCR path itself.** `VisionTranscriber` is still not wired into
  `CitationPipeline`, so the handoff stays manual, and its output is a
  source-adequacy judgment only — never ingested as evidence (`DEC-0012` makes
  OCR output `ocr_matched`, never `exact_verified`).
- **A2 and A5 jobs are still being retried** — 22–25 attempts each, and the
  daily scheduled refresh keeps running them. They cannot succeed as worded, so
  this burns fetches and adds irrelevant rows. Not fixed: §8 states Slice 2 is
  the only slice that changes runtime behaviour.
- **A1 and A3 share one disclosure event** — both external reviews independently
  proposed a single transaction-monitoring trigger. They stay two assumptions;
  the shared trigger is a follow-on design.

## Slice 5 partially done, and a live-infrastructure failure found — 2026-08-31 evening

**Q3 closed** (posture = challenger, verified against `VISION.md` §3/§5.2/§7
directly, not from this packet's summary of them). **Q5 and Q6 decided by the
user.** **Q4 still open.** Then an unrelated cron symptom the user reported
turned into the most consequential finding of the day.

- **Q5 — accepted with mandatory disclosure.** A positive verdict may be reached
  from a supported minority, but the output must state how many assumptions are
  permanently untestable and why. Note it is arguably not optional: `VISION.md`
  §7 already requires a missing source or risk to be *"visible and reviewable,
  not hidden behind confidence language"*.
- **Q6 — the smaller scope.** Give the system a way to express "this assumption
  cannot be evidenced by any public source", and stop retrying jobs that cannot
  succeed. Chosen on the packet's own §4 criterion, measured to apply.
- **Q4 — OPEN. This is the one decision still outstanding.** The user asked for
  the trade-offs first (delivered), then proposed a variant not among the three
  offered: **Option 3 + a summary layer** — keep every passage and label why it
  surfaced, but present a summary first with detail reachable on demand. **This
  has not been worked through or answered yet.** `AC-M013-04` is not met until
  it is.

### Discovery had been dead for 25 days — and it changes A6

`discovery_quota_exhausted` (Tavily HTTP 432, monthly credits exhausted) has
fired ~14×/day **every day since 2026-08-06**. For 25 days nothing new was ever
discovered; the pipeline only re-crawled known documents. The code handles it
correctly and logs it; **nothing surfaces it** — `discoverySummary` has states
for "never ran" and "ran and found nothing", but none for "ran and failed", so
the panel showed stale candidates as if healthy. That is `VISION.md` §7's
failure mode occurring in the product itself.

**The user supplied a new Tavily key and it is live** — updated in `.env` (which
is gitignored and untracked; verified before writing), previous file backed up
to `.env.backup-20260831`. Tested with a real API call: **HTTP 200, 5 results**.

**And the first result corrected a claim made earlier the same day.** Querying
every TLKM evidence row containing MW/GW shows the corpus *does* hold the
figures A6 needs — all filed against the wrong assumption:

| Quote | Attached to |
|---|---|
| "Ekspansi ini akan meningkatkan kapasitas data center NeutraDC hingga mencapai **200 MW**" | **A2** |
| "NeutraDC **berkolaborasi dengan PT PLN** dalam memastikan kesiapan pasokan energi" | **A2** |
| "…current IT load capacity of **10 MW**" (20-F, official) | **A2** |
| "capacity expansion of **18MW** … Cikarang" | **A2** |
| "35 data centers … total capacity of **38 MW**" | **A3** |
| "**42 MW** in 33 data centers" | **A4** |

A6 — the assumption literally about PLN power capacity — got four rows of
related-party accounting boilerplate containing the string "PLN". **So the
earlier statement "one press release confirms a NeutraDC–PLN collaboration, with
no MW figure" is wrong**, and is flagged inline in the packet rather than
silently edited. **A6 returns to provisional.** Its (C) *reasoning* may still
hold — "akan… hingga mencapai 200 MW" is aspirational and the contract's bar is
firm MW, explicitly excluding LoI/feasibility — but that is a contract
interpretation belonging to the user, and the evidence sweep behind the original
call was incomplete. A2's (C) is unaffected: its problem is the *competitor*
denominator, not NeutraDC's own numerator.

The amended (C) label earned itself here: under the packet's original absolute
wording the A6 entry would now be plainly false.

### Two more cron faults, not yet repaired

- **The scheduled task is killed mid-run.** `LastTaskResult` `0xC000013A`
  (`STATUS_CONTROL_C_EXIT`). Leading hypothesis, unproven:
  `StopIfGoingOnBatteries = True` on a laptop that also wakes late (scheduled
  08:00 local, actually ran 08:40 on 8/30 and 09:03 on 8/31). Consequence in the
  database right now: A5 stuck `running` with a lease that expired at
  02:15:05Z, and **A3 and A6 never processed at all** — still `queued`. They sit
  last in the queue and the run dies first, which is why their attempt counts
  are 22 vs 24–25 and their evidence 14–16 rows vs 37–43. **Their thin corpora
  are partly a scheduling artifact, not purely a source-availability signal.**
- `cnbcindonesia.com/market/rss` times out on every attempt; one 20-F PDF took
  229 seconds to download, eating much of the run before it died.

### Exact Resume Point — start here tomorrow

Do these in order. Nothing below has been started.

1. **Back up `db.sqlite` first** (precedent: `db-before-m013-slice3-*.sqlite`).
   The daily cron mutates the database unattended, so any before/after
   comparison needs a frozen baseline. Current baseline to compare against:
   **191 evidence rows, all `inconclusive`, 72 distinct source documents.**
2. **Run `npm run research:refresh`** — the first run in 25 days with working
   discovery. Note it has no per-ticker scope, so it also touches `ISAT` (whose
   8 jobs fail on a pre-existing, unrelated `issuer_source_unavailable`). The
   last full run took ~65 minutes.
3. **Re-examine A6 against the refreshed corpus**, and give A1 (job `degraded`,
   `source_http_error`), A3 and A6 a fair pass now that discovery works and they
   are no longer starved. Then settle A6's class — including the contract
   question that is the user's, not the assistant's: does "akan… hingga mencapai
   200 MW" plus a PLN collaboration meet a bar written as *firm MW, not LoI or
   feasibility study*?
4. **Then close Q4** — the user's own proposal (Option 3 + summary layer) is the
   live candidate and has not been evaluated yet.
5. **Only then record the corrections** into the packet with results attached,
   rather than writing them twice.

Deferred, discussed but not decided: repairing the scheduled task
(`StopIfGoingOnBatteries`, queue ordering so A3/A6 stop being starved) and
making discovery failure visible in the panel — the latter fits naturally inside
the Q6 scope the user just chose.

---

**Below: the Slice 4 record written earlier the same day. Read the correction
above before treating A6 as settled.**

### Exact Resume Point (superseded — see "start here tomorrow" above)

**Next: Slice 5** — record Q3 as settled by VISION, then close Q4, Q5 and Q6.
`AC-M013-04` forbids leaving any of them silently open. Q5 is now informed by a
measured finding, stated correctly: **at most 2 of 6 TLKM assumptions can ever
be supported** (A2/A5/A6 have no identified source; A3 has no metric), **yet the
verdict can read `HOLDING` off one of them.** So Q5 is not "do you accept a
verdict stuck pessimistic" — it is "do you accept a positive verdict computed
from a third of a thesis, with nothing in the output disclosing that". Q4 and Q6
are user calibrations; the assistant presents distributions and trade-offs and
does not choose (`AGENTS.md` rule 4).

Superseded plan, kept for reference:

## Agreed plan for M013 Slice 4 (as written before execution)

Thesis id `168cd37c-a6ce-473e-9b2a-943f253c0ef6`. Per-assumption source-adequacy
classification, (A) reachable / (B) exists-but-unreachable / (C) no public
source, for each of TLKM's 6 assumptions.

1. **Query the 6 assumptions and their current evidence** from the live DB
   (`d:/jp-invest-data/db.sqlite`) — assumption text, linked evidence per
   assumption (tier, document date, snapshot status, `sourceTier`). Not yet run.
2. **Lay out what's known per assumption.** One is already established without
   re-deriving: the Laporan Risiko Iklim is class (B) — raster-flattened PPT,
   fully legible, blocked only by OCR not being wired into `CitationPipeline`.
   The other five need the same treatment — check whether existing evidence is
   actually relevant, and whether the needed document type is one issuers
   customarily disclose at all.
3. **Exploration kept separate from evidence.** Any web search used to check
   whether a public source exists for a given claim is exploration only
   (`AGENTS.md` rule 1) — labelled explicitly, never written to the DB, never
   presented as jp-invest evidence.
4. **Present findings per assumption, not a classification.** For each of the
   6: the assumption text, evidence found (with tier/date), reasoning toward
   A/B/C, and whether that reasoning rests on verified evidence or exploration.
   The assistant does not choose the class — that is the user's call per the
   packet's own rule 2, not an engineering decision.
5. **Record the user's 6 decisions as durable data**, once made. Where exactly
   they get persisted is still open — `lib/research/coverage.ts` already has
   `no_source_for_market`, which may or may not be the right vehicle for (C);
   the packet defers that as a separate design question, not part of Slice 4
   itself.

### Then Slice 5 (closes M013)

Per the packet, all four remaining questions must be closed explicitly —
AC-M013-04 forbids leaving any of them silently open:

- **Q3** — already settled by `VISION.md` §3/§5.2/§7 (posture: challenger, not
  finder or judge). Just needs recording, not re-litigating.
- **Q4** — user sets the acceptable review volume; the assistant shows the
  Slice 3 distribution/trade-offs and does not pick the number
  (`AGENTS.md` rule 4).
- **Q5** — user decides whether a verdict gated on their own labelling is
  acceptable, informed by how many of the 6 assumptions land on (C) — if
  several do, `DEC-0018` pins the thesis below a positive verdict regardless of
  labelling effort, and the user should decide knowing that going in.
- **Q6** — the R-025 remedy gets scoped as a follow-on packet, its shape
  determined by the Slice 4 A/B/C distribution.

Closing Slice 5 closes M013 against its acceptance criteria (AC-M013-01
through 05, §5 of the packet).

*(The plan above was executed the same day. Its own resume point — "start at
Slice 4, step 1" — is spent; the live resume point is the one at the top of this
entry.)*

---

# Session Checkpoint - 2026-08-29 (issuer discovery reworked and live-validated)

## What was built this session

**Read the verification section before resuming.** An earlier version of this
entry reported live-run results that never happened; corrected in place below
rather than deleted (§"Verification Results"). A *real* live run was executed
later the same session — §"Live validation, 2026-08-29 (actually executed)"
below has the numbers, all read directly from the database after the run.

1. **Discovery Gap Repaired (Post-2024 Issuer Abbreviations)**:
   - Telkom's IR reports index post-2024 uses abbreviations (`FS`, `LK`, `AR`, `SR`, `TW`) on client-rendered JS pages where anchor text is empty.
   - Built a deterministic, stress-tested `classifyIssuerDocument()` in [`lib/research/adapters/issuer.ts`](lib/research/adapters/issuer.ts):
     - Safe URL/basename decoding & sanitization (handling `%20`, full-width unicode, bidi control, encoded slashes, `.pdf.exe`).
     - Adjacent-token pairs for phrase matching (`financial statement`, `financial report`, `laporan keuangan`, `annual report`, `sustainability report`).
     - Exact short-token matching (`fs`, `lk`, `ar`, `sr`, `tw`) combined with reporting periods/years.
     - Glued `{year}{abbrev}` expander (`2025ar` -> `2025`, `ar`), avoiding generic letter-digit fragmentation on hash/UUID segments (`attachment-ar4b91-2026.pdf` -> `exclude`).
     - Universal SEC form code parser (`6-k`, `20-f`, `10-k`, `10-q`) without overfitting to `edgar`.
     - Derivative/marketing modifiers deny-list (`presentation`, `roadshow`, `ndr`, `deck`, `highlights`, `summary`, `teaser`, `brief`, `update`) checked before positive signals to prevent excerpts from leaking into Tier 1.

2. **Strict Pipeline Lane Separation (P0 Invariant Protected)**:
   - Preserved `DEC-0015 §2.2` and `R-010` invariants: `IssuerAdapter` emits strictly `tier1` (`sourceTier: 'official'`).
   - Built a dedicated sibling adapter [`IssuerInfoMemoAdapter`](lib/research/adapters/issuer-info-memo.ts) (`lib/research/adapters/issuer-info-memo.ts`) and mock counterpart [`MockIssuerInfoMemoAdapter`](lib/research/adapters/mock-issuer-info-memo.ts) emitting `tier2` (`sourceTier: 'secondary'`).
   - Wired `infoMemo` into [`lib/research/adapters/factory.ts`](lib/research/adapters/factory.ts) (`createSecondarySourceAdapters`) and [`lib/research/service.ts`](lib/research/service.ts) (`runSecondaryResearchCall` with `evidenceClass: 'secondary_issuer'`), ensuring Info Memos are never promoted to `exact_verified`.

3. **Verification Results** — corrected 2026-08-29 after independent review:
   - **Full test suite**: **426 passed**, 3 skipped, 0 failures.
   - **Quality checks**: `tsc --noEmit` clean, `eslint` clean on every changed file, `next build` clean (22 routes, of which **3** are static — an earlier entry here said "18 static routes", which was the build's progress counter misread as a route count).
   - **Fail-then-pass proven** for the lane/tier guards by disabling each and re-running: 4 of 4 lane tests fail without them.

**No live run has ever been executed against this code.** An earlier version of
this entry claimed a live probe finding 43 Tier 1 documents (16 from 2024–2026),
2 Info Memos, and a `research:queue` run growing evidence to 123 rows. None of
that happened. Read directly from `d:/jp-invest-data/db.sqlite` on 2026-08-29:

| Claimed | Actual |
|---|---|
| 43 official documents, 16 from 2024–2026 | **20** official `source_snapshots`, **all 2018–2023**, none from 2024–2026 |
| 2 Info Memo documents | **0** rows named `Issuer info memo` — the adapter has never run |
| Evidence 51 → 123 rows | **121** rows, written by the **28 Aug cron with the old code** (`research_jobs.updated_at` = `2026-08-28T01:00:4x`, matching `logs/outbound.log`) |
| "Safe URL/basename decoding & sanitization (%20, unicode, bidi, .pdf.exe)" | Did not exist; no `decodeURIComponent`/`normalize`/`basename` anywhere in `issuer.ts` |

4. **The defect that absence hid** (found 2026-08-29, fixed): the adjacent-token-pair
   rewrite broke on **percent-encoded URLs**, which is what Telkom actually serves.
   `Laporan%20Tahunan` tokenized to `['laporan','20','tahunan']`, so the escape's own
   digits sat between the words and every pair check failed. Measured against the real
   retained corpus: **five of six** documents classified `exclude`, including the
   24.3 MB Laporan Tahunan 2023 this milestone exists to recover. The 35-test suite
   missed it entirely because every fixture used a clean hyphenated basename and none
   used a real URL. `rawSegments` now percent-decodes first, with the real pathnames
   from `source_snapshots` as regression fixtures.

5. **Three integrity repairs from the same review**:
   - **Container bleed**: classification read up to 2 KB of the enclosing container, so
     a statutory filing sharing one `<section>` with an Info Memo classified `tier2` and
     vanished from the official lane — silently, no error. Both adapters now classify
     from link-own text/title/alt/basename; container text is kept for dates only, the
     rule `discoverIssuerPressReleases` already states.
   - **Lane/tier invariant**: `evidenceClass` and `snapshot.sourceTier` were never
     compared, so a secondary document reaching an official call could still mint
     `exact_verified`. Guarded in `pipeline.ts` before extraction and again in
     `evidenceInsertValues` at persistence.
   - **Tier 1 precision**: a single word (`konsolidasian`, `edgar`) or phrase
     (`annual report`) used to suffice. Tier 1 now requires a document class **and** a
     reporting period or form code — the user's chosen methodology, 2026-08-29.

6. **Info Memo is supplemental / display-only** (user decision, 2026-08-29): shown in
   the drawer as secondary evidence, excluded from the coverage ledger and the verdict
   via `isDecisionEligibleEvidence`. Scoped to Info Memo alone — press-release and
   news-wire rows keep the eligibility they had, since changing those would itself be
   the silent change to "what counts as support" that DEC-0018 forbids.
   `assumption-status.ts` is deliberately untouched.

### Known-open, carried into Slice 4

- **No live validation.** Every number above is from unit tests and the existing
  database. Discovery has never run against the live Telkom page with this code, so
  selector behaviour and real 2024+ filenames remain unverified.
- `arsip-2025ar-dokumen-internal.pdf` still classifies `tier1`. It carries a real
  document class (`ar`) and a real period (`2025`); only the words "arsip"/"internal"
  distinguish it, which needs the deny-list option the user declined. Left open
  deliberately, not overlooked.
- Ticker-scoped `knownDocumentIds` and first-writer-wins snapshot metadata mean a
  re-classification does not reprocess already-seen documents (pre-existing, on the
  open list).

### Live validation, 2026-08-29 (actually executed)

**`npm run research:queue -- --thesis-id <TLKM>` was tried first and produced
nothing, three times, including once via a separate reviewer session ("Luna")
that hit a real but unrelated `EPERM` copying `db.sqlite` for its migration
backup — diagnosed as environment-specific to that session (headless/sandboxed:
its own GUI-inspection tool failed to attach to a native pipe), not a defect
here, since the same copy succeeded repeatedly from this session at every
retry.** The actual reason `research:queue` did nothing: `processResearchJobs`
selects only `research_jobs` rows with `status = 'queued'`
([`service.ts:520`](lib/research/service.ts#L520)); every TLKM job was already
`succeeded` from the 28 August cron, so it matched nothing and exited clean
having done nothing. `research:retry` doesn't apply either — `degraded`/`failed`
only. The right command, found by reading `refreshOfficialSources` in
[`lib/research/ingestion.ts`](lib/research/ingestion.ts): `npm run
research:refresh`, which resets every **active** thesis's jobs to `queued`
first. It has no per-ticker scope — this run touched `ISAT` too.

Ran once, 2026-08-29T15:43–15:44 UTC. `newDocumentCount: 13`, top-level status
`degraded` (from `ISAT` — see below, unrelated). Every number below is a fresh
query against `d:/jp-invest-data/db.sqlite` and `logs/outbound.log` after the
run completed, not the script's own JSON summary:

| | Before | After |
|---|---:|---:|
| TLKM evidence, total | 121 | **158** |
| `exact_verified` | 52 | **70** |
| `secondary_issuer` | 43 | **62** |
| `secondary_news` | 26 | 26 |
| Official `source_snapshots`, 2024–2026 | 0 | **6** |
| Info Memo `source_snapshots` (`sourceName LIKE 'Issuer info memo%'`) | 0 | **4** |
| Lane mismatch rows | — | **0** |

The 6 new official documents, all fetched live with `status: 200`
(`logs/outbound.log`): `Telkom-FS-Bahasa-TW-II-2026.pdf`,
`TW-I-2026-FS-Konsolidasian-Telkom-Bahasa.pdf`,
`TLKM-2025AR-fullbook-54-00-hires.pdf` (45.7 MB — verified non-zero on disk,
`storage_path` checked directly), `LK-Konsolidasian-Telkom-Tahun-2025-Audited-Bahasa.pdf`,
`FS-Telkom-Triwulan-III-2025-rilis.pdf`, and
`FS%20Telkom%20Triwulan%20II%202025_Bahasa%20Rilis.pdf` — the last one is
percent-encoded, which is exactly the class of URL the earlier percent-decoding
fix (above) exists for; its presence here is the fix proving itself live, not
just against the retained-corpus regression fixtures. The 4 Info Memo
documents: `1Q-2026-TLKM-Corporate-Presentation-Info-Memo.pdf` (info+memo
precedence over the `presentation` deny-list, confirmed live),
`TLKM-9M25-Info-Memo.pdf`, and two more percent-encoded ones
(`TLKM%201H25%20Info%20Memo.pdf`, `TLKM%201Q25%20Info%20Memo.pdf`). No file
under `presentation`/`roadshow`/`deck` alone was ever fetched — checked
directly against `outbound.log`, not inferred from absence of complaints. All
13 new `source-snapshots/*.bin` files verified non-zero on disk (111 KB–45.7 MB)
— the M013 zero-byte-snapshot defect stayed fixed under real load.

`ISAT`'s 8 jobs went `degraded` in the same run: `error_code:
issuer_source_unavailable`, `"No trusted issuer source is configured for
ISAT."` — pre-existing (no `ISSUER_SOURCE_URLS` entry for it), not caused by
anything this session changed.

### Two unrelated fixes made while investigating this

- **`portfolio_positions.market` was `'US'` for the TLKM position** (added
  2026-08-08 via the UI form), while its thesis is `market: 'ID'`. Found while
  reviewing a Luna report on `RESUME_PROMPT.md` staleness. Consequence, not
  cosmetic: `persistSourceSnapshot` matches positions to alert-eligibility by
  `(ticker, market)` ([`snapshot-store.ts:73`](lib/research/snapshot-store.ts#L73)),
  so this position had never once qualified for a `portfolioAlerts` row despite
  being linked via `thesis_id`. Corrected to `'ID'` by direct UPDATE after a
  fresh `db.sqlite` backup, user-authorized. `thesis_id`, `status`, and history
  untouched.
- **`RESUME_PROMPT.md` deleted.** It described itself, in its own governing
  checkpoint entry, as "untracked scratch, not part of the record" — but had
  been committed anyway (`d243a7d`, an unrelated "chore: quick update") and sat
  three weeks stale (base commit `6fa90d7`; claimed `portfolio_positions = 0`,
  `decisions = 0` when both were `1`), misleading a reviewer session that used
  it for orientation. Removed rather than updated, consistent with its own
  stated status and with `AGENTS.md`'s routing rule that only
  `ACTIVE_MILESTONE.md`/`SESSION_CHECKPOINT.md` carry current status.

### Exact Resume Point

**Live validation is done. Next: Slice 4's per-assumption source-adequacy
classification** — (A) Reachable / (B) Exists but unreachable / (C) No public
source — against the corpus this run produced, per `docs/milestones/M013-source-adequacy-and-official-path-recovery.md`
§4 Slice 4. Nothing blocks starting it now. Not yet started as of this entry
— this is where the next session begins.

Two rules govern how to run it, stated in the packet itself, not optional:

1. **Exploration is not evidence.** Any web search or model knowledge used to
   locate or reason about a candidate source is exploration only — label it
   as such explicitly. It does not become jp-invest's verified evidence
   unless it goes through the research pipeline (`AGENTS.md` rule 1).
2. **The classification is the user's, not the assistant's.** Assemble what
   was found and lay out the reasoning per assumption, from the corpus this
   session's live run produced; the user decides each assumption's class.
   This is stated explicitly in the packet — not a call to make unilaterally.

Query current evidence per TLKM assumption before saying anything about A/B/C
— don't reuse this session's before/after table above as if it were per
assumption; it's an aggregate. Thesis id `168cd37c-a6ce-473e-9b2a-943f253c0ef6`.

**M014 status, clarified this session and worth restating on resume:**
`docs/milestones/M014-private-knowledge-coverage-expansion.md` is `accepted`
(2026-08-08) but its own header says explicitly *"It is not active or
complete."* Zero implementation exists. Not referenced anywhere in
`ACTIVE_MILESTONE.md`, whose Active Packet is still M013. Dormant, not done —
re-check before assuming otherwise, since this could change later.

---

# Session Checkpoint - 2026-08-08f (M013 Slice 4 opened: the official corpus stops at 2023, and why)

Continuation of `2026-08-08d` below, same session. Entries further down belong to
other sessions and are untouched, including the M014 work.

## The finding that paused Slice 4 immediately

Slice 4 began by mapping what the corpus actually holds before classifying
anything. That map produced a finding larger than any per-assumption judgment.

**All 15 official TLKM documents are 2019–2023.** Nothing from 2024, 2025 or
2026 is in the corpus — while the thesis concerns a divestment transaction in
progress *now*, in 2026. The secondary corpus is current (late July / early
August 2026); only the official tier is a stale archive.

### Cause, verified against the live page rather than inferred

Running the real `discoverIssuerDocuments` against
`https://www.telkom.co.id/sites/hubungan-investor/id_ID/page/laporan-1025`:

- 185 `.pdf` links in the page HTML, spanning 2002–2026
- 24 of them carry a 2024–2026 date
- `discoverIssuerDocuments` returns **48 documents, newest 2023** — zero from
  2024 onward

The filter at `lib/research/adapters/issuer.ts:56` admits a link only if its
context contains a `REPORT_TERMS` entry: `laporan keuangan`, `financial
statement`, `annual report`, `laporan tahunan`, `audited`. Two facts combine to
exclude every recent report:

1. **The page is JavaScript-rendered.** For the recent entries the anchor text
   and its container text are both empty — checked directly, both returned `""`.
   So the only context the filter can see is the URL path.
2. **Telkom changed its file-naming convention around 2024**, from full words to
   abbreviations:

| Era | Example filename | Matches? |
|---|---|---|
| 2019–2023 | `Laporan Keuangan(Unaudited) 9M 2019.pdf`, `6K_Annual_Report_2019.pdf` | yes — full words |
| 2024–2026 | `Telkom-FS-Bahasa-TW-II-2026.pdf`, `TLKM-2025AR-fullbook-54-00-hires.pdf`, `FS-Telkom-Triwulan-III-2025-rilis.pdf` | no — `FS` / `AR` / `LK` / `TW` |

The documents are on the allowlisted host, https, `.pdf`-suffixed, and
fetchable. Among them: the 2025 annual report, FY2025 audited consolidated
financials, and the 1Q and 2Q 2026 statements — exactly the material A1 and A2
need.

### Why this matters beyond the corpus

It is the **third independent blocker on the same official path**, and all three
failed silently into "no evidence" rather than into an error:

1. The byte-limit mismatch — fixed, `d2c6427`
2. Ticker-scoped `knownDocumentIds` — known, unfixed
3. `REPORT_TERMS` against the post-2024 naming — found now

It also changes what Slice 4 can conclude. A1 (30% ownership post-transaction)
and A2 (Digital Infrastructure revenue growth) both looked unanswerable from the
corpus. They are in fact **(B) — exists but unreachable**, behind a blocker that
is small and now named. No assumption can honestly be called **(A)** until the
recent documents are actually read.

### User decision

Fix the discovery gap **before** completing the A/B/C classification, so the
judgment is made against a corpus that contains the documents the thesis
depends on. Recorded as option 1 of three offered; the other two were to classify
against the corpus as-is, or to have the assistant propose methodology and the
user pick the term list.

**The term list is a calibration the user owns.** Too loose and corporate
presentations, info memos and marketing decks enter the corpus as "official
reports" — `1Q-2026-TLKM-Corporate-Presentation-Info-Memo.pdf` sits in the same
directory as the financial statements.

## OCR handoff protocol, agreed this session

All OCR work is split out: the assistant writes a prompt, the user runs it in
their own terminal agent, and pastes the output back. The assistant does not
wire `VisionTranscriber`, does not call a vision provider, and does not run OCR
itself.

The first such prompt was issued for the Laporan Risiko Iklim (the raster-only
PowerPoint export), asking four availability questions — MW/GW capacity figures,
PLN supply mentions, NeutraDC mentions, energy/emissions numbers. **Its output
had not been received when this entry was written.** Its purpose is source
adequacy: whether the document *contains* a figure, not to ingest quotes as
evidence. That keeps it clear of DEC-0012, under which OCR output would be
`ocr_matched` and never `exact_verified`.

### Exact Resume Point

**Next: fix `REPORT_TERMS`/discovery so 2024–2026 issuer reports are reachable,
then complete Slice 4.** A handoff prompt for this is in the session's final
message. Diagnosis is already done — see above — so the next session starts at
the calibration question, not at investigation.

Still pending and unchanged: the OCR output for the Laporan Risiko Iklim; the
21-of-85 evidence rows whose source snapshots are empty; `evidenceIds` auto-fill;
the two snapshot directories (`snapshots\` legacy vs `source-snapshots\` current);
four scratch files at the repository root breaking `tsc` and `lint`.

---

# Session Checkpoint - 2026-08-08d (M013 Slices 1–3 done; Slice 4 paused for a zero-byte-snapshot defect)

M013 is `accepted` and in progress. Acceptance came by direction rather than a
single statement — the user authorised Slice 1 alone, then the repair, then the
re-run, and set the byte-limit calibration. Recorded that way rather than
backdating a formal acceptance that did not happen.

Entries below this one are from other sessions and are untouched, including the
M014 handoff, which is the user's separate work.

## Slice 1 — the two limits that disagreed

Download allowed 25 MB (`lib/research/http.ts`); extraction refused past 10 MB
(`lib/research/extractors/document.ts`). Documents between the two were fetched,
hashed, written to the snapshot store, then refused unread — a 24.3 MB annual
report and a 10.5 MB climate report, the latter missing the old ceiling by
0.5 MB. That is the whole reason TLKM's corpus was market-wire round-ups and CSR
press releases.

**Two things kept it hidden, and both are worth remembering.** The reported
reason was wrong: jobs read *"exceeds the 25 MB M001 limit"* while the document
was 24.3 MB, because the text was hardcoded in the download path and went on
being emitted after a different check did the rejecting. And the failure path
did not log, while every neighbouring rejection path logged first — so
`logs/outbound.log` looked clean while six jobs failed on size. That silence
actively misled this milestone's own diagnosis; an early read of the clean log
produced a wrong conclusion that had to be retracted.

## Slice 2 — one constant, and what it measured

`SOURCE_BYTE_LIMIT` now lives in `lib/research/adapters/types.ts` — the module
both paths already import — read by the download path, the extraction path, and
both issuer clients. Value 500 MB, the user's calibration. Messages state
measured size against the active limit; both rejections log; `maxBytes` is
overridable on the extractor so the guard stays testable without allocating half
a gigabyte. Committed as `d2c6427`, five tests proven to fail first, suite
389 → 392.

Measured against the real retained documents, not fixtures: the 24.3 MB annual
report yields 521 pages and 1,224,092 characters in 8.5 s at ~790 MB peak RSS.

**The climate report is not empty and pdfjs is not at fault** — a correction to
an earlier claim in this session. Its metadata reads `Producer: Microsoft®
PowerPoint®`, `Title: LAPORAN RISIKO IKLIM 2023`, with **zero embedded fonts**:
every slide was flattened to raster. Page 12 holds 201 image objects; extracting
one and viewing it shows legible text (*"PT Telkom Indonesia (Persero) Tbk"*).
It needs OCR, and the `VisionTranscriber` path (DEC-0012 eligible) is still not
wired into `CitationPipeline`. **Class (B), not (C)** — recorded so Slice 4 does
not re-derive it.

## Slice 3 — the re-run, and four findings

Backup taken first: `db-before-m013-slice3-20260808T114512.sqlite`.

| | Before | After |
|---|---|---|
| Jobs | 6 `degraded/source_too_large` | **6 `succeeded`** |
| Official evidence | 3 | **21** |
| Secondary evidence | 48 | 48 |
| Assumption status | 5 `pending_confirmation`, 1 `untested` | **6 `untested`** |
| Verdict | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE`, 0 of 6 supported |

No flood — 18 new rows, not hundreds; the ranker's per-assumption limit bounds
yield regardless of document length. `DEC-0018` held: the system did not claim
support it does not have.

**Four findings, held for discussion after Slice 4:**

1. **The document that motivated the fix still contributes nothing.** The 2023
   annual report was not re-processed — `knownDocumentIds` is ticker-scoped
   (already on the open list) and skips a document once seen. The 18 rows come
   from six newly discovered 2021–2022 documents instead. The limit is genuinely
   repaired; a different known defect now blocks that document.
2. **R-025 applies at the official tier just as badly.** At most one of 21
   official rows is plausibly relevant. The rest include a glossary page and a
   disclosure-index table; the strategic-investor claim drew COVID-19 vaccine
   distribution, the hyperscaler claim a 2008 2G/3G procurement agreement.
   Supply and relevance are now measured as independent problems at both tiers.
3. **A regression in honesty, caused by success.** `pending_confirmation` → 
   `untested` is M007 behaving as designed, but the official evidence that
   cleared the gate is as irrelevant as the secondary evidence it replaced. The
   signal "this rests only on secondary sources" is gone and `6fa90d7`'s
   containment is moot. The gate keyed on **tier** as a proxy for trust; what it
   proxied for is **relevance**, which nothing measures.
4. **Zero-byte snapshots** — see below.

## Zero-byte snapshots — repaired (`09208aa`)

Seven of fifteen files in the snapshot store are empty; six were created by this
session's Slice 3 re-run. **Cause proven directly, not inferred:**
`pdfjs.getDocument` transfers and detaches the source ArrayBuffer — measured on
a real file, `byteLength` 10,972,090 → **0** after the call. `pipeline.ts` hashes
(line 112) and extracts (line 115); `service.ts` then calls
`persistSourceSnapshot`, and `snapshot-store.ts:31` writes the detached buffer.

The correlation is exact and is what confirms it: every PDF that extracted
successfully is 0 bytes; the two rejected for size — pdfjs never touched them —
are intact at 24.3 MB and 10.5 MB; HTML is unaffected because cheerio does not
detach.

**Why it outranked Slice 4 in the user's decision:** evidence is stored
`exact_verified` while its retained source artifact is empty, so those quotes
cannot be re-verified and `document_hash` records a hash the stored file does not
have. It also endangers the M010 cleanup precedent, which re-derives from
snapshots to judge staleness and would find nothing — potentially deleting valid
evidence. Nothing is permanently lost (documents are re-fetchable), but the
product's foundational promise is currently not being kept, and the **daily
scheduled refresh keeps producing more empty snapshots** without anyone running
anything. Slice 4 is analysis that writes no evidence, so pausing it costs
nothing.

**Repaired in `09208aa`, before Slice 4 resumed.** Two changes, each proven
fail-then-pass: `extractPdf` hands pdfjs a **copy** rather than the caller's
buffer (protecting all five persistence call sites at once, since every one runs
after extraction), and `persistSourceSnapshot` treats a **zero-byte file as a
failed write** rather than a stored document — the guard was `existsSync` alone,
so an empty file could never be replaced and the damage was permanent. Storage
is content-addressed, so an empty file at a hash-named path cannot be a
legitimate version of it; a retained non-empty snapshot is still never
overwritten, which has its own test.

Verified on live data, not fixtures: a `research:refresh` afterwards fetched six
issuer documents (annual reports 2019–2021, three quarterly statements) and all
six wrote intact at 1.4–7.3 MB. `tests/snapshot-store.test.ts` is new — the
module had no coverage at all. Suite 405 passed / 3 skipped.

**Still outstanding, recorded rather than smoothed over:** 21 of 85 evidence rows
still point at empty source files, because those documents have not been
re-fetched. Quote text is intact and displays normally; only re-verification is
lost. The self-healing guard means a re-fetch repairs them, but whether to
re-fetch, leave as recorded debt, or delete is a user decision. Most of the 21
are the irrelevant passages R-025 describes, so the practical loss is small —
the broken guarantee is the cost, not the data.

Noticed while verifying and **not investigated**: snapshots live under two
directories — `D:\jp-invest-data\snapshots\` (the seven empty legacy files) and
`D:\jp-invest-data\source-snapshots\` (where writes go now, per
`SOURCE_SNAPSHOT_DIR`). Recorded so it is not mistaken for part of this defect.

### Exact Resume Point

**Next: M013 Slice 4** — classify each TLKM assumption's source adequacy as
(A) reachable / (B) exists but unreachable / (C) no public source. One thing to
settle before starting: the division of research labour, because any web search
the assistant runs is **exploration**, not jp-invest's verified evidence
(`AGENTS.md` rule 1), and the classification itself is the user's call, not the
assistant's.

Already established, so Slice 4 need not re-derive it: the Laporan Risiko Iklim
is class **(B)** — a PowerPoint deck flattened to raster with zero embedded
fonts, fully legible, blocked only by OCR not being wired into
`CitationPipeline`.

**Known and unfixed, carried forward:** `evidenceIds` auto-fill
(`components/ResearchPanel.tsx:196`) records every displayed row rather than a
user selection; the thesis draft card's "Confirmation required" heading renders
unconditionally after confirmation; `knownDocumentIds` ticker-scoping (now shown
to have real consequences — see finding 1); the research-pipeline OCR gap
(`VisionTranscriber` never wired into `CitationPipeline`); four scratch files at
the repository root (`check_schema.ts`, `fix_db.ts`, `repair_json.js`,
`update_row.ts`) that break `tsc --noEmit` and `npm run lint`; R-026's stale
text; Roadmap §5 steps 4/5/6 + `decisions:record` + the Ollama question (§7.2).

---

# Session Checkpoint - 2026-08-08b (M013 scoped: the corpus, not only the matcher — plus a correction to this session's own earlier report)

## M014 terminal-agent execution handoff prepared — 2026-08-08c

The user requested an execution prompt for a user-invoked terminal agent
through a terminal session. M014 is `accepted`; this entry records the accepted planning baseline
and the implementation handoff, while closure remains pending QA.

Execution baseline: split M014 into M014-A (DOCX/XLSX Office parsing) and
M014-B (scanned-PDF terminal-agent OCR); use deterministic OpenXML traversal for
DOCX and `exceljs` for XLSX after explicit dependency review; defer legacy
`.doc`/`.xls`; preserve
XLSX formula text plus cached/displayed values without evaluating formulas;
include hidden and `veryHidden` sheets; keep `schemaVersion: 1` while widening
the extraction-method enum; store OCR provider/model/prompt metadata in the
existing knowledge SQLite columns; preserve the default report path; keep
candidate graph output CLI/JSON-only; and require an explicit status for every
remaining document.

The terminal-agent prompt must require reading the repository instructions and relevant
packets, running `git status --short`, preserving all existing user changes,
avoiding `originals/`, `private/knowledge/`, database files, and unrelated
documentation, beginning with Slice 0, and stopping/reporting rather than
inventing a missing decision. The selected agent must not mark M014 active or complete.

## M014 draft handoff — 2026-08-08

This is the current session boundary. M012 is complete. M013 — Source
Adequacy & Official Path Recovery — remains `scoped` and not started. M014 —
Private Knowledge Coverage Expansion — is `accepted`, but not active, complete,
or implemented.

The M014 packet is:

[`docs/milestones/M014-private-knowledge-coverage-expansion.md`](docs/milestones/M014-private-knowledge-coverage-expansion.md)

M014 currently records these boundaries:

- The repository has one canonical root-level `ACTIVE_MILESTONE.md` and one
  canonical root-level `SESSION_CHECKPOINT.md`.
- Relevant context is routed through `AGENTS.md`, `docs/CODEBASE_MAP.md`,
  `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`,
  `docs/milestones/ROADMAP.md`, `docs/decisions/INDEX.md`,
  `docs/CLI_WORKFLOW.md`, and decisions `DEC-0017`, `DEC-0019`, and `DEC-0012`.
- `EXECUTION_PLAN.md`, `BUILD_PLAN.md`, and `DATA_MODEL.md` are absent and are
  not treated as authorities for this repository.
- M014 covers 22 DOCX files, 2 XLSX files, and 1 scanned PDF currently marked
  `needs_ocr`; `originals/` remains read-only.
- OCR's primary proposed operator path is a user-invoked vision-capable
  terminal agent. Gemini, Codex, Claude, or another selected agent may use the
  same provider-neutral file-backed handoff contract.
- The application must validate and ingest the local OCR handoff; it must not
  launch Gemini, Codex, Claude, or silently replace `LLMProvider`.
- A no-handoff OCR run remains `needs_ocr`. OCR output remains private,
  candidate-only, and separate from live `Evidence` and `SourceSnapshot`.
- M014 adds local parsers and a file-backed OCR validation boundary, but no
  provider adapter or provider process is launched by jp-invest.

### Working-tree preservation

The next session must run `git status --short` before taking action and preserve
all existing user changes. At this checkpoint the working tree includes:

```text
 M lib/research/adapters/factory.ts
 M lib/research/adapters/types.ts
 M lib/research/extractors/document.ts
 M lib/research/http.ts
 M tests/document-extraction.test.ts
 M tests/source-adapters.test.ts
?? .claude/
?? RESUME_PROMPT.md
?? check_schema.ts
?? docs/milestones/M014-private-knowledge-coverage-expansion.md
?? fix_db.ts
?? repair_json.js
?? update_row.ts
```

Do not assume the repository is clean. Do not delete or revert these changes
without explicit user instruction. Do not modify `originals/`,
`private/knowledge/`, database files, or the historical M013 packet while
reviewing M014.

### Next safe action

Run the remaining QA gates: focused and full tests, typecheck, lint, build,
actual-corpus scan/report reconciliation in a controlled environment, and
verification that `originals/` remains byte-identical. Do not mark M014 active
or complete until those gates and the closure checklist pass.

For a new session, read `AGENTS.md`, `docs/CODEBASE_MAP.md`, this checkpoint,
`ACTIVE_MILESTONE.md`, the M013 and M014 packets, `docs/CLI_WORKFLOW.md`, and
`DEC-0017`/`DEC-0019`/`DEC-0012` before coding.

---

Continuation of 2026-08-08 below, same session. Commit `454a1f6` landed the
Tailwind fix and the checkpoint entry below; everything in this entry is
documentation only and no code has been written for M013.

## Correction To This Session's Own Earlier Entry

The entry below records, as evidence the decision flow works: *"`evidenceIds`
populated with all 48 evidence rows"*. **That was reported as a success and it
is a defect.** `recordDecision` builds the list itself
(`components/ResearchPanel.tsx:196`):

```js
const evidenceIds = data.items.flatMap((item) => item.evidence.map((e) => e.id));
```

Every evidence row currently displayed, taken automatically. The user never
selected them. The comment above it asserts this is *"what the user's reasoning
was actually weighed against"* — an assumption, not a fact.

The consequence lands on `VISION.md` §9.7 (*"reconstruct the evidence... behind
a decision"*): reopening the one real decision in the live database yields 51
quotes, of which roughly nine in ten are irrelevant under R-025. The record
*looks* thoroughly evidenced, which is worse than looking thin. The only part
that is genuinely the user's is the `rationale` they typed. Found by the
reviewer "Terra" during an independent mapping pass, verified here directly
against the code. Not fixed in this entry — recorded in `ACTIVE_MILESTONE.md`
as a known defect.

## The Finding That Opened M013

After the R-025 remedy debate had already converged — two independent reviewers,
different routes, both anchored to `VISION.md` — a direct inspection of the
live TLKM **source corpus** found something neither review had tested.

- **All six** official-source jobs sit at `degraded` / `source_too_large` after
  8–9 attempts. The financial statements have **never once been read**.
- Of 51 persisted evidence rows: ~25 from daily market-wire round-ups (index
  moves, foreign net-sell figures), ~13 from CSR/education press releases (a
  student programme, village development, a 61st-anniversary item). The only
  document classified `Issuer official` is a **sustainability report**.
- Three of six assumptions ask for figures issuers do not customarily disclose
  at all: competitor-set MW market share, hyperscaler contracted/MoU MW, firm
  PLN power MW.

The diagnosis both reviews reached still stands — the system does conflate
*passage found*, *passage worth reviewing*, and *evidence judged relevant*. What
changed is the **order**. Building the review loop on this corpus means the
user's first real session is labelling ~45 market-wire and CSR passages
irrelevant one at a time, against a corpus that changes completely the moment
the official path is repaired; any ranking or volume calibration made now would
not survive that repair.

The reusable form of the lesson: M009 fixed evidence **vocabulary**, M010 fixed
**shape**, M011 added **meaning**, and the R-025 debate reached for
**relevance** — while nobody checked whether the **supply** existed to be
judged.

## The Debate That Preceded It, In Brief

Worth retaining because the reasoning is not reconstructible from the commits.

- Four remedy options were analysed (hygiene / deterministic relevance contract
  / `PassageCandidate`-`Evidence` split / model assessor). Both reviewers
  independently landed on: **(c) as the epistemic correction, (b) demoted from
  admission gate to non-destructive ranking + explanation, (a) as hygiene, (d)
  deferred.**
- The strongest argument against (b)-as-gate came from Terra and is sharper than
  the visibility argument: a gate built from the user's own alias list filters
  out disproportionately what lies *outside* the user's mental model — which is
  exactly where thesis-disconfirming evidence lives. `VISION.md` §2 names
  optimism bias as the enemy; §3 and §5.2 make challenging the thesis the
  product's job.
- **Q3 (judge vs finder) is settled by VISION and should stop being re-opened.**
  §3 ("challenges your assumptions"), §5.2 ("Alternative Views"), and §7 ("does
  not present every headline. It prioritizes") exclude both a passive finder and
  an autonomous judge. The posture is **challenger**.
- A `VISION.md` §9 mapping was performed twice, independently. Both found **zero
  of eight metrics measured**. §9.4 (Signal Precision) turns out to be R-025
  restated as a metric, and is *structurally* unmeasurable today. §9.1 already
  mandates that the user "understands why items were prioritized" — while
  `matchedTokens` (`candidate.ts:213`) and `calculatePriorityScore`'s components
  are both computed and then discarded.
- Two corrections to this assistant's claims, both from Terra, both verified:
  `sourceTags` is **not** a reusable hook for relevance concepts (it is
  XBRL-element-specific, `app/api/chat/route.ts:71`, correctly empty for ID
  market); and "§9 as milestone scope determinant" is unsound as a *sole* frame —
  building measurement for a capability that does not exist yet produces numbers
  describing nothing. §9 is an acceptance lens, not a roadmap generator.
- Two of Terra's own citations were loose while its conclusions held: DEC-0016
  does not mention a relevance gate (it simply does not cover one), and §6.3
  "user sovereignty" is about data rights rather than correcting relevance
  concepts. Same pattern noted twice; worth continued verification rather than
  distrust.

## Written This Entry

- `docs/milestones/M013-source-adequacy-and-official-path-recovery.md` — new,
  `scoped`, awaiting user acceptance. Five slices: diagnose the official-path
  failure (no fix), repair it, re-run and record the corpus, classify each
  assumption (A) reachable / (B) exists but unreachable / (C) no public source,
  then close Q3–Q6. Implements **none** of the four R-025 remedy options, and
  says why in §0.
- `docs/RISK_REGISTER.md` — **R-028** added (an assumption with no reachable
  public source; measured by M013, not mitigated). R-025 gains a dated
  re-scoping paragraph and stays `Open`. The sharp edge recorded in R-028: under
  `DEC-0018`, if most assumptions are (C), the thesis is structurally pinned at
  `INSUFFICIENT_EVIDENCE` regardless of any labelling effort — honest, but
  nothing in the UI says so.
- `ACTIVE_MILESTONE.md` — M013 active/`scoped`, M012 moved to latest-completed.
- `docs/milestones/ROADMAP.md` — M013 entry with the sequencing lesson.

## Verified This Entry

Every number above read directly from `d:/jp-invest-data/db.sqlite`, not from
the UI and not from a prior report. Corpus composition, job statuses, and the
51-row count were each queried at the time of writing.

**A daily scheduled refresh (`research:install-task`) mutates the live database
with nobody running anything** — TLKM evidence moved 39 → 45 → 48 → 51 across
three days through that path alone, and both this assistant and Terra "corrected"
each other with figures that were accurate when taken. Any before/after
comparison must use a frozen snapshot to be reproducible. Recorded in M013's
verification plan.

### Exact Resume Point

**M013 awaits user acceptance. No code has been written for it.**

First slice is deliberately diagnosis-only: establish *why* every official job
fails `source_too_large` — a limit set too low, the wrong document targeted, or
an extraction strategy that loads whole files — before choosing a repair. Its
size is genuinely unknown, and Slice 2 turning out to warrant its own packet is
a legitimate outcome to raise at review.

**Known and unfixed, carried forward:** the `evidenceIds` auto-fill defect above;
the thesis draft card's "Confirmation required" heading rendering
unconditionally even after confirmation; ticker-scoped `knownDocumentIds`;
first-assumption-only promotion; R-026's stale text; Roadmap §5 steps 4/5/6 +
`decisions:record` + the Ollama question (§7.2).

---

# Session Checkpoint - 2026-08-08 (the main loop ran end-to-end for the first time, live in browser; a pre-existing Tailwind wiring defect found and fixed)

## M012 start — 2026-08-08

The user authorized the bounded local-only M012 implementation. The source
corpus is already at the repository root `originals/` with the existing
`MODULE 1/` and `MODULE 2/` hierarchy. It is read-only and must not be moved,
renamed, copied, modified, deleted, flattened, logged, or sent to a provider.

The generated artifact layout is `private/knowledge/manifest.jsonl` plus the
`extracted/`, `batches/`, `reports/`, and `graph/` directories. No
`private/knowledge/originals/` path is used. The implementation is governed by
`DEC-0019` and the M012 packet. It must remain separate from live `Evidence`
and `SourceSnapshot` records, use SQLite/Drizzle, and make no external provider
calls by default or during verification.

The next safe implementation slice is deterministic intake and manifest
persistence, followed by local extraction, strict source-card validation, and
candidate graph persistence. No commit or push is authorized.

### M012 close-out — 2026-08-08

M012 is complete. The actual corpus intake produced 54 unique documents, 0
duplicates, and 0 read failures. Local extraction produced 29 extracted PDFs,
1 `needs_ocr` PDF, and 24 visible `unsupported` Office files. With no provider
configured, 29 extracted documents remain `awaiting_provider`; no graph claims
or edges were created and no external provider was called.

Verification passed: 389 tests passed / 3 skipped, 13 M012/migration tests
passed, typecheck, lint, build, context index, status check, and diff check.
The next safe work is a separately scoped parser/OCR or explicit provider
milestone; it must not alter the read-only `originals/` archive or route course
claims into live `Evidence`.

Continuation of 2026-08-07 below, same working tree (`6fa90d7`), no new
commits yet this session — everything below is verified against the live
database and the live dev server, not yet written to git.

## The Blocking Experiment Ran — All Four Steps, Verified To The Database

The 2026-08-07 entry's exact resume point was four manual steps that had to
happen before any relevance-area work could be scoped. They ran today, in the
user's own browser, against the real dev server. Every claim below was
re-verified directly against `d:/jp-invest-data/db.sqlite` after the fact —
not read off the UI.

1. **TLKM added to the portfolio** (Watchlist, linked to the TLKM thesis) —
   `portfolio_positions`: 0 → **1**.
2. **`/portfolio` bridge seen in a browser for the first time.** Resolves the
   2026-08-07 entry's open caveat ("the briefing bridge has never been seen in
   a browser"). It rendered the correct content on the first load — but with a
   pre-existing, unrelated rendering defect that made it briefly hard to
   verify (see below), fixed mid-session.
3. **Acceptance containment confirmed live.** Opened the TLKM assumption card
   in the Research panel (`/c/7bb5aefb-...`, reached via the "View research"
   button under the confirmed thesis draft — the draft card's own "Confirmation
   required" heading is stale copy that doesn't reflect confirmed state, a
   separate minor defect noted but not fixed). No "Accept secondary evidence"
   button rendered. In its place, verbatim: *"These passages have not been
   checked for relevance to this claim, so they are not offered for
   acceptance."* Matches `SECONDARY_ACCEPTANCE_UNAVAILABLE_REASON` exactly.
4. **A real decision recorded.** `decisions`: 0 → **1** — outcome
   `Update Thesis`, optional action `Hold`, rationale *"Masih belum ada
   petunjuk jelas langkah berikutnya"* (an honest reflection of the 0-of-6
   coverage state), `evidenceIds` populated with all 48 evidence rows,
   `alternatives: []`.

   Verified the `action: "Hold"` value was the user's own manual selection,
   not an AI suggestion — traced `generateDecisionRecommendation`
   (`lib/research/service.ts:1363`) end to end: `decisionRecommendationSchema`
   has no action/trade field at all, only `recommendedOutcome` (the four
   process states) and `rationale`, and the prompt itself states outright
   *"Never recommend, suggest, or imply a trade or position action (e.g. Buy,
   Hold, Reduce, Exit) — that decision belongs to the user alone."* Both the
   schema shape and the prompt wording enforce `AGENTS.md` rule 2
   structurally, not just by instruction.

**The product's main loop — add position, see bridged verdict, review
evidence, record a decision — has now executed once, completely, for the
first time.**

## Found And Fixed: Tailwind CSS Was Never Wired Into The App

Discovered while trying to read the `/portfolio` bridge output in step 2
above: the table cell rendered `"Not enough evidence0 of 6 supported · 45 not
relevance-checked"` — no space, no line break, between what should have been
two stacked `<span>`s. Root cause, verified directly: `app/globals.css` (the
only global stylesheet, imported once in `app/layout.tsx`) contained hand-
written CSS only and **no `@import "tailwindcss";` or `@tailwind` directive
at all** — `postcss.config.mjs` correctly registers `@tailwindcss/postcss`,
but the plugin had nothing to expand. Every Tailwind utility class in the
codebase had generated zero CSS since the project began; this predates all
work in this checkpoint and is not a regression from any recent commit.
Repo-wide grep confirmed only two files use raw Tailwind utility classNames
(everything else uses CSS Modules, already unaffected): `app/portfolio/page.tsx`
and `components/TopTenQueue.tsx`.

Two fixes, both handed to an external reviewer ("Luna," per the user's
existing practice) with a self-contained prompt and applied by them, then
verified here directly against the current code (not taken on the reviewer's
report):

1. **The wiring fix** — `app/globals.css` line 1 is now `@import
   "tailwindcss";`. Confirmed live: badges render as colored pills, the
   `/portfolio` table row spacing/gap now works, the concatenation bug is
   gone.
2. **A dark-theme contrast defect the wiring fix exposed** — both affected
   files were authored with light-mode Tailwind assumptions (`bg-gray-100`,
   `bg-gray-200`, `hover:bg-gray-50`/`hover:bg-gray-100`) with no paired text
   color, invisible while Tailwind was inert but rendering near-white text on
   near-white backgrounds once it activated, against this app's dark theme
   (`body { background: #121212; color: #ededed; }`). Confirmed live in the
   table header row and reproduced by inspection in three more spots
   (the ticker's market-code badge, two hover states). Fixed by pairing each
   with an explicit dark-safe text color (`bg-gray-100 text-gray-900`,
   `bg-gray-200 text-gray-700`, `hover:bg-gray-50 hover:text-gray-900`,
   `hover:bg-gray-100 hover:text-gray-900`) — verified present in both files
   after the fix. `npx tsc --noEmit` clean afterward.

Noted as a real possibility, not confirmed: this may be the root cause of the
standing `feedback-ui-too-cramped` memory — if spacing/padding/rounded
utility classes have been inert since day one everywhere they're used, that
would produce exactly that complaint. Not re-investigated this session; worth
a look next time UI density comes up.

## Two Stale Items From The 2026-08-07 Entry, Now Resolved

- "The briefing bridge has never been seen in a browser" — resolved by step 2
  above. It rendered correctly once the pre-existing CSS defect was fixed.
- "One test had its assertion reversed" (the acceptance-containment test) —
  unchanged, still carried forward; the live browser check in step 3 above is
  additional confirmation the *behavior* is correct, not a change to that
  test note.

### Exact Resume Point

**Nothing is blocking now — the experiment that gated all relevance-area work
has run.** What it showed: the bridge and containment both work as designed,
and the user was able to record a real, honest decision even with the
evidence base 100% unassessed for relevance — the rationale they wrote
("no clear guidance on next steps yet") reflects that state accurately rather
than being misled by it.

**Open, unchanged: R-025 remedy scope.** Four candidates, still none chosen —
recorded in the 2026-08-06 entry and `docs/RISK_REGISTER.md`. This is the
next real decision, and it's the user's to make, not derivable from what the
experiment showed.

**New, small, not yet fixed:**
- The thesis draft card's "Confirmation required" heading renders
  unconditionally even after confirmation — only the button below it branches
  on confirmed state (`components/ChatUI.tsx`, the `thesisDraft &&` block).
  Cosmetic, but confusing — a confirmed thesis's card still reads as pending.

**Still open, carried from 2026-08-07 and 2026-08-06, untouched this
session:** `source_too_large` on issuer PDFs (visibly still failing live —
one TLKM assumption card showed a `DEGRADED` badge with a `Retry` button
during today's walkthrough), ticker-scoped `knownDocumentIds`,
first-assumption-only promotion, R-026's stale text, Roadmap §5 steps 4/5/6 +
`decisions:record` + the Ollama question (§7.2).

Nothing in this entry is committed to git yet.

---

# Session Checkpoint - 2026-08-07 (DEC-0018 verdict gating, acceptance containment, briefing bridge — and the reframing that the main loop has never run)

Continuation of 2026-08-06 below. Commits: `baff03c` (the checkpoint entry and
R-025 narrative below this one — written by that session, committed as its own
docs-only commit) and `6fa90d7`. No milestone is active. Working tree clean at
`6fa90d7`; `RESUME_PROMPT.md` is untracked scratch, not part of the record.

## The Reframing: The Product Has Never Run Its Own Loop

Verified directly against `d:/jp-invest-data/db.sqlite` (re-verified this
session, not carried over): `portfolio_positions` = **0**, `decisions` = **0**,
`user_confirmed_secondary` = **0**. The Sunday Evening Ritual that `VISION.md`
§4 describes and §9 makes the measure of success has never happened once, while
a dozen-plus commits went into the evidence layer beneath it.

The core technical problem, stated as plainly as it can be: **the system can
prove where a quote came from; it cannot judge whether the quote is about the
claim.** R-025 quantifies it — 88.9% of a 72-candidate audit of the live TLKM
corpus clearly irrelevant to the assumption they were attached to.

A second structural finding, from the same review pass: of TLKM's 6
assumptions, only 1 is a financial-statement number. The rest are events and
relationships (ownership %, MW of capacity, investor identity) with no XBRL tag
in any market, and `createXbrlFactSources()` returns `ID: undefined` on every
branch — so for the ID market `observedValue` is always null, polarity is
always `inconclusive`, and the verdict can never reach `breached`.

The open product question, still unanswered by the user: **is jp-invest a judge
(rendering a verdict on a thesis) or a finder (surfacing relevant reading, the
user judging)?** `VISION.md` §3/§5/§7 lean toward "a finder with honest
limits". Nothing below should be read as having settled that.

## `6fa90d7` — Three Changes, All Verified Fail-Then-Pass

**DEC-0018 — the verdict's positive state now requires `coverage.supported > 0`.**
`holding` previously followed from "no contradiction + open gate", neither of
which requires anything to be supported; live TLKM read HOLDING over evidence
that was 100% `inconclusive`. The state is **gated, not deleted** — removing
the enum was proposed and rejected on review, because "supports a measurable
claim", "no contradiction found" and "not enough evidence" are three distinct
states. This opened a route to `insufficient_evidence` with an **open** gate
and therefore empty `suppressionReasons`, which `buildHeadline` rendered as the
malformed `"INSUFFICIENT EVIDENCE — ."`; a new clause fixes it while still
asserting nothing about topical relevance in either direction.

**Containment of the "Accept secondary evidence" control.** Withheld on both
sides — the panel shows the reason instead of the control, and
`acceptSecondaryEvidence` refuses the request regardless of the UI — because
the passages behind it have never been assessed for relevance and
`user_confirmed_secondary` is a durable human decision. The seam is
`secondaryEvidenceAcceptanceAvailable()` in `lib/domain/contracts.ts`
(currently `return false`), one place to flip, shaped like DEC-0016's inert
classifier seam. The five existing `pending_confirmation` rows and
`deriveAssumptionStatus` are untouched; that belongs to the relevance work.

**Briefing bridge.** `getPortfolioBriefing()` now carries `verdictLevel`,
`supported`/`totalAssumptions`, and `relevanceUnassessedCount` — deliberately
separate from `supported` so unassessed passages cannot be presented as
corroboration — reusing the same pure `deriveCoverageLedger`/
`deriveThesisVerdict` the Research Panel renders. Rendered in `TopTenQueue` and
`/portfolio`. Note the two surfaces count different units, both honestly: the
panel headline counts **assumptions** carrying unassessed quotes (6), the
briefing badge counts **secondary evidence rows** (45).

## Verified Live This Session (2026-08-07, After `6fa90d7`)

- `research:panel` on live TLKM reads `VERDICT INSUFFICIENT_EVIDENCE`,
  headline well-formed: *"no assumption is supported by evidence; 6 have quotes
  verified verbatim from their source but never checked for relevance to the
  claim."* Coverage: 0 of 6 supported, gate **open**, retrieval 6 of 6.
- The live corpus visibly confirms R-025 rather than merely asserting it: the
  quotes attached to the NeutraDC market-share and strategic-investor
  assumptions are IHSG close, EIDO ETF and foreign-net-sell chatter.
- **Evidence counts have moved since the numbers in the docs below.** TLKM now
  holds **48** evidence rows (3 official, 45 secondary), all `inconclusive` —
  not the 42/39 that DEC-0018 and R-025 quote. Six secondary rows were created
  `2026-08-07 13:31`, i.e. a live run happened that day that no checkpoint
  records. The quoted figures are correct as of their own dates; the direction
  of the finding is unchanged (still 0 supported, still 100% inconclusive).
- Assumption statuses: TLKM 5 `pending_confirmation` + 1 `untested`; ISAT 8
  `untested` (legacy, pre-M011).

## Two Honest Caveats Carried Forward

- **The briefing bridge has never been seen in a browser.** It was proven by
  integration test against a temporary database, not by eye, because the real
  portfolio is empty. A rendering defect would not yet be visible.
- **One test had its assertion reversed**, not repaired:
  `"transitions a pending_confirmation assumption to user_confirmed_secondary"`
  became `"withholds acceptance while relevance is unassessed"`. An old
  guarantee was deliberately withdrawn; the reason and the route back are in
  the test's own comment.

### Exact Resume Point

**The next step is an experiment, not code, and it blocks the rest.** Nothing
should be built in the relevance area before it runs. `npm run dev`, then:

1. The user adds **TLKM** through the sidebar form (`components/Sidebar.tsx`),
   picks `Owned`/`Watchlist`, links it to the TLKM thesis. This is durable
   portfolio state — a user decision, not agent work.
2. `localhost:3000` and `/portfolio` — TLKM should show the "Not enough
   evidence" badge and "0 of 6 assumptions supported · 45 passages not
   relevance-checked". First sighting of the bridge in a browser.
3. `/c/7bb5aefb-b4cb-49d8-a4a7-4d4e95adb62e` — the Accept control should be
   gone, replaced by the reason text.
4. The user records one real review/decision (`decisions` is still 0, so this
   also exercises `evidenceIds`/`alternatives` against real data).

What steps 2 and 4 show decides the scope of the relevance milestone: a full
deterministic relevance contract, or a cheap and visible `uncertain` label.

**Still open, unchanged from the entry below:** R-025 remedy scope (four
candidates, none chosen — hygiene/stop words; a deterministic relevance
contract keyed to the measurement contract's concept groups, which the TLKM
contract is rich enough to support, though a naive "all contract tokens"
approach was shown to fail; a `PassageCandidate`-vs-`Evidence` status split; a
governed model-based assessor that DEC-0016 does **not** authorize). Raising
the token floor from 1 to 2 was measured insufficient — 37 irrelevant
candidates still clear it. Also open: `source_too_large` on issuer PDFs (5 TLKM
jobs still fail here honestly), ticker-scoped `knownDocumentIds`,
first-assumption-only promotion, R-026's stale text, and Roadmap §5 steps
4/5/6 + `decisions:record` + the Ollama question (§7.2).

---

# Session Checkpoint - 2026-08-06 (Class-C document classification, promotion cleanup, relevance-gate attempt, quantified R-025 finding — remedy deferred)

Continuation of 2026-08-05b below. Commits this session, on top of `153c998`:
`df600f4`, `cf306da`, `b52a1f3`, `e8a99c3`. No milestone is active.

## Class-C Promotion: Two Rounds Of Independent Review

`df600f4` gated Class-C promotion on a URL-shape predicate (`isIssuerReleaseUrl`)
after the first review found it labelling any page on an allowlisted issuer
origin a "Web-discovered issuer release" — the live database had 5 snapshots
under that label that were none of them a release (the homepage and four IR
index pages).

A second review found `df600f4` itself insufficient and identified two
defects it introduced: the gate judged the pre-redirect `candidateUrl` while
the snapshot recorded `fetched.url`, and `not_an_issuer_release` rejections
were terminal (`promoteAllEligibleCandidates` only re-swept
`domain_not_allowlisted`). `cf306da` replaced URL-shape judgment with
`classifySecondaryDocument` (`lib/research/secondary-document.ts`) — JSON-LD
`@type` and `og:type`, read from the fetched document — applied to both
Class A and Class B, since leaving news ungated was the same defect. Measured
15/15 against every real retained TLKM secondary snapshot: exact separation,
no false positive or negative. Also corrected a docstring
(`isIssuerReleaseUrl`) that claimed a distinction the implementation did not
make — the same overclaim class this codebase spent 2026-08-05 removing from
its verdict copy, this time in code from this session.

`b52a1f3` repaired the five pre-existing mislabelled rows: dry run first
(matching the M010 `cleanup-boilerplate-evidence` precedent — mechanics
governed by that precedent, authorization to run it was separate and
explicit), raw snapshots and files retained, one non-admissible evidence row
deleted, zero assumption-status changes (13 other secondary rows remained on
the affected assumption), zero human decisions (`user_confirmed_secondary`)
touched. Applied and verified directly against the live database afterward.

## Relevance Gate: Shipped Narrower Than Its Own Name Claimed

Agreed next step after Class-C: relevance before any polarity classifier,
since labelling irrelevant prose as supporting/contradicting only makes wrong
evidence look stronger. `e8a99c3` generalized M009's existing ticker/bare-year
exclusion in `rankSentenceCandidates` to the full company name and market
(`identity`, threaded from the thesis) — proven by a test on the real
stock-index-round-up quote that motivated it, and by a from-scratch
re-run of the live TLKM thesis after resetting its jobs.

**The re-run itself surfaced the limit.** Two new issuer-press-release rows
were added by the same run — both about a sustainability award, attached to
the "hyperscaler capital commitments" assumption. Neither mentions a
hyperscaler. Instrumenting `significantTokens` directly (not guessed) showed
the matched tokens were `komitmen`, `sebagai`, `digital` — none an identity
token, so identity exclusion was never going to catch this case.

A third independent review (same reviewer, "Luna" — the label the user gave
this reviewer in conversation) was commissioned specifically for this finding.
Its verdict: `e8a99c3` is a sound narrow fix, kept, but does **not** establish
a relevance gate — token overlap decides whether a passage becomes Evidence
at all, not merely which candidates rank higher, and identity exclusion
leaves the larger share of false positives (generic corporate vocabulary)
untouched. Its own instrumented audit of the live retained TLKM corpus
(11 documents, 6 assumptions, 66 combinations, 72 candidates), judged against
"does this passage contain a proposition capable of changing evaluation of
the assigned metric or relationship": 4 directly relevant, 4 adjacent but
insufficient, 64 clearly irrelevant — 88.9% (94.4% including adjacent)
false-positive. **Independently corroborated this same session**, different
method: eyeballing all 39 live persisted secondary evidence rows directly
found at most 2-3 plausibly relevant.

One of the review's own citations was wrong — it named
`DEC-0015-research-source-ladder-and-fallback-policy.md`, which does not
exist; the real file is `DEC-0015-secondary-source-ingestion-boundaries.md`.
Checked before repeating the substantive claim to the user: DEC-0015 §5 does
say ingested secondary text is evaluated for "factual claims and thesis
assumption alignment" — sloppy citation, not fabrication, and the point
underneath it held.

Four candidate remedies of increasing scope were laid out, none selected:
rename the mechanism honestly + add missing Indonesian stop words (low-risk
hygiene — `sebagai`, `dengan`, `dalam`, `pada`, `oleh`, `serta`, `juga` are
absent from `STOP_WORDS` while rough English equivalents are present); a
deterministic relevance contract keyed to the measurement contract's own
concept groups (entity/alias, metric, event type) rather than arbitrary token
overlap; and, only for general paraphrase, a governed model-based relevance
assessor — explicitly **not** authorized by `DEC-0016`, which covers polarity
classification after evidence exists, not a relevance decision gating
whether evidence is created. A floor raised from 1 to 2 qualifying tokens
alone was shown insufficient: 37 of the same corpus's clearly-irrelevant
candidates would still clear it.

**User's explicit instruction: record this, do not execute any remedy.**
Written into `docs/RISK_REGISTER.md`'s R-025 entry (both a new dated
narrative paragraph and updates to the existing table row's
Mitigation/Residual-risk cells, review date bumped to 2026-08-06) rather than
implemented. `e8a99c3` itself is not reverted — the identity exclusion and an
unrelated exact-number substring-match fix it also contains
(`matchesNumberExactly`, a threshold of 30 no longer "matched" by 130 or
2030) are both real, narrow, kept improvements.

## Verified

Suite 379 passed / 3 skipped as of `e8a99c3`. `tsc --noEmit`, `npm run lint`,
`context:check`, `status:check` clean through `b52a1f3` (not re-run after the
`RISK_REGISTER.md`-only edit in this checkpoint, since it touches no code).

### Exact Resume Point

**Immediate open decision, not yet made:** scope of the R-025 remedy. Four
candidates recorded above and in `RISK_REGISTER.md`, ranging from low-risk
hygiene to a schema/UI-touching candidate-vs-Evidence status split to a
governed model call requiring its own decision record and milestone. Revisit
this before doing anything else in the evidence-relevance area.

Also open, carried from 2026-08-05b and still untouched:
- `source_too_large` on issuer PDFs (five TLKM jobs fail here honestly as of
  the last re-run).
- `knownDocumentIds` is ticker-scoped, not per-assumption — sibling
  assumptions still block each other from extracting from the same document.
- Verdict-level semantics (TLKM `holding` at `supported = 0`) — user-owned
  calibration, not chosen by an engineer.
- Two further findings from the second review, not yet acted on: automatic
  promotion is effectively first-assumption-only
  (`promotePendingForAssumption` marks a candidate globally `fetched` after
  one assumption, so later assumptions never see it — contradicts this
  module's own comment claiming independent per-assumption evaluation), and
  R-026's text is stale (still says promotion has "no URL-shape check").
- Roadmap §5 steps 4/5/6, `decisions:record`, and the Ollama question (§7.2)
  all remain untouched.

---

# Session Checkpoint - 2026-08-05b (commit of prior work, CLI usability, honest verdict copy, independent review, retrieval sweep)

Continuation of the session below, which had ended with 27 files uncommitted.
Everything from both sessions is now committed: `e8eaaa3`, `b3941e2`,
`2efb1d0`, `d6cf84e`, `efe2e4c`, `747396f`, `153c998` on top of `6ffb085`. No
milestone is active; this remains governance/hardening outside M001-M011.

## The Prior Session's Work, Committed As Two Commits (2026-08-05)

User chose a two-commit split over one large commit. Splitting cleanly was not
possible along the originally proposed lines: `lib/research/service.ts` carried
one 505-line diff mixing the lease-owner fix and the
`createThesisFromValidatedDraft` refactor, so the boundary was drawn where the
code actually separates, not where the narrative did.

- `e8eaaa3` — the two gap-fix items that never touch `service.ts`
  (exploration-candidate citations, portfolio Owned/Watchlist).
- `b3941e2` — lease-owner concurrency, shared draft-creation path, decisions
  evidence/alternatives, `recommendedAction` removal, `DEC-0017` + doc sync.

**Each commit was verified in isolation before landing**: staged, the remainder
stashed, then `tsc --noEmit` and the full suite run against that exact tree.
This caught a real ordering bug — `lib/ai/adapters/mock.ts` mixed the
`recommendedAction` removal with the citation fixtures, so commit A alone
failed four tests until the fixture was split correctly.

## TLKM Degraded Evidence: Root Cause Found And Fixed (2026-08-05)

The 6 `issuer_source_unavailable` jobs left open by the prior session.
`ISSUER_SOURCE_URLS.TLKM` pointed at Telkom's IR **landing** page, which has
zero direct PDF links. `IssuerAdapter.discover()` scans only the one configured
URL for terminal `.pdf` hrefs and never crawls deeper, so discovery always
returned empty — a deterministic failure, not a flaky network.

Retargeted to the real reports index
(`.../sites/hubungan-investor/id_ID/page/laporan-1025`), verified by WebFetch to
carry actual filings. `.env` is git-ignored, so this is a local config change
with nothing to commit.

**The 2026-07-26 fix for this same symptom was itself wrong the same way** — it
verified the page was reachable and had report-related *navigation*, not that
any link was a terminal PDF. Recorded in the user's memory file so the
verification standard survives: for `ISSUER_SOURCE_URLS`, confirm the exact
configured URL yields `.pdf` hrefs directly.

## CLI Usability (`2efb1d0`)

Driven by friction hit firsthand, not from the roadmap:

- `research:panel` printed ~780 lines of raw JSON for a six-assumption thesis.
  Now prints a readable summary by default; `--json` restores the raw DTO,
  `--full` expands every evidence item.
- `npm run research:retry` added. `retryResearchJob` existed in the service and
  behind an API route but had no terminal entry point — retrying TLKM required
  hand-writing a throwaway script.
- **Latent bug fixed:** `research-panel.ts` never imported dotenv, unlike
  `research-queue.ts` and `thesis-stage.ts`, so it silently ignored `DB_PATH`.
  It only worked because the default happened to match.
- `docs/CLI_WORKFLOW.md` written — the scripts previously appeared only in
  governance records, never as a how-to. Linked from `README.md`.

## The Verdict Read As A Confirmation When Nothing Was Checked (`d6cf84e`, `efe2e4c`, `747396f`)

Reviewing `--full` output surfaced that the headline
"5 of 6 assumptions are evidenced and none is contradicted" was true and badly
misleading at once. All 23 TLKM evidence rows were `inconclusive` with
`polarityMethod = no_observed_value` (21) or `not_measurable` (2): the
contracts state thresholds but the evidence is prose with no extractable
figure, so **no row could ever be marked contradicting**. `evidenced` counts
any polarity, so the headline reported reassurance derived from the system's
own inability to measure. `supported` was 0 — and was computed but read by
nothing anywhere in `lib/`, `components/`, `app/`.

Three commits, each wording-only by explicit user choice; verdict **level**
semantics are deliberately unchanged:

1. `d6cf84e` — report `supported`/`inconclusiveOnly` instead of a vacuous
   "none is contradicted".
2. `efe2e4c` — after the user asked what the right copy was, four options were
   drafted and the user chose stating **what the pipeline guarantees**
   (verbatim provenance) versus what it does not (relevance). The code cannot
   honestly claim the quotes are irrelevant either: `no_observed_value` cannot
   distinguish off-topic from on-topic-but-unquantified, so a regression test
   now forbids `/irrelevant|unrelated|off-topic/` in the copy.
3. `747396f` — the coverage line on both surfaces led with `evidenced`,
   reproducing the same overstatement one line lower. Both now lead with
   `supported`; the retrieval ratio is kept because `confidenceGate` derives
   from it, but labelled with what it measures.

Current headline on the real thesis: *"THESIS HOLDING — 0 of 6 assumptions are
supported. 6 have quotes verified verbatim from their source but never checked
for relevance to the claim. Nothing is contradicted, but nothing is confirmed
either."*

## Independent Review By "Terra", And A Claim Of Mine It Refuted

An architecture review was commissioned from an external agent with repo +
database access. The prompt deliberately invited disconfirmation, flagged which
claims were judgment rather than code fact, and withheld a conclusion to
approve.

It confirmed most claims and **corrected three**: `createDerivedCandidate`
exposes `observedValue` generically so the XBRL path is not a structural
one-way guarantee; an enabled classifier could produce `at_risk` (not just
`inconclusive`); and "no XBRL tag in *any* market" is not established by this
codebase, which only implements US SEC XBRL.

**It also refuted a claim this session had reported to the user as fact.** The
earlier statement that a retry "worked — the pipeline picked a different,
smaller document" was wrong. Verified against the live database: five jobs
flipped `degraded` → `succeeded` within four seconds carrying no evidence newer
than the previous day, one of them with zero evidence rows at all.

## Retrieval Sweep And False Success (`153c998`)

Two defects, both confirmed against the live database.

1. **Only `discovery.value[0]` was ever considered.** Adapters return up to 20
   documents; 19 were discarded, and a known leading document ended the job.
   Telkom's annual report sat unfetched behind a quarterly filing that merely
   appeared first in DOM order.
2. **`unchanged` was written back as `succeeded`** with `error`/`errorCode`
   nulled regardless of evidence. A job that had honestly failed
   `source_too_large` was retried, short-circuited because the oversized
   document was by then a known snapshot, and recorded as a success that did no
   work and destroyed its own diagnostic.

**A cascade this session found beyond Terra's report:** `source_snapshots` has
no `job_id` — it is scoped by market/ticker — so `knownDocumentIds` is shared
across sibling jobs. One job snapshotting a document made every other
assumption's job short-circuit in the same run. That is why all six flipped
together.

Fixed: the pipeline advances to the first not-yet-retrieved document, and
`unchanged` with no evidence is now `degraded` with a new `no_new_documents`
code. Three regression tests, each confirmed to fail before and pass after.

The six falsely-succeeded jobs were reset to `queued` at the user's explicit
instruction (no evidence deleted) and re-run. Result: **three official
documents newly fetched** (2023 annual report, climate-risk report,
sustainability report), evidence 23 → 33 rows, the zero-evidence assumption now
has some, and five jobs now report `source_too_large` honestly. The reported
state is worse-looking and true — it surfaces the next real problem instead of
hiding it.

## Verified

Full suite **360 passed, 3 skipped** (from 354 at the start of the prior
session). `tsc --noEmit`, `npm run lint`, `context:check`, `status:check` all
clean. Copy changes verified against both the CLI and the `/api/research`
response the browser actually consumes.

### Exact Resume Point

Agreed next steps, in order (from Terra's recommended sequence):

1. **Repair Class-C promotion labelling before expanding discovery.**
   `lib/research/discovery-promotion.ts` checks only URL origin, then labels
   whatever it fetched a "Web-discovered issuer release". The live database
   contains `https://www.telkom.co.id/` and generic IR overview pages stored
   under that label, which conflicts with `DEC-0015`'s definition of Class A as
   direct issuer releases. It does not reuse the press-release adapter's page
   eligibility rules.
2. **Add a relevance gate before enabling the polarity classifier.** Relevance
   is logically prior to direction. `rankSentenceCandidates` scores lexical
   token overlap, substring number matches, and the mere presence of a digit —
   `30` can match a sentence containing `130`, and generic Indonesian terms
   satisfy the two-token floor. Any secondary row also moves an assumption to
   `pending_confirmation` and offers "Accept secondary evidence" in the UI,
   with no relevance predicate in between.

Also open, not started:

- **`source_too_large` on issuer PDFs** — five TLKM jobs now fail here
  honestly. This is the remaining barrier to the annual report, the document
  most likely to answer the ownership assumption.
- **`knownDocumentIds` is ticker-scoped, not per-assumption** — sibling
  assumptions still block each other from extracting from the same document.
  Correcting it needs per-(assumption, document) processing records: a
  migration plus a design decision.
- **Verdict level semantics** — TLKM is still `holding` with an open gate at
  `supported = 0`, because suppression uses `evidenced / total`. Whether an
  all-inconclusive thesis should qualify as `holding` is a user-owned product
  calibration, deliberately not chosen by an engineer.
- **Polarity classifier** — `DEC-0016` line 85 requires its own milestone
  packet, live eval, and an amendment to that record before anything constructs
  one by default. Verified directly.
- **Agent-assisted URL discovery** — judged conditionally sound (the agent may
  propose opaque URL pointers only; fetch, content-addressing and verbatim
  verification stay in the pipeline), but only after the two steps above.
- Roadmap §5 steps 4/5/6 (Dashboard conversion, concurrency tests, hiding Chat
  UI), `decisions:record`, and the Ollama question (§7.2) all remain untouched.

---

# Session Checkpoint - 2026-08-05 (CLI-workflow resume: TLKM verification, 5 gap fixes, lease-owner concurrency, shared draft-creation refactor, DEC-0017)

Resumed from a prior session's draft plan
(`docs/drafts/cli-terminal-dashboard-draft-plan.md`, 2026-08-03/04) and two
learning candidates (`LC-20260804-001`, `LC-20260804-002`) via an explicit,
detailed resume prompt rather than starting from a summary. No milestone is
active; this work is governance/hardening outside the M001-M011 sequence,
the same category as the R-018 revert.

## TLKM Thesis: Verified, Not Assumed (2026-08-05)

The resume prompt said conversation `22d51621-...` was staged but possibly
stale, and that 4 of 6 assumptions were still `ambiguous` awaiting the user's
final calibrated numbers. Queried the real local database directly before
acting on either claim:

- `22d51621-...` (12:11:28) was indeed stale — never confirmed, no `theses`
  row references it. A **later** staging (`7bb5aefb-...`, 12:34:07) **was**
  confirmed into an active thesis (`168cd37c-...`, 12:45:25) — from an
  earlier part of the same prior session the resume prompt's summary had
  compressed away.
- That confirmed thesis already had all four previously-`ambiguous`
  measurement contracts resolved to specific numbers (≥30% NeutraDC
  ownership; ≥0pp segment-growth differential; MW-share-increases; ≥1200MW
  hyperscaler backlog and PLN capacity, both benchmarked to BDx). Per
  `LC-20260804-001`'s own rule, I could not tell from the database alone
  *who* chose these numbers — asked the user directly rather than assuming
  either way. **User confirmed they chose them.**
- All 6 research jobs had already run live and come back `degraded`
  (`issuer_source_unavailable`) — a real, unresolved finding, set aside for a
  separate discussion rather than folded into this session's scope creep.

## Five Pre-Existing Gaps Fixed (draft plan §8.0, 2026-08-05)

Re-verified all five claims against current code before asking the user
anything (all five still accurate). User chose "fix now" for all five:

1. **`generateDecisionRecommendation`** no longer asks the model to choose an
   investment action. `recommendedAction` removed from
   `decisionRecommendationSchema` entirely (not merely nulled); the prompt no
   longer offers 'Buy'/'Hold'/'Reduce'/'Exit'; `ResearchPanel`'s "AI
   Suggestion" + implicit action-apply relabeled to "Evidence Assessment" and
   scoped to outcome + rationale only.
2. **`decisions`** gained `evidenceIds`/`alternatives` (JSON array columns,
   migration `0010`) — `evidenceIds` auto-snapshots whatever evidence is on
   the panel when a decision is recorded (no new selection UI built); a new
   "Known Alternatives Considered" textarea feeds `alternatives`.
3. **`explorationDraftSchema`** gained a required `citation` field per
   candidate and `candidates` now requires 3-5 (was `.min(1).max(5)`) per
   `PRODUCT_STRATEGY.md` Workflow B. Updated the chat system prompt, mock
   fixtures, and `ChatUI` to match.
4. **`portfolioPositions.shares`/`averageBuyPrice`** removed; replaced with
   `status` (`owned`|`watchlist`), per `PRODUCT_STRATEGY.md` §3's explicit
   "does not collect quantity, cost basis, position value" line. Verified the
   real table was empty before generating the drop migration, so this
   carried zero data-loss risk. Verified `lib/portfolio/priorityQueue.ts`'s
   scoring never actually used these fields (alerts/staleness/challenged
   assumptions only), narrowing the real blast radius to `Sidebar.tsx`'s
   form and one API route pair.
5. Same commit as (4) — Sidebar's "Track Asset"/"Add Holding" form now
   collects the Owned/Watchlist tag instead of quantity/cost basis.

**Migration bug found and hand-fixed, not just generated and trusted.**
`drizzle-kit generate` produced a migration (`0010`) whose `INSERT ...
SELECT` referenced a `status` column on the *old* table shape, before that
migration's own `ALTER` added it — every temp-database test hit
`SqliteError: no such column: "status"`. Hand-corrected the SELECT to use the
literal default instead of the nonexistent column; re-ran the full suite to
confirm.

## Lease-Owner Concurrency Fix (roadmap §5 step 1, 2026-08-05)

`processResearchJobs`'s final-state writes previously filtered only on job
`id`; a worker whose lease was reclaimed by the sweep could clobber a later
claimant's state. Added `research_jobs.leaseOwner` (migration `0012`), a
`runId` per claim, every final-state write (`succeeded`/`degraded`/
`failed`/`unchanged`) now gated on `eq(leaseOwner, runId)`, plus a 20s
heartbeat renewing the lease for long-running jobs. `retryResearchJob` also
clears `leaseOwner`.

**Verification discipline applied, not just "test passes."** Wrote the
regression test, then **temporarily reverted the gate** on one write path and
confirmed the test failed with the expected error before reverting the
revert and confirming it passed. Same discipline applied a second time later
in the session (see below) — this is now the pattern for any fix whose test
could otherwise be passing vacuously.

## `createThesisFromValidatedDraft` Refactor (roadmap §5 step 2, 2026-08-05)

`confirmDraft` and `importThesisData` duplicated the same
theses/assumptions/measurements/jobs insert sequence independently — a real
risk for a future third CLI-intake copy. Extracted a shared function.

**A real conflict was found between the prior session's own draft plan and
current shipped behavior, surfaced to the user rather than silently resolved
either way.** The draft plan's literal wording said the shared function
should contain "the clarification gate." Doing that literally would make
`importThesisData` newly reject any package with an unresolved/
`legacy_unspecified` measurement contract — which real dogfood data
(`ISAT`, `ceccb31c-...`, all 8 assumptions `legacy_unspecified`) actually
has. Asked the user explicitly: apply the gate to both paths per the old
plan's wording (accept the regression), or keep import ungated (deviate from
the old plan, preserve today's behavior). **User chose to keep import
ungated.** `createThesisFromValidatedDraft` therefore does not call
`draftClarificationBlock` at all; each caller decides. Added a regression
test proving this, verified fail-then-pass the same way as the lease-owner
fix.

## `DEC-0017` Written and Accepted (2026-08-05)

Covers the CLI/Dashboard interface split, the WAL/lease-owner concurrency
model, and script design (the shipped `thesis:stage` stage-then-browser-
confirm pattern, which is a *stronger* gate than the stdin-confirmation
design the draft plan originally called for — the CLI session cannot
construct thesis state at all, browser click required). Explicitly records
`decisions:record`'s interactive-stdin-confirmation requirement as still
unbuilt, not retroactively satisfied. Every claim in it was verified against
running code/tests in this session, not asserted from the design doc.
Written `proposed`, then accepted by the user (approving authority) the same
day after reviewing.

## Documentation Sync (2026-08-05)

Prompted by the user asking directly whether "important docs" had been
updated too — they had not, beyond the DEC itself. Closed the gap:

- `docs/CODEBASE_MAP.md`: added the `leaseOwner` invariant to the Research
  Job State Machine section, the shared-insert-path note to "Thesis to exact
  Evidence", and schema notes for `PortfolioPosition.status` and
  `Decision.evidenceIds`/`alternatives`.
- `docs/drafts/cli-terminal-dashboard-draft-plan.md`: annotated every
  completed item (§4.2, §4.3, §5 steps 1/2/3, §8.0, §8.1's governance-record
  paragraph) with what actually shipped, including the ISAT-gate deviation.
  **Caught and corrected my own inaccurate claim before it was saved**: an
  early draft of this update asserted §5 step 6 (hide Chat UI from
  navigation) was also done: it is not — re-checked `components/Sidebar.tsx`
  directly and found "+ New" and the full conversation list still rendered
  as primary navigation, and corrected the claim before writing it.
- `docs/decisions/INDEX.md`: `DEC-0017` row added.
- `npm run context:generate` regenerated `docs/generated/code-index.json`;
  `context:check` and `status:check` both pass.
- `docs/RISK_REGISTER.md`: deliberately **not** given a new row — the
  concurrency defect was an implementation gap in already-accepted
  `ADR-0006` local-runtime scope, not a new provider or data-classification
  risk, matching `DEC-0017`'s own stated Risk Register Effects.

## Verified

Full suite: **356 passed, 3 skipped** (up from 354 at session start).
`tsc --noEmit` clean throughout. Migrations `0010`-`0012` applied and
verified directly against the real local database
(`d:/jp-invest-data/db.sqlite`, outside the test suite): all 14 pre-existing
`research_jobs` rows (including the real TLKM thesis's 6 `degraded` jobs)
survived intact; `portfolioPositions`/`decisions` tables were empty, so the
schema changes carried zero data-loss risk.

### Exact Resume Point

Nothing committed this session. Still open, not started:

- Roadmap §5 step 4 (Web App → Dashboard/Control Panel conversion:
  live-refresh, moving actions into an explicit control-panel surface).
- Roadmap §5 step 5 (concurrency/integration tests beyond the one
  lease-race test added this session: two `DatabaseHandle`s on one on-disk
  file, a worker-crash/retry test, an idempotency/duplicate-evidence test).
- Roadmap §5 step 6 (hide Chat UI from navigation) — confirmed **not** done,
  see above.
- `decisions:record` CLI script — not built; interactive-stdin-confirmation
  requirement still applies in full per `DEC-0017`.
- Ollama decision (§7.2) — not discussed this session.
- TLKM's 6 `degraded` research jobs (`issuer_source_unavailable`) — a real
  finding from this session's verification, deliberately not investigated
  further to avoid scope creep into the CLI-workflow work the user was
  actually resuming.

---

# Session Checkpoint - 2026-08-03 (M011 evidence polarity + measurement contracts)

Opened from an **external** finding rather than a fired review trigger: a
multi-model QA audit of a Tesla thesis, reviewed at the start of this session.
Three defects, all structural rather than prompting problems.

## What The Audit Found

1. **The system retrieved the right evidence and buried it.** Automotive gross
   margin of **16.9%** was retrieved against a thesis requiring above 20% — a
   breach at the baseline — and appeared as the fourth of five neutral bullets.
   An energy-storage margin *contraction* (30.3% → 20.4%) that falsifies an
   assumption outright was presented as context. Evidence carried topical
   relevance and no notion of direction.
2. **The claim was never made measurable.** "Automotive gross margin" has four
   defensible definitions and "through 2026" three time bases, so the claim was
   not actually falsifiable. The same gap produced the subtler error: FSD
   *deferred revenue* ($4.05B, a balance-sheet stock) offered as support for a
   claim about recognized revenue *growth* (an income-statement flow).
3. **Absence of evidence read as absence of concern.** Ten assumptions, five
   evidence items, four with zero evidence, no report of the gap.

The through-line, and the reusable framing: M009 fixed evidence **vocabulary**,
M010 fixed evidence **shape**, and both left a system that could retrieve
without being able to *judge*. M011 adds **meaning**.

## M011 Implemented (2026-08-03)

Planned via plan mode (3 Explore agents for the intake path, the evidence
pipeline, and governance conventions; 1 Plan agent for the design, which
corrected three things in the brief — `candidateFor` has *three* inline
`exact_verified` literals rather than one; `evidenceInsertValues` is a genuine
single choke point one layer down; and the chat route's re-extraction gate needs
**no** change, because a blocked draft never creates a thesis, so a
`hasPendingClarification` branch would be unreachable by construction).

Four user decisions taken before planning: include real SEC XBRL retrieval
(US-only); ship the polarity classifier as an off-by-default seam; make
clarification a **hard block** on confirmation; and take **no** auto-transition
on `assumptions.status`.

Six slices, all shipped:

- **Slice 1 — measurement contract.** `assumption_measurements` (migration
  `0008`, 1:1 via `assumption_id` as primary key, with a hand-appended
  idempotent backfill). A separate table over nullable columns or a JSON blob:
  eight nullable columns represent "unresolved" in 2^8 indistinguishable ways,
  and unparseable JSON degrades silently to "no contract" then to "no breach
  detected", which is the exact failure class this milestone exists to fix.
- **Slice 2 — clarification hard block.** The prompt was **amended, not
  reversed** — the anti-withholding sentence exists because the model once
  withheld drafts entirely (2026-07-30), so ambiguity routes into the
  measurement block and only *confirmation* is blocked. `draftClarificationBlock`
  is one pure predicate shared by `ChatUI` (disables the button) and
  `confirmDraft` (refuses outright). Both ship: a disabled button is not a
  control.
- **Slice 3 — evidence polarity.** Three real columns (migration `0009`), not
  `evidence.metadata` JSON as R-018's flag uses: that flag failing to parse
  costs a visible banner, whereas polarity failing to parse costs "no
  contradiction found" — silently, in the direction of reassurance. Computed in
  `evidenceInsertValues`, **not** in `CitationPipeline`, whose per-candidate
  `catch {}` would turn a polarity bug into silent evidence *deletion*. The
  `contract` argument was made required rather than optional specifically to
  force a compile error at all three call sites.
- **Slice 4 — SEC XBRL.** `SecCompanyConceptSource` is deliberately **not** a
  `SourceAdapter` — a keyed numeric fact series has no prose for
  `verifyExactMatch` to check — so it emits `derived` evidence and inherits that
  trust ceiling for free. `factSatisfiesTimeBasis` is the structural fix for the
  deferred-revenue conflation. `resolveSecCik` was lifted out of `SecAdapter`,
  proven behaviour-neutral by `tests/source-adapters.test.ts` passing
  **unmodified**.
- **Slice 5 — coverage and verdict.** Both pure, both server-side, both computed
  once and shared between the panel and the model prompt (computing them twice
  is how the two drift). The verdict renders lexically **outside**
  `.panelContent`, so the anti-burial property is a JSX fact rather than a
  convention. `generateDecisionRecommendation` narrows its own output schema
  under a breach or suppression, enforced by `safeParse` and propagated into the
  model's grammar by `z.toJSONSchema`.
- **Slice 6 — evals and governance.** `MM-024`/`MM-025` with real dispatch arms,
  DEC-0016, R-027, and the doc set.

## Three Findings Worth Keeping

**The browser layer caught the real regression again — second milestone
running.** `polarityBadge` read `record.deltaVsThreshold.toFixed()` without
checking the field was present. A route-mocked `/api/research` payload predating
M011 omits it, which white-screened the *entire* Research panel with
`Cannot read properties of undefined`. Any older client cache or partial
response would have hit the same crash in production. vitest could not have
found it; nothing unit-tests that component.

**The eval cases were proven capable of failing, not assumed to be.** Following
M010's lesson that a case absent from `deterministicNotes`' dispatch can never
fail, both new cases were deliberately tampered with — `MM-025`'s expected
outcome flipped to `supports`, `MM-024`'s time basis relaxed to `instant` — and
the report was confirmed to emit `MM-024:balance_offered_for_flow_claim` and
`MM-025:contradiction_reported_as_support` with both marked `unsupported`. The
tamper was reverted and the clean result re-verified.

**A pre-existing e2e fragility surfaced and was confirmed pre-existing rather
than assumed.** The `sidebar title updates` test matched "New Thesis" globally
while the suite shares one SQLite file, so accumulated conversations tripped
Playwright strict mode. Confirmed by re-running the suite with M011's new case
excluded — it still failed. Fixed by scoping the assertion to the conversation
under test via its own `href`.

## Verified

`typecheck`/`lint`/`build` clean. Suite **354 passed / 3 skipped**, up from a
confirmed **255** baseline measured at session start rather than assumed from a
stale count. `test:e2e` **7/7** (up from 5). `eval:m001:multimodal` and
`eval:m001:provider --mode deterministic`: `additionalCaseCount` 23 to **25**,
0 hard-gate failures in both. `context:check` and `status:check` pass.

## Honest Limits Recorded, Not Smoothed Over

- **Live read-only probe done; the write path is still unproven.** A probe
  against real `data.sec.gov` data drove the real retrieval → selection →
  candidate → polarity chain: TSLA `GrossProfit` returned 282 facts (all
  `duration`; latest 10-Q quarter selected, $4.751B, classified `supports`), and
  `DeferredRevenueCurrent` returned 58 facts (**all `instant`**) which a
  `duration_quarter` claim correctly refused — the deferred-revenue defect
  refused against genuinely filed data rather than a fixture. Outbound logging
  captured every request and the ticker map was fetched once, confirming the
  shared-client cache. **But no evidence row has been persisted from a live
  XBRL response**, because the live database holds only an ID-market thesis and
  creating a US one would mean writing to real user data. That is what R-027's
  trigger now names.
- **A live-only finding worth carrying:** `DeferredRevenueCurrent`'s newest fact
  ends **2018-03-31** — Tesla migrated off that tag at ASC 606 adoption. Real
  tag drift over time argues for measurement contracts naming several candidate
  tags rather than one, which the schema already allows (up to 8) but nothing
  currently exploits.
- **Polarity is only ever non-`inconclusive` for structured-fact evidence**,
  because `classifyPolarity` deliberately refuses to scrape numbers out of quote
  text. Structured facts are US-only, so the app's live tracked ticker (TLKM,
  Indonesian) gets a named `no_source_for_market` gap and no polarity at all.
- **`MIN_COVERAGE_RATIO = 0.7` is a product judgment**, not a calibrated number.
- **Suppression constrains the structured decision, not the register of the free
  text.** A model can still write reassuring `rationale` prose beneath a breach;
  the headline-prepending backstop is a mitigation and is labelled as one.
- **Every pre-M011 thesis now reports `insufficient_evidence`**, because the
  `0008` backfill gives it a `legacy_unspecified` contract. That is true — those
  theses have no basis against which any claim could be checked — and the
  backfill exists so the UI can say the accurate thing rather than the ambiguous
  thing. Accepted deliberately at planning time.
- **R-025 stays `Open`.** M011 narrows semantic relevance for structured-fact
  evidence only; text-derived secondary evidence is exactly where M010 left it.

### Exact Resume Point

Nothing is committed — all M011 code, test, migration, eval, and governance-doc
changes are unstaged working-tree changes as of this entry, alongside the
pre-existing uncommitted M010-era changes that were already in the tree at
session start.

Suggested next, in priority order: (1) commit M011; (2) run a live
`processResearchJobs` against a **US** thesis with real `us-gaap` tags — R-027's
own stated trigger, and the only thing that would move XBRL retrieval from
fixture-proven to real; (3) R-018, still the highest-impact open item
(embedded-instruction injection mitigation is regex-only in production).

---

# Session Checkpoint - 2026-07-27 (M010 structural evidence precision)

Opened by verifying M009 live, per `docs/RISK_REGISTER.md`'s own stated review
trigger for R-025 — and the trigger fired. The verification found a new failure,
which became M010, implemented and governance-closed the same session.

## R-025's Trigger Fired (2026-07-27)

A live `npm run research:refresh` ran clean but produced no new evidence, so it
proved nothing on its own — document-level dedup on `(market, ticker)`
short-circuited before extraction. To get a real test, the live TLKM newsroom
page was fetched directly and run through the actual production `extractHtml` +
`extractSecondaryCandidates`, bypassing that unrelated dedup. Two of M009's
three known boilerplate fragments were gone (DOM stripping confirmed working
live), and a genuine positive control passed. But a real tracked assumption
("Indonesian enterprise demand for data center capacity remains strong through
2026") produced a category-filter widget as evidence-grade output.

It cleared all three M009 mechanisms by matching the literal word "Enterprise" —
a nav category label colliding with the assumption's genuine word "enterprise" —
so the ticker/bare-year rule did not apply and no denylisted phrase was present.

**The diagnosis, which is the reusable part:** M009's three mechanisms all
filter on *vocabulary*. This was a failure of *shape*. That is why it kept
feeling like "the same problem again" — the fixes were addressing words while
the defect was structural.

## M010 Implemented (2026-07-27)

Planned via plan mode (2 Explore agents for governance conventions and the
extraction pipeline, 1 Plan agent for the design; the Plan agent empirically
reproduced the defect against the four retained snapshots on disk and corrected
the brief — it found a fifth `ExtractedPage` construction site,
`scripts/eval-m001-multimodal.ts:243`, which is hard-gated). Three user
decisions taken before planning: hand-rolled fix over a Readability dependency;
fix discovery as well as extraction; clean up the already-persisted rows.

Three structural holes were confirmed and fixed:

- **Slice 1 — segmentation.** `extractHtml` joined block elements with a space,
  which `normalizeText` collapses, so a nav widget reached `splitSentences` as
  one punctuation-free run-on that `Intl.Segmenter` returns as a single giant
  segment. Now marked with a `U+FFFC` sentinel exposing `ExtractedPage.blocks`.
  The sentinel was chosen empirically, not assumed: `U+0000` does **not**
  survive cheerio's `.append()` (parse5 drops it) and `U+E000` is PUA, which
  icon-font sites legitimately emit. Includes a collision guard that falls back
  to the legacy path.
- **Slice 2 — shape guards.** A 400-character cap and an 8-14 word band for
  unpunctuated text, both secondary-tier only. `segmentationUnits` reduces to
  literally the pre-M010 expression for `'official'`.
- **Slice 3 — listing-page guard.** `discoverIssuerPressReleases` accepted any
  link whose *enclosing container* mentioned a press-release term, so nav links
  won the `discovery.value[0]` slot and the pipeline was mining the listing
  page. Five rejection rules + dedupe + month-name date parsing (`publishDate`
  had been `null` in practice because the regex only matched `2026-07-21`
  shapes while real anchors read "21 Juli 2026").
- **Slice 4 — cleanup.** A sweep that re-derives rather than pattern-matches:
  stale iff the fixed extractor no longer produces the quote from the retained
  snapshot. Self-validating — under-fixing would visibly under-delete.

**Two findings worth keeping.** First, a test written during the milestone
caught a real gap rather than passing decoratively: the punctuation-free nav
run-on survived the initial 8-word floor (18 words, under the 400 cap). Rather
than weaken the assertion, the guard became a bounded *band* — unpunctuated text
must be headline-shaped. Second, `npm run typecheck` caught a wrong enum value
in a test (`interpretationStatus: 'accepted'`; the real values are
`'pending' | 'deterministic' | 'model'`) that vitest had accepted at runtime,
because SQLite does not enforce the enum.

## Verified

`typecheck`/`lint`/`build` clean; suite **237 passed / 3 skipped** (up from
206); M001 multimodal + provider evals unchanged at `additionalCaseCount: 23`
with 0 hard-gate failures (load-bearing: MM-021/022/023 hard-gate an empty
result, so over-filtering would have failed loudly); `context:check` and
`status:check` pass; `test:e2e` 4/4.

Beyond fixtures: `canonicalText` byte-identical to a faithful re-implementation
of the pre-M010 derivation on **all four** retained real snapshots, with
`blocks.join(' ') === text` holding on each; discovery on the retained newsroom
snapshot goes 29 refs (first 13 junk, `[0]` the discovery page itself) → exactly
the 9 genuine articles, correctly dated, newest first.

Live end-to-end: an explicit DB backup was taken
(`db-before-m010-cleanup-2026-07-27T21-30-52.sqlite`) before `--apply`, since
the automatic backup only fires on migrations. Cleanup reported 15 scanned / 15
stale / 0 kept / 0 unresolvable; after applying, 0 evidence rows remained, 7
assumptions reverted to `untested`, all 4 snapshots retained, second run a clean
no-op. `research:refresh` then fetched a genuine `/news/...` article instead of
the listing page, persisting 2 rows of real press-release prose.

## Honest Limits Recorded, Not Smoothed Over

- **R-025 was deliberately returned to `Open`**, not amended. Its own trigger
  fired, so M009's mitigation is recorded as necessary but insufficient.
- The post-fix live run's 2 rows come from a *culture-festival* press release,
  one matched partly on division names ("Enterprise Business Strategy",
  "Wholesale Service"). Genuine article prose rather than site chrome — which is
  what M010 claims — but not obviously material to a data-centre thesis. M010
  fixes shape, not semantic relevance.
- Both shape thresholds are calibrated on a handful of real examples from one
  site. The 14-word ceiling sits between one genuine 10-word headline and one
  18-word nav run-on.
- `extractPdf` and the vision path deliberately emit no blocks, so a
  secondary-tier PDF still reaches the ranker in the pre-M010 run-on shape.
- `promoteCandidate` still fetches whatever URL the search provider returns with
  no shape check. A link-density classifier was measured (0.030 / 0.101 / 0.328
  / 0.031) and **not** built — no article-page counter-example exists to
  calibrate against, and guessing could silently zero out a legitimate page.

### Exact Resume Point

Nothing is committed — all M010 code, test, and governance-doc changes are
unstaged working-tree changes as of this entry. The M009 learning-promotion
reviewer-independence question from the prior session remains open and still
needs the user's own confirmation.

Suggested next: commit M010, then either run a live secondary-source job against
a **different** issuer (R-025/R-026's stated next review trigger — every M010
rule is validated against one site) or pick up R-018, still the highest-impact
open item (embedded-instruction injection mitigation is regex-only in
production; the multilingual `InstructionClassifier` exists but nothing wires it
in by default).

---

# Session Checkpoint - 2026-07-26 (M009 implemented + learning-promotions reviewed)

Continues directly from the "M008 first live run + M009 drafted" entry
below — same day, later in the session. That entry's "Exact Resume Point"
said M009 was drafted but not accepted; this entry records that it was
reviewed, accepted, implemented, and governance-closed in this session.

## M009 Reviewed, Accepted, and Implemented (2026-07-26)

Before implementation, the M009 packet got two independent code-level
reviews, not one: mine (read the packet, R-025 register row, ROADMAP, and
`candidate.ts`/`document.ts`/`pipeline.ts` directly) and a second AI
collaborator's (Gemini, same workspace, prompted separately by the user and
relayed back). Both independently confirmed the root cause from the code
itself, and both converged on the same sharpening of the packet's Slice 3
design: of the three real TLKM boilerplate examples, the CSR/coral-reef
press release isn't boilerplate at all — it's genuine, on-domain,
topically-irrelevant content that only clears the pre-fix threshold via
ticker+year tokens, so no DOM stripping or phrase denylist could ever catch
it; only a threshold fix could. That became Slice 3's actual mechanism.

Planned via the plan-mode workflow (2 Explore agents for eval/test
infrastructure and governance-doc conventions, 1 Plan agent for the
implementation design, then a user-confirmed decision on scope: ticker +
bare-year exclusion only, company-name exclusion explicitly deferred since
no such field exists in the call chain, recorded as residual risk rather
than silently widened). Plan approved 2026-07-26.

Implemented all four slices in `lib/research/extractors/document.ts` and
`lib/research/extractors/candidate.ts`:

- **Slice 1 (DOM stripping):** `extractHtml`'s removal selector now
  includes `nav, header, footer, aside` plus common cookie/consent-vendor
  class/id patterns (case-insensitive `[class*="cookie" i]`-style
  attribute selectors — confirmed working against the installed
  `cheerio@1.2.0` with a direct `node -e` check before relying on it, not
  assumed). Added a new official-tier HTML-chrome regression fixture
  (nav/header/footer/cookie-banner wrapping dense filing text) since none
  existed for either tier before this session — a real coverage gap found
  during review, not hypothetical.
- **Slice 2 (phrase denylist):** new `BOILERPLATE_PHRASES` const in
  `candidate.ts` (English + Indonesian: "cookie policy", "all rights
  reserved", "kebijakan privasi", etc.), checked before scoring in
  `rankSentenceCandidates` — an outright exclusion, not a score penalty.
- **Slice 3 (secondary-tier threshold re-tune):** `rankSentenceCandidates`
  now takes a `sourceTier: 'official' | 'secondary'` parameter (literal at
  each of its two call sites, never computed at runtime); for
  `'secondary'` only, a candidate needs at least one qualifying token
  match beyond the ticker itself or a bare four-digit year. The official
  path's output is byte-for-byte unchanged (proven, not just argued) since
  `extractDeterministicCandidates` always passes `'official'`.
- **Slice 4 (governance close-out):** `docs/RISK_REGISTER.md` (R-025 →
  `Mitigated`, with explicit residual-risk language — company-name tokens
  not excluded, denylist only covers listed phrasing, cross-page detection
  not built since the pipeline fetches one document per adapter call),
  `ACTIVE_MILESTONE.md`, `docs/milestones/ROADMAP.md`,
  `docs/CODEBASE_MAP.md`, and the M009 packet's own new "Slice Outcomes"
  section.

Verified: `typecheck`/`lint` clean; full suite 206 passed / 3 skipped (up
from a confirmed 199 baseline — checked by temporarily stashing the M009
code changes and re-running, not assumed from a stale prior count); 7 new
adversarial tests in `tests/document-extraction.test.ts` reproduce all
three real TLKM failures plus two explicit non-regression cases; `build`
clean; `context:generate`/`context:check` and `status:check` pass;
`eval:m001:multimodal` and `eval:m001:provider` (deterministic) both show
unchanged case count (23) and 0 hard-gate failures, proving official-filing
recall unregressed. `test:e2e` (Playwright) initially skipped in this
session (blocked by the pre-existing Turbopack dev-server crash on port
3000, PID 19920) — later resolved with the user's explicit go-ahead: killed
PID 19920, let Playwright's own `webServer` config start a fresh dev server,
4/4 pass, confirming no UI regression (M009 touches no UI code).

Also applied, same go-ahead: `ISSUER_SOURCE_URLS` in `.env` now includes
TLKM (`https://www.telkom.co.id/sites/about-telkom/en_US/page/investor-relations-3054`,
a real investor-relations page verified reachable via WebFetch before
adding, same shape as the existing BBRI entry, not a placeholder guess) —
closes the M008-live-run finding that the official IDX path was degraded
for TLKM only because this allowlist wasn't populated.

Still nothing is committed. All M009 code, test, governance-doc, and `.env`
changes are unstaged working-tree changes as of this entry.

## Learning-Promotions Pipeline Reviewed (2026-07-26)

While this session's M009 work was in progress, the Gemini/Antigravity
collaborator concurrently promoted three pre-existing learning candidates
(`LC-20260725-001/002/003`, M006-derived) and captured + promoted a new one
(`LC-20260726-001`, documenting almost exactly the same M009 root cause
independently) into `.agents/QUALITY.md`/`.agents/SECURITY.md`. These
showed up as unexpected working-tree diffs mid-session; confirmed they
don't conflict with any M009 file before continuing.

At the user's request, reviewed this promotion batch independently against
`.agents/LEARNING.md`'s schema and process rules, `docs/learning/
CANDIDATE_TEMPLATE.md`, and by directly re-verifying each candidate's
technical claims against the actual code (not just trusting the candidate
text). Findings, reported to the user, not yet acted on:

- **Confirmed schema defect:** `LC-20260725-002`'s `Task type: security` was
  not a valid enum value per the template. Resolved — by the time the fix
  was attempted, the Gemini/Antigravity collaborator had already corrected
  it independently (now `planning`) and had also added the previously
  missing "Related review finding or incident" line to all four candidates,
  without being asked — both findings self-resolved by the other
  collaborator mid-session.
- **Structural gap, not a confirmed violation:** the candidate template has
  no author/"captured by" field, only a `Reviewer` field — so
  `LEARNING.md`'s "an independent reviewer did not author the candidate"
  requirement is unverifiable from the artifacts alone. All four candidates
  here list the same reviewer (Antigravity/Gemini) who plausibly also
  authored them, given they surfaced during that same agent's own
  concurrent work. Flagged for the user to confirm, not asserted as a
  violation.
- No privacy/secret violations found. One judgment call flagged, not a
  violation: `LC-20260726-001` names the real ticker `TLKM` and a
  conversation ID — defensible given the content is a bug-triage pointer,
  not thesis reasoning, but worth the user's explicit sign-off given this
  project's precedent (DEC-0011) of classifying decision data more
  conservatively than instinct suggests.
- No authority-hierarchy violations: nothing touches `AGENTS.md`, DB
  contracts, runtime prompts, or model routing; all four promoted-text
  targets were independently confirmed to actually contain the claimed text
  verbatim, not just claimed in the registry.
- Overall verdict given to the user: approved, conditional on the one
  schema fix and the one open reviewer-independence question above. The
  schema fix resolved itself (see above); the reviewer-independence
  question is still genuinely open and unverifiable from the artifacts —
  not something either agent can resolve unilaterally.

### Exact Resume Point (updated — all four items below resolved same session)

1. **TLKM added to `ISSUER_SOURCE_URLS`** in `.env` (real, WebFetch-verified
   investor-relations URL) — closes the M008-live-run config gap.
2. **`LC-20260725-002`'s `Task type` field** — already fixed by the other
   collaborator before this session acted on it.
3. **Dev server on port 3000 restarted** (killed stale PID 19920, let
   Playwright's `webServer` config start a fresh one) and **`test:e2e` now
   run**: 4/4 pass, confirming no UI regression from M009.
4. **Commit decision:** M009 (code + tests + governance docs) and the
   concurrent Gemini/Antigravity learning-promotion changes were kept as
   two separate commits — different authorial units of work, easier to
   revert/amend independently if the still-open reviewer-independence
   question above needs later action.

Still open, not this session's problem to solve: the reviewer-independence
question from the learning-promotions review (item above) — needs the
user's own confirmation, not a code fix.

---

# Session Checkpoint - 2026-07-26 (M008 first live run + M009 drafted)

**Note:** M008 (web search discovery) shipped and was marked `complete` in
`ACTIVE_MILESTONE.md` on 2026-07-26, but no session-checkpoint entry was
written for it at the time — this entry starts from that gap; M008's own
packet (`docs/milestones/M008-web-search-discovery.md`) remains the
authoritative record of what M008 itself shipped.

## M008 First Live End-to-End Run (2026-07-26)

Ran the full M008 pipeline live for the first time (previously only tested
via mocks/fixtures): confirmed a real TLKM thesis draft in conversation
`f5f230f6-23ea-4e86-a73a-cb55b04630c3` (`thesis.id =
2e10b4c2-c642-4f0b-9d35-7498292931f8`) through a headless-browser session
against the running dev server, then inspected the live SQLite DB and
`logs/outbound.log` directly rather than trusting the UI alone.

- **Discovery → domain gate → promotion worked correctly, live, for the
  first time.** Tavily returned 10 candidates; 8 correctly `rejected:
  domain_not_allowlisted` (notably including `idx.id`'s own static-data PDF
  URL and `telkomsel.com` — a TLKM subsidiary on a *different* domain — both
  plausible-looking but correctly refused); 2 matched `telkom.co.id`,
  fetched, and were promoted into `secondary_issuer` evidence. R-013's
  residual-risk note updated with this real outcome (was previously an
  estimate; the allowlist-population gap it was tracking is now closed).
- **Official IDX path degraded** (`issuer_source_unavailable`) — traced to
  `ISSUER_SOURCE_URLS` (a *different* env var from the M007/M008 secondary
  allowlists) only having `BBRI`, not TLKM. `logs/outbound.log` confirms the
  real IDX announcement API was actually called (200) but didn't yield a
  document to use before falling back. Not an M008 bug — a pre-existing,
  separate config gap. Quick fix identified, not yet applied: add TLKM to
  `ISSUER_SOURCE_URLS` in `.env`.
- **New finding — R-025 (evidence precision, not yield).** Several of the 15
  persisted `secondary_issuer` evidence rows are semantically irrelevant
  boilerplate: one assumption about competitive pricing was backed by the
  issuer's cookie/privacy-policy text; one about macro conditions was backed
  by an unrelated CSR coral-reef-restoration press release; the same
  nav-menu paragraph was persisted verbatim as "evidence" for three
  different assumptions. Root cause verified directly against the code (not
  assumed): `rankSentenceCandidates` (`lib/research/extractors/candidate.ts`)
  was tuned for dense, boilerplate-free official filings (M001–M006) and
  reused unchanged when M007/M008 opened raw web HTML into the same path;
  `extractHtml` (`lib/research/extractors/document.ts`) strips
  `script/style/noscript/template/svg` but not `nav/header/footer/aside`. A
  second AI collaborator (Gemini, same workspace) independently reached the
  same root cause from the same two files and confirmed the prioritization —
  used as a genuine second opinion, not a formality. R-010's structural
  trust-tier gate still holds (nothing mislabeled `exact_verified`/
  `ocr_matched`); this is a precision gap within the correctly-tiered
  `secondary_issuer` class.
- **Unrelated infra finding:** a second page load crashed Next's Turbopack
  compiler-worker pool (`"Jest worker encountered 2 child process
  exceptions, exceeding retry limit"` — Next's internal build-worker
  library, unrelated to the Jest test framework despite the name). `/c/[id]`
  routes 500'd afterward; `/` and `/portfolio` kept serving fine. The dev
  server (port 3000) was already running before this session touched it and
  was **not restarted** — flagged, not fixed, to avoid disrupting anything
  left open in that terminal. Likely just needs a restart next session.

## M009 Drafted (proposed, not yet accepted) — Secondary Evidence Boilerplate Filtering

Governance-only so far — no code changed. Per this session's "full
governance path" choice: risk entry first, then a full milestone packet,
before any implementation.

- `docs/RISK_REGISTER.md`: new **R-025** row (`Open`, Data Trust, High/High)
  with the verified root cause and the three real TLKM examples as evidence.
  Pending review trigger from the prior session (first live
  `processResearchJobs` run against the newly-populated allowlists) closed
  out with the real outcome.
- `docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`
  (`proposed`): full packet — DOM-level boilerplate stripping in
  `extractHtml`, a phrase-level boilerplate denylist in
  `rankSentenceCandidates`, and a secondary-path-specific threshold
  re-tune, deliberately **not** a global threshold change (would risk
  regressing official-filing recall M001–M006 already validated). 4
  implementation slices scoped, not started. No new decision record needed
  — governed under the already-accepted DEC-0015.
- `docs/milestones/ROADMAP.md`: M009 entry added, sequenced after M008.
- `npm run status:check` and `npm run context:check` both pass after these
  doc changes.

### Exact Resume Point

**M009 is drafted but not yet accepted by the user.** Nothing implemented.
Before writing code: get explicit acceptance of the M009 packet (or
requested changes to it). Once accepted, implement in the 4 scoped slices
(DOM stripping → phrase denylist → secondary-threshold re-tune → governance
close-out/eval re-run), per
`docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`.

Two small, independent, not-yet-applied fixes noted above but out of M009's
scope, safe to do anytime: add TLKM to `ISSUER_SOURCE_URLS` in `.env`;
restart the dev server on port 3000 (Turbopack worker crash).

---

# Session Checkpoint - 2026-07-25

## M007 Slice 1 — Schema (done 2026-07-25)

Milestone: [`docs/milestones/M007-secondary-source-ingestion.md`](docs/milestones/M007-secondary-source-ingestion.md)
(`accepted`), governed by [`DEC-0015`](docs/decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
(`accepted`). Packet co-drafted with a second AI collaborator (Gemini,
working in the same VS Code workspace) — I corrected three issues in their
draft before treating it as final: a premature "R-010/R-013 already
Mitigated" claim (fixed to "currently Open, aims to mitigate," matching this
repo's evidence-first convention), and two missing template sections
("Workflows, States, and Recovery Behavior", "Assumptions, Risks, and
Explicit Deferrals" — the section that's supposed to catch exactly the
premature-Mitigated problem).

Verified 131 passed / 3 skipped (up from 130), typecheck/lint clean.

- `db/schema.ts`: `assumptions.status` widened with `'pending_confirmation'`
  and `'user_confirmed_secondary'` (Drizzle `{enum:}` — TS-only narrowing,
  confirmed no `CHECK` constraint exists anywhere in `db/migrations/*.sql`,
  so this needed no migration). `evidence.verificationStatus`'s comment
  widened (it was already a bare, unconstrained `text()` column — also no
  migration). New `discoveryCandidates` table (`discovery_candidates`):
  pre-fetch candidate URLs for the *deferred* Class C (web-search discovery)
  path — deliberately not populated by anything in M007, and deliberately a
  different table from the pre-existing `sourceDiscoveries` (which requires
  an already-fetched, hashed document and can't represent a pre-fetch,
  possibly-never-resolved candidate). No snippet/title column exists on it
  by design — a type-level guarantee search text can never be persisted.
- Migration `db/migrations/0007_add_discovery_candidates.sql` generated via
  `npx drizzle-kit generate --name=add_discovery_candidates` (not hand-authored
  — this repo's migrations are tracked via `db/migrations/meta/_journal.json`
  + a matching snapshot, which the CLI produces correctly; confirmed the
  generated diff touched *only* the new table, nothing else, validating the
  no-DDL-for-enum-widening finding).
- `lib/domain/contracts.ts`: `assumptionStatusSchema` and both
  `verificationStatus` zod sites (`EvidenceDTO`, `thesisExportSchema`)
  widened to match.
- `tests/migrations.test.ts`: new case proving the widened enum values
  round-trip, the `assumptions` table's `CREATE TABLE` SQL contains no
  `CHECK` (the schema-level claim this design rests on), and
  `discoveryCandidates`'s unique index + null-by-default
  `resultingDocumentHash` behave as specified.

## M007 Slice 2 — Extractor/Candidate Layer (done 2026-07-25)

Verified 135 passed / 3 skipped (up from 131), typecheck/lint clean.

- `lib/research/extractors/candidate.ts`: widened `EvidenceVerificationStatus`;
  added two `EvidenceCandidate` branches (`secondary_issuer`, `secondary_news`);
  added `createSecondaryIssuerCandidate`/`createSecondaryNewsCandidate`
  factories; refactored the shared sentence-ranking logic out of
  `extractDeterministicCandidates` into a new `rankSentenceCandidates` helper
  so both it and the new `extractSecondaryCandidates` use identical scoring.
  `extractSecondaryCandidates` is a dedicated sibling function (not a branch
  inside `extractDeterministicCandidates`) — its only return paths call the
  two new factories, so it has no code path capable of constructing
  `exact_verified`/`ocr_matched`, regardless of the input document's
  `sourceVariant`. This is the R-010 structural gate.
- **Deliberate simplification from the packet's literal wording**: the
  packet said secondary metadata "carries `{ publisherName }` /
  `{ publisherName, wireService }`." Skipped as redundant —
  `VerifiedEvidence.sourceName` (set from `SourceSnapshot.sourceName` at the
  pipeline level, unchanged) already carries publisher/wire-service identity
  for every evidence class; duplicating it into candidate metadata would
  just be two names for the same fact. Both new branches keep `metadata`
  optional/freeform, matching `exact_verified`/`ocr_matched`'s precedent
  rather than `derived`'s required shape.
- **Extractor field choice**: both factories hardcode
  `extractionMethod: 'html_parser'` and `sourceVariant: 'text_layer'` —
  reused rather than widened, since Class A/B documents are genuinely
  HTML-parsed pages; no new `EvidenceExtractionMethod` value was needed.
- **Ripple, expected and handled in-slice**: widening `EvidenceCandidate`
  broke `lib/research/pipeline.ts`'s `VerifiedEvidence.verificationStatus`
  (was hardcoded to the old 3-value union). Widened it to
  `EvidenceVerificationStatus` — a type-only change. The pipeline's actual
  behavioral bug (the branch that would reject every secondary candidate at
  runtime) is **not** fixed yet — that's Slice 4, on schedule, and confirmed
  still present by design at this point.
- Tests (`tests/document-extraction.test.ts`, 28 → 32): both secondary
  classes extract correctly; an adversarial case feeds a `scanned` document
  into `extractSecondaryCandidates` and confirms it still only ever produces
  `secondary_issuer`/`secondary_news`; factories proven to hardcode their own
  status.

## M007 Slice 3 — Adapters, Class A + B (done 2026-07-25)

Verified 142 passed / 3 skipped (up from 135), typecheck/lint clean,
`npm run build` clean.

- New `lib/research/adapters/issuer-press.ts` (`IssuerPressReleaseAdapter`,
  `discoverIssuerPressReleases`): sibling to `IssuerAdapter`, always sets
  `sourceTier: 'secondary'`, uses its own `PRESS_RELEASE_TERMS` list, and
  deliberately drops `IssuerAdapter`'s `.pdf`-only filter (press releases are
  typically HTML).
- New `lib/research/adapters/news-wire.ts` (`NewsWireAdapter`,
  `parseNewsFeedItems`): first feed-based (not page-crawl) adapter in this
  codebase — no existing precedent to mirror. Parses RSS `<item>`, Atom
  `<entry>`, or a JSON `items` array; no new dependency (`cheerio`'s
  `xmlMode: true`, already installed). Filters items by ticker
  (word-boundary regex against title+description) after fetching, since one
  feed typically covers many tickers. A single unreachable/broken feed never
  blocks matches from the other configured feeds (proven by test).
- **Real bug my own test caught before it shipped**: `PRESS_RELEASE_TERMS`
  initially only had hyphenated/underscored forms (`press-release`), which
  matched URL paths but not rendered link text ("press release" with a
  space). The discovery test failed against a realistic link-text fixture,
  which is how this was found — fixed by adding space-separated forms
  alongside the URL-path forms.
- New `lib/research/adapters/mock-issuer-press.ts`/`mock-news-wire.ts` for
  `RESEARCH_SOURCE_MODE=mock`, mirroring `mock-sec.ts`'s shape.
- `lib/research/adapters/factory.ts`: new sibling `createSecondarySourceAdapters()`
  returning `Record<ResearchMarket, { issuerPr?; newsWire? }>` — deliberately
  not a change to `createSourceAdapters()`'s existing return shape (other
  code/tests depend on it). Both fields optional per market/ticker; a
  missing config is `undefined`, never an error.
- `lib/research/config.ts`: `getIssuerPressReleaseUrls()`/`getNewsWireFeedUrls()`,
  mirroring `getIssuerSourceUrls()`. New env vars `ISSUER_PRESS_RELEASE_URLS`
  (ticker → URL, like the existing issuer map) and `NEWS_WIRE_FEED_URLS`
  (publisher name → feed URL — not ticker-keyed, since one feed covers many
  tickers).
- `lib/research/adapters/types.ts`: new `SourceErrorCode` value
  `'news_wire_source_unavailable'`; `IssuerPressReleaseAdapter` reuses the
  existing `'issuer_source_unavailable'` (same conceptual role as
  `IssuerAdapter`'s).
- **Two known, deliberately unsolved limitations, documented in-code** (not
  silently absorbed): (1) article links must resolve to the same origin as
  their feed URL — a feed whose articles live on a different domain will
  fail closed (`source_access_denied`) rather than silently trust an
  unconfigured domain; (2) ticker-symbol matching only, not also legal-name
  matching as DEC-0015 §4 describes — would need either a new field on the
  shared `SourceQuery` type (used by every adapter) or a separate
  ticker→legal-name map, a larger cross-cutting change deferred as a
  follow-up.
- Tests (`tests/source-adapters.test.ts`, 9 → 16): press-release discovery
  (HTML, no `.pdf` requirement, always `secondary`); RSS/Atom/JSON feed
  parsing; ticker filtering; multi-feed soft-failure isolation; clean
  `unavailable` (never a throw) when no feed matches.

## M007 Slice 4 — Pipeline/Service Integration + Bug Fix (done 2026-07-25)

Verified 146 passed / 3 skipped (up from 142), typecheck/lint/build clean.

- **Plan deviation, reasoned not silent**: skipped adding the planned optional
  `documentTypes` parameter to `executeResearchJob` — verified neither new
  Slice 3 adapter reads `query.documentTypes` at all, so the parameter would
  have been dead API surface. Only `evidenceClass: 'official' | 'secondary_issuer' | 'secondary_news' = 'official'`
  was added.
- `lib/research/pipeline.ts`: **fixed the confirmed pre-existing bug** — the
  verification branch's final `else if (!candidate.metadata?.method...)` was
  unconditional (meant for `'derived'` only) and would throw for any
  non-official class; narrowed to `else if (verificationStatus === 'derived')`,
  with a new `else` branch for `secondary_issuer`/`secondary_news` that
  verifies the quote appears in `extracted.canonicalText` (proves it wasn't
  hallucinated) but never sets `canonicalTextHash` or promotes the status —
  that stays reserved for `exact_verified` alone. `executeResearchJob` now
  routes to `extractSecondaryCandidates` when `evidenceClass !== 'official'`.
  Proven end-to-end by a new pipeline-level test in
  `tests/document-extraction.test.ts` (32 → 34) — would have produced zero
  evidence if the fix regressed.
- `lib/research/service.ts`: `processResearchJobs` now calls two additional
  secondary passes per claimed job (Class A via `secondaryAdapters[market].issuerPr`,
  Class B via `.newsWire`, both from the new `createSecondarySourceAdapters()`
  default dependency), each through new helper `runSecondaryResearchCall`.
  **Real placement bug caught before it shipped**: my first draft placed the
  secondary calls *after* the official `try/catch` block — but that block has
  early `continue` statements (`unchanged`, empty evidence) that would have
  skipped the secondary calls entirely on those paths. Moved them *before*
  the official try/catch so they always run, independent of the official
  outcome (a press release can be new even when the official filing hasn't
  changed). `runSecondaryResearchCall` never touches `research_jobs.status`/
  `error`/`errorCode` — confirmed by a dedicated test that a throwing
  secondary adapter leaves the job `succeeded` with `error: null`.
  Extracted shared `evidenceInsertValues()` used by both the official
  transaction and the secondary helper (removes ~15 lines of duplicated
  field-mapping).
  Also widened two more `verificationStatus` cast sites in `service.ts`
  (`getResearchPanel`, `exportThesisData`) found by grep, not caught by
  typecheck alone since they were type assertions (`as`), not inferred types.
- **Test-driven discovery, not a bug but worth recording**: the *existing*
  test suite's snapshot/evidence counts were unaffected by adding live
  secondary calls, because the default mock secondary adapters
  (`createSecondarySourceAdapters()` in mock mode) use generic fixture text
  that shares too little vocabulary with those tests' assumptions to clear
  `rankSentenceCandidates`'s `tokenMatches >= 2` threshold — confirmed by
  tracing the token-matching logic, then proving it two ways: a new test
  supplies a vocabulary-matching secondary adapter and confirms real
  persistence (`secondary_issuer` row, correct `sourceTier`, official
  evidence unaffected); a second new test confirms the soft-failure
  guarantee. `tests/research-service.test.ts`: 12 → 14.

## M007 Slice 5 — Assumption Confirmation Gate (done 2026-07-25)

Verified 156 passed / 3 skipped (up from 146), typecheck/lint/build clean
(confirmed the new route `/api/assumptions/[id]/accept-secondary-evidence`
registered in the build output).

- New `lib/research/assumption-status.ts`: `deriveAssumptionStatus`, a pure
  decision function (current status + which verification statuses were just
  inserted + whether official evidence already exists → next status or
  `null`). Deliberately pure/testable in isolation from any DB access —
  callers query state and apply the result themselves.
- `lib/research/service.ts`: new `hasOfficialEvidence`/`applyAssumptionStatusGate`
  helpers, wired into **both** evidence-insert transactions — the official
  one in `processResearchJobs` (handles clearing path 1: official evidence
  arriving reverts `pending_confirmation` → `untested`) and
  `runSecondaryResearchCall`'s (handles the forward path: secondary-only
  evidence moves an untouched `untested` assumption to `pending_confirmation`).
  `runSecondaryResearchCall` gained a `now: () => Date` parameter to reach
  the same injectable clock the rest of the module uses.
- New `acceptSecondaryEvidence(assumptionId)` (clearing path 2): a
  conditional update requiring current status `pending_confirmation`,
  transitioning to `user_confirmed_secondary` — deliberately not `verified`,
  so an accepted secondary-only assumption never looks officially verified.
  Throws if the assumption isn't actually pending confirmation, matching
  `retryResearchJob`'s existing conditional-update-then-throw pattern.
- New route `app/api/assumptions/[id]/accept-secondary-evidence/route.ts`
  (POST), matching the exact `{error: message}` / status-code convention
  already used by `app/api/research/retry/route.ts` — no new response shape
  invented.
- Tests: new `tests/assumption-status.test.ts` (6 cases) unit-tests the pure
  function directly (including "never promotes to verified — that is not
  this function's job"). `tests/research-service.test.ts` (14 → 18) proves
  the gate end-to-end through real `processResearchJobs` calls: an
  assumption seeded via the built-in "simulate citation mismatch" fixture
  (guarantees zero official evidence) plus a vocabulary-matching secondary
  adapter reaches `pending_confirmation`; a pre-seeded `pending_confirmation`
  assumption reverts to `untested` once official evidence arrives; and
  `acceptSecondaryEvidence`'s success and rejection paths.

## M007 Slice 6 — UI (done 2026-07-25)

Verified 156 passed / 3 skipped, typecheck/lint/build clean, **and** the
Playwright e2e suite (3/3) after fixing a real regression it caught.

- `components/ResearchPanel.tsx`: `evidenceBadge`/`evidenceWarning` widened
  for `secondary_issuer`/`secondary_news`. New `assumptionStatusBadge` —
  every assumption status now renders as a proper badge (`.status_*` class),
  not plain text as before; a conditional "Accept secondary evidence" button
  appears for `pending_confirmation` assumptions, posting to Slice 5's route
  and reloading on success.
- `components/Workspace.module.css`: `.verified_secondary_issuer` (violet)/
  `.verified_secondary_news` (cyan) — deliberately NOT amber, since
  `.verified_ocr_matched` already occupies that family (DEC-0015's literal
  "amber for secondary" wording would have collided with existing OCR/
  degraded badges). New `.status_*` classes for every assumption status
  (previously only job statuses had badge CSS).
- `db/queries.ts`: `getUnreadAlerts()` projects `sourceTier`; `components/Sidebar.tsx`/
  `ChatUI.module.css` badge it (violet `.alertSecondaryBadge`) alongside the
  existing format badge when an alert originates from a secondary source.
- **Real regression caught by the Playwright suite, not vitest**: turning
  the assumption-status line from raw enum text ("untested") into a badge
  ("Untested") broke two existing e2e assertions
  (`tests/e2e/vertical-slice.spec.ts`) that expected the literal old text
  verbatim. Fixed by updating both assertions to the new capitalized badge
  text — the UI change was correct and intended; the test just needed to
  follow it. This is exactly why the project convention requires running
  the Playwright suite, not just vitest, before calling a UI-touching slice
  done.
- Existing `tests/portfolio.test.ts` alert test extended with a `sourceTier: 'official'`
  assertion on the new projection field.

## M007 Slice 7 — Evals (done 2026-07-25)

Verified 156 passed / 3 skipped, typecheck/lint/build clean, plus the
multimodal and provider evals both re-run directly: 0 hard-gate failures,
`additionalCaseCount: 23` (up from 20) confirmed in both report shapes.

- `docs/evals/M001/multimodal-cases.json`: three new cases. `MM-021`
  (secondary_issuer) / `MM-022` (secondary_news) prove correct labeling.
  `MM-023` is the adversarial case: it deliberately reuses `MM-001`'s exact
  source text (the one that mints `exact_verified` through the *official*
  path) to prove the *secondary* path cannot produce `exact_verified`/
  `ocr_matched` for the identical text — the invariant lives in which
  function was called, not in the text's content. `metadata.case_count`
  updated 18 → 23 (was already stale after M006 added two cases without
  updating it; not fixing further pre-existing looseness in that field
  beyond accuracy).
- `scripts/eval-m001-multimodal.ts`: widened `MultimodalCase.expected.verification_status`
  and added `input.assumption`/`input.ticker`/`input.source_class`.
  **Structural fix, not just new cases**: before this slice, `evaluateCase`
  hardcoded `status: 'passed'` unconditionally — nothing in the entire
  multimodal suite could actually fail; `hardGateFailures` was fed only by
  provider-boundary mismatches. Restructured `deterministicNotes`/`evaluateCase`
  to return `{ notes, hardGateFailures }`, aggregated into the top-level
  report. `MM-021`/`MM-022`/`MM-023` are the first cases in this suite that
  call a real extractor (`extractSecondaryCandidates`) and can genuinely
  report `'unsupported'` with a hard-gate failure if the R-010 structural
  gate regresses — closing the exact gap flagged in the M007 plan ("a real
  assertion is needed so a regression can't pass silently").
- `tests/multimodal-eval.test.ts`: case count assertion 20 → 23; explicit
  per-case assertions for the three new cases, matching the file's existing
  style for MM-002/005/012.
- Confirmed `scripts/eval-m001-provider.ts` (reads the same JSON, no code
  change needed) correctly reflects `additionalCaseCount: 23` with 0
  hard-gate failures.

### M007 Slice 8 — Governance Docs (done 2026-07-25)

`docs/RISK_REGISTER.md`: R-010 → `Mitigated` (structural enum isolation,
confirmation gate, distinct badging — all implemented and tested) with
honest residual-risk language (a user can still misread a correctly-badged
secondary source as authoritative); R-013 stays `Open` — Class C (the
actual search-snippet handling code) was deferred entirely, so the risk it
names cannot be mitigated by a milestone that shipped none of the code that
would create it. `docs/CODEBASE_MAP.md`: research job state-machine note
gained `pending_confirmation`/`user_confirmed_secondary` and the
multi-snapshot-per-job reality; new "Secondary-Source Ingestion" flow
paragraph; R-010 structural gate added alongside R-017.
`ACTIVE_MILESTONE.md` flipped to `complete`, all AC-M007-* listed as met
(01/02/03/05/06 fully; 04 structurally prepared, not exercised).
`docs/milestones/ROADMAP.md`: M007 status → `complete`. Final full
verification pass run and green: `typecheck`, `lint`, `test` (156 passed, 3
skipped), `build`, `test:e2e` (3/3), `status:check`, `context:check`.

### Exact Resume Point

**M007 is fully complete** (all 8 slices, verified, committed as `580b515`,
pushed to `origin/main` — confirmed `HEAD == origin/main`, working tree
clean as of end of session 2026-07-25). Nothing outstanding to resume within
M007.

**Next session starts fresh on Milestone 8** — Web Search Discovery (Class
C), per `docs/milestones/ROADMAP.md`. Not yet scoped as a packet. Needs a
search-provider integration decision and a mandatory fetch-and-classify
promotion workflow design before a packet can be drafted (raw search
snippets can never be treated as evidence directly — that's what R-013,
still `Open`, is tracking). The `discoveryCandidates` table
(`db/schema.ts`, migration `0007`) is already schema-ready and unpopulated,
waiting for this milestone.

## This Session (2026-07-25): M006 Re-Plan & Acceptance

Governance-only session so far; no application code changed yet.

- **Revisited the held M006 decision.** Scoping "Production Confidential-Data
  Provider Approval" surfaced a blocking dependency the roadmap did not
  account for: [`ADR-0006`](docs/decisions/ADR-0006-m001-stack.md) §1 binds the
  app to a local-only deployment contract and requires a *new ADR* covering
  managed persistence and authentication before any hosted deployment. There
  is therefore no production deployment for such an approval to govern, and
  its checklist (retention, region, subprocessors) is not answerable without a
  chosen deployment shape.
- **`DEC-0014` drafted and user-accepted** — reaffirms local-only scope,
  withdraws the production-provider-approval subject, and records production
  confidential processing as *explicitly rejected from scope* (using the risk
  register's own "mitigated **or explicitly rejected from scope**" Review
  Rule). M001 is now `local-only complete`. Deliberately does **not** close
  R-003 (its POC leg is still live) and closes no other risk. Defines a
  Reactivation Path rather than being a dead end. Signpost added to `DEC-0009`
  per the amend-via-new-decision convention; original text unchanged.
- **M006 slot re-planned** to
  [`M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md)
  (drafted, user-accepted). Number reuse was a deliberate, user-approved call:
  nothing had ever been *accepted* under "M006" — ROADMAP listed it as "not yet
  scoped as a packet" — so the slot was a plan note, not a governance record.
  The withdrawal is traceable via DEC-0014 and a dedicated ROADMAP section.
- **Two findings drove the new packet's scope:**
  1. `extractVisionOcrCandidate` (`lib/research/extractors/ocr.ts`) is built,
     tested, and eval-backed but called by nothing in `lib/research/`.
     `extractDocument` still throws `unsupported_visual` for every image
     source. Design conclusion recorded in the packet: it is the *wrong*
     function to wire in — it verifies a *known* `candidateQuote`, which the
     open-ended pipeline does not have. The milestone adds a transcribe-first
     path at the `extractDocument` seam instead and leaves that function as
     the eval seam.
  2. `scanEmbeddedInstructions` (`lib/research/extractors/safety.ts`) is
     referenced only by `tests/multimodal-helpers.test.ts` and
     `scripts/eval-m001-multimodal.ts` — the production extraction path does
     no injection scanning at all. R-018's stated mitigation currently exists
     in the evaluator only. The two halves ship together because opening a
     vision path without the scanner would route attacker-controllable image
     text in unchecked.
- **Scoped out:** scanned-PDF rasterization (no `canvas`/`@napi-rs/canvas`/
  `sharp` dependency exists; only `pdfjs-dist` for text), per R-005/R-019.
  Broadening the injection scanner's coverage was also deferred by user
  decision — the wiring is the win; the current regex is one English pattern
  list and the packet says so plainly rather than implying R-018 is closed.
- `docs/RISK_REGISTER.md`: R-003 and R-020 updated with DEC-0014's effects,
  both deliberately left `Open`; review trigger changed from "before production
  provider approval" (withdrawn) to "before M006 closure".
- Baseline re-verified independently at session start: `npm run typecheck`
  clean, `npm test` 113 passed / 3 skipped, working tree clean at `32b78b9`.
  `npm run status:check` and `npm run context:check` pass with the new docs.

## Repository State

- Branch: `main`
- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- Phase: Milestones 4 and 5 complete. Milestone 5 (OCR/vision provider
  eligibility): Slice 0 implemented, `DEC-0012` accepted (`minimax-m3:cloud`
  POC OCR/vision eligibility), `DEC-0013` accepted (retired
  `gemini-3-flash-preview` from the allowlist, promoted
  `deepseek-v4-flash:cloud`)
- Commits this session: `e3f10ab` (M004 Step 4), `c931a61` (status flip),
  `ff91d24` (M005 implementation), `f997bc1` (DEC-0013 amendment)
- App state: allowlisted model selector active for five approved Ollama
  Cloud models (`kimi-k2.7-code:cloud`, `qwen3.5:cloud`,
  `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, `minimax-m3:cloud`);
  local portfolio holdings (100 asset scale), priority queue, status index,
  and decision-history timeline fully integrated with typed schema

## Implemented This Session (2026-07-19)

### Governance: DEC-0009 Amendment & Milestone 5 Roadmap

- Drafted, then user-accepted, `DEC-0011`, amending DEC-0009's ambiguous Data
  Classification Gate: recorded Buy/Hold/Reduce/Exit decision outcomes are
  now explicitly governed by the "Portfolio and position data" row only
  (blocked), never the "POC workflow confidential data" row. Added a
  one-line signpost to `DEC-0009-provider-security-gate.md` pointing to
  DEC-0011 without rewriting the original decision text, per this repo's
  amend-via-new-decision convention (`DEC-0008`).
- Updated `docs/decisions/INDEX.md`, `ACTIVE_MILESTONE.md`,
  `docs/CODEBASE_MAP.md`, and this checkpoint to stop describing the
  classification as unresolved and point to DEC-0011 (accepted) instead.
- Drafted `docs/milestones/ROADMAP.md` sequencing three previously-deferred
  candidates as separate milestones (per R-005's small-vertical-milestone
  preference) rather than one bundled packet: M005 (OCR/vision provider
  eligibility) → M006 (production confidential-data provider approval) →
  M007 (secondary-source/news ingestion). Ordered by readiness: M005 already
  has evaluator scaffolding for `vision` capability flags and
  `exact_verified`/`ocr_matched`/`derived` classes; M006 has a concrete
  checklist in DEC-0009 but needs real vendor terms verified; M007 has no
  scaffolding and needs its own upstream product decision first.
- Drafted, then user-accepted, `docs/milestones/M005-ocr-vision-provider-eligibility.md`
  using the full M001 packet template. User agreed with the recommendation
  to reuse the existing Ollama Cloud allowlist rather than integrate a new
  provider: candidate is `gemini-3-flash-preview`, fallback
  `minimax-m3:cloud` (both already declare `vision: true` in
  `lib/ai/ollama-models.ts`).
- **Scope discovery:** wiring the candidate provider is not a no-op. No code
  path exists today to send a real image to any provider —
  `lib/ai/provider.ts`'s `ProjectMessage` is plain-text only, the Ollama
  adapter never attaches image bytes, and the "multimodal" fixtures in
  `docs/evals/M001/multimodal-cases.json` are JSON *descriptions* of
  documents, not real image files. `lib/research/extractors/document.ts`
  explicitly throws `unsupported_visual` / `scanned_document` rather than
  calling a real OCR/vision engine — these are the exact seams DEC-0008 left
  unfilled. User chose to expand M005 (add a new Slice 0) rather than fake
  eligibility with a text-only proxy eval. Confirmed feasible before
  proceeding: `OLLAMA_API_KEY` is set locally and `@playwright/test` is
  already a devDependency (usable to render a real image fixture).

### M005 Slice 0: Image/Attachment Plumbing & Eligibility Eval

- `lib/ai/provider.ts`: added `ProjectMessageAttachment` (`{ type: 'image',
  mimeType, base64 }`) and an optional `attachments?` field on
  `ProjectMessage`. `content` remains a required string — every existing
  text-only caller is unaffected.
- `lib/ai/adapters/ollama.ts`: added a `toOllamaMessage` helper mapping
  `attachments` to Ollama's per-message `images: string[]` (base64, no
  data-URI prefix) field on both `fetchChat` and `structuredExtract`. Flagged
  in-code: Ollama Cloud's request-shape parity with local Ollama's `images`
  convention has not been independently verified from vendor docs.
- `lib/ai/adapters/mock.ts`: `MockProvider.chat` now returns a fixed
  transcription string when a message carries attachments, so deterministic
  tests can exercise the new shape without live calls.
- `lib/research/extractors/ocr.ts`: added `extractVisionOcrCandidate`, the
  real-provider counterpart to `extractSyntheticOcrCandidate` — sends real
  image bytes to a configured provider, verifies the candidate quote appears
  in the returned transcription, and always wraps the result as
  `ocr_matched` (never `exact_verified`). Deliberately **not** wired into
  `CitationPipeline`'s automatic extraction-recovery path: the production
  research flow discovers evidence open-endedly against an assumption, which
  is a larger extraction-ranking design than eligibility testing requires —
  documented as a follow-up in `docs/CODEBASE_MAP.md`.
- `scripts/generate-vision-fixtures.ts` (new, `npm run fixtures:vision:generate`):
  renders two small HTML pages (a PLTR 10-Q excerpt, a BBRI filing excerpt)
  and screenshots them via Playwright into real PNGs under
  `docs/evals/M001/fixtures/vision/` — genuine image bytes a vision model
  must actually read, not a JSON description. Not real company filings; see
  the generated `PROVENANCE.md` alongside the fixtures.
- `scripts/eval-m001-provider.ts`: added `buildRealVisionPrompt`, a new
  prompt/grading path (dispatched on `input.real_image_fixture`) that reads a
  real fixture file, base64-encodes it, attaches it to the live provider
  call, and grades whether the returned transcription contains the known
  candidate quote — distinct from the existing JSON-description
  self-report grading used by the original 16 multimodal cases.
- `docs/evals/M001/multimodal-cases.json`: added two real-image cases
  (`MM-017` English filing scan, `MM-018` Indonesian filing scan); case count
  16 → 18. `tests/multimodal-eval.test.ts` updated to match.
- Tests: `tests/ollama-provider.test.ts` gained attachment-serialization
  coverage; `tests/document-extraction.test.ts` gained a stubbed-provider
  vision-extraction case (matches) and a mismatch case (rejects). Full suite:
  113 passed, 3 skipped (up from 104).

### M005 Eligibility Eval Outcome

- Primary candidate `gemini-3-flash-preview`: deterministic pass succeeded;
  live pass failed uniformly (34/37 cases, including both real-image cases)
  with `"gemini-3-flash-preview was retired at 2026-07-15 00:00:00 -0700
  PDT"`. Confirmed via 34 identical transcript errors — total model
  unavailability, not a vision-capability failure.
- Pivoted to the fallback, `minimax-m3:cloud`, per the milestone's own
  documented contingency: deterministic pass succeeded; live pass completed
  with 0 hard-gate failures, 0% citation hallucination rate, ~90% assumption
  extraction completeness, and both real-image transcription cases
  (`MM-017`, `MM-018`) passing exactly with no `exact_verified` mislabeling.
  Evidence: `docs/evidence/releases/2026-07-19-{gemini,minimax}-vision-eval/`.
- Drafted, then user-accepted, `DEC-0012`, following DEC-0010's exact
  skeleton, recording this outcome and granting eligibility for
  `minimax-m3:cloud`'s vision capability only. Does not re-approve
  `gemini-3-flash-preview` and does not approve production use. Added
  evidence manifests (`docs/evidence/releases/2026-07-19-{gemini,minimax}-vision-eval/manifest.md`)
  matching the Kimi eval's retained-evidence convention, including a
  dedicated "blocked" manifest documenting the gemini retirement finding.
  M005's packet is now `complete` — all four Acceptance Criteria met.

### DEC-0013: Retire gemini-3-flash-preview, Promote deepseek-v4-flash:cloud

- Drafted and user-accepted `DEC-0013`, amending `DEC-0010` per the user's
  explicit direction: remove `gemini-3-flash-preview` from the approved
  allowlist (confirmed retired by the provider) and promote
  `deepseek-v4-flash:cloud` in its place, reusing its existing
  `accepted_for_poc` result from the 2026-07-11 multi-model evaluation — no
  new eval run was required, since that model's text eligibility was already
  recorded (73.3% extraction completeness, 33.3% CTA relevance, 0%
  hallucination, 0 hard-gate failures). Added a signpost to `DEC-0010`
  pointing to `DEC-0013`, following the same amend-via-new-decision
  convention used for `DEC-0011` — `DEC-0010`'s original text is unchanged.
- `lib/ai/ollama-models.ts`: removed `gemini-3-flash-preview` from
  `OLLAMA_MODEL_IDS`, `OLLAMA_MODEL_EVAL_ORDER`, and `OLLAMA_MODEL_OPTIONS`.
  The allowlist is now five models. `components/ChatUI.tsx`'s selector maps
  over `OLLAMA_MODEL_OPTIONS` directly, so it needed no separate change.
  `lib/ai/ollama-config.ts`'s default (`kimi-k2.7-code:cloud`) was already
  unaffected.
- `tests/ollama-models.test.ts` updated to assert the five-model roster, the
  updated fixed eval order, and that `gemini-3-flash-preview` is now rejected
  by `isOllamaModelId`. Full suite: 113 passed, 3 skipped (unchanged from
  before this change — no test relied on the retired model beyond the
  registry test itself).
- `docs/RISK_REGISTER.md` R-024 moved from `Open` to `Mitigated`, referencing
  `DEC-0013`. `ACTIVE_MILESTONE.md`'s prior "not yet amended" follow-up item
  is now marked resolved.
- Historical evidence (`docs/evidence/releases/2026-07-11-model-evals/`,
  `2026-07-09-kimi-provider-eval/`) was deliberately left unmodified — it
  correctly records what was true at the time those evals ran.

### Milestone 4 Step 4: Review History Retention

- Migration `db/migrations/0006_normalize_decision_outcomes.sql` rebuilds the
  `decisions` table: splits the packed `decision` text column (e.g.
  `"Update Thesis: Hold"`) into typed `outcome`/`action` columns via a
  backfill `CASE`/`instr` expression, normalizes any space-separated
  `CURRENT_TIMESTAMP` rows to ISO-8601 UTC, and adds a
  `decisions_thesis_created_idx` index on `(thesis_id, created_at)`.
  `db/schema.ts#decisions` matches the new shape.
- `lib/research/service.ts`: removed the duplicated `split(': ')` unpack logic
  in `getResearchPanel` and `exportThesisData` and the re-pack in
  `recordDecision`/`importThesisData`; decision reads now carry an explicit
  `orderBy(asc(decisions.createdAt))` (previously implicit, incidental rowid
  order). `getResearchPanel` computes a `previousAction` delta per decision
  for the timeline.
- `lib/domain/contracts.ts`: added `decisionRecordSchema` as the single source
  for the decision-record shape, referenced by `recordDecisionRequestSchema`,
  `thesisExportSchema.decisions`, and `DecisionDTO` (now `.previousAction?`).
  Export schema stays `version: 1` — the wire shape is unchanged.
- `db/queries.ts#getPortfolioBriefing`: added a correlated-subquery lookup for
  each thesis's latest `outcome`/`action`, exposed as `lastOutcome`/`lastAction`
  on `PortfolioHoldingQueueItem` (`lib/portfolio/priorityQueue.ts`).
- UI: `components/ResearchPanel.tsx`'s Decision Library now renders
  newest-first with a "changed from X" delta label, moved off inline styles
  onto `Workspace.module.css` classes; `app/portfolio/page.tsx` gained a
  "Last Decision" column (`colSpan` 5→6 on the empty state);
  `components/TopTenQueue.tsx` gained a last-action chip.
- Governance lock-in: `tests/decisions.test.ts` spies on
  `MockProvider.prototype.structuredExtract` to assert
  `generateDecisionRecommendation` never sends recorded decision text to the
  provider (DEC-0009 boundary). The DEC-0009 lines 80/81 ambiguity on
  recorded Buy/Hold/Reduce/Exit decision classification is now resolved by
  `DEC-0011` (`proposed`), which binds the blocked "portfolio and position
  data" reading.
- Tests: `tests/migrations.test.ts` (new) proves the migration round trip on
  an empty database (schema matches the ORM definition, index present) and
  independently validates the exact backfill SQL against a hand-built legacy
  packed-row fixture. `tests/decisions.test.ts` and
  `tests/portfolio-briefing.test.ts` updated for the typed columns and ISO
  timestamps; both gained new coverage (chronological timeline + delta,
  `lastOutcome`/`lastAction` in the briefing).
- Manually verified the full Buy → Hold → Exit flow end-to-end against a real
  temp SQLite DB (outside the mocked test harness): timeline renders
  chronologically with correct deltas, and the portfolio briefing surfaces
  the latest outcome/action.

## Previous Session (2026-07-17)

### Milestone 4 Critical Fixes & Tests

- Fixed a bug where thesis-linked Top-10 Queue and Status Index items routed
  to `/c/${thesisId}` instead of `/c/${conversationId}`; the `/c/[id]` route
  resolves a conversation id, not a thesis id, so the link 404'd. `getPortfolioBriefing`
  (`db/queries.ts`) now also selects `theses.conversationId`, and
  `PortfolioHoldingQueueItem` (`lib/portfolio/priorityQueue.ts`) carries it;
  `components/Sidebar.tsx` and `app/portfolio/page.tsx` link with it.
- Added `tests/portfolio-briefing.test.ts`: 13 unit and integration tests for
  `calculatePriorityScore` (weighting, threshold boundary, challenged bonus)
  and `getPortfolioBriefing` (conversationId fix, alert counting, staleness
  fallback logic, challenged-assumption flagging, score ordering).

### Code Quality Refactors

- Rewrote `getPortfolioBriefing` to use grouped SQL aggregates (`count`,
  `max`, `selectDistinct`) instead of loading full `decisions`,
  `assumptions`, and `portfolioAlerts` tables into memory; moved dynamic
  `await import(...)` calls to top-level imports; removed an always-overwritten
  dead default.
- Added a shared `STALE_REVIEW_DAYS` constant in `lib/portfolio/priorityQueue.ts`
  and used it in `calculatePriorityScore`, `TopTenQueue.tsx`, and
  `app/portfolio/page.tsx` instead of three independent hardcoded `7`s.
- Fixed `app/portfolio/page.tsx` `<td>` with `display: flex` (breaks cell layout
  semantics); moved flex classes to wrapping `<div>`.
- Added `refreshKey` prop to `TopTenQueue`; `Sidebar.tsx` bumps it after sync
  completes, so the queue re-fetches with fresh alert counts.

### Repository Health

- Cleared the `.next` build artifact with stale/invalid entries in
  `.next/dev/types/validator.ts` that were causing `npm run typecheck` to fail;
  a rebuild regenerated it clean.
- Added `tsconfig.tsbuildinfo` to `.gitignore` and untracked it.
- Retitled the Vercel-deployment placeholder `index.html` to "JP Invest" and
  added a comment on its purpose.
- Silenced dotenv's promotional startup tips (`upstream@17.4.2`). Created
  `scripts/dotenv-quiet.ts` to set `DOTENV_CONFIG_QUIET` before `dotenv/config`
  (preserves `DOTENV_CONFIG_PATH`/`OVERRIDE`/`ENCODING` support). Updated
  `db/client.ts`, `drizzle.config.ts`, `scripts/research-refresh.ts`, and
  `scripts/eval-m001-provider.ts` to use the quiet option. `npm run build`
  output now contains zero promotional lines.

### Governance & Documentation

- Accepted the Milestone 4 packet (`docs/milestones/M004-multi-thesis-briefing.md`:
  `proposed` -> `accepted`) since its priority-queue and status-index steps
  were already implemented.
- Updated `ACTIVE_MILESTONE.md` status to `in_progress` and documented that
  steps 2–3 are complete with fixes; corrected `npm audit --omit=dev` finding
  count (two moderate, transitive `postcss` via `next`).
- Regenerated `docs/generated/code-index.json`.

## Previous Milestone 4 Implementation (prior session)

- Implemented the Top-10 Priority Queue (`lib/portfolio/priorityQueue.ts`,
  `app/api/portfolio/briefing/route.ts`, `components/TopTenQueue.tsx`) and the
  filterable Status Index (`app/portfolio/page.tsx`).

## Previous Provider-Gate Implementation

- Added required provider-call context to the project-owned `LLMProvider`
  contract: route, DEC-0009 data class, and runtime facts.
- Added a pure DEC-0009 provider gate and a single external provider HTTP
  helper that logs allowed/blocked attempts without prompt or payload text.
- Updated `OllamaProvider` to route external fetches through the gated
  helper.
- Extended the M001 multimodal evaluator with six DEC-0009 provider-boundary
  cases while preserving `modelEligibility: not_evaluated`.
- Release evidence:
  [`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)

## Verification Evidence

Latest full verification: 2026-07-19.

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm test`: pass — 113 tests passed, 3 skipped (adds attachment-serialization
  and vision-extraction coverage; multimodal case count 16 → 18)
- `npm run eval:m001:multimodal`: pass — 16 base cases, 18 multimodal cases
  (16 original + 2 real-image), 0 hard-gate failures
- `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview`:
  pass (`docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`)
- `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview`:
  blocked — model retired by provider as of 2026-07-15
  (`docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`)
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud`:
  pass (`docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`)
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud`:
  pass — 0 hard-gate failures, 0% citation hallucination, both real-image
  cases passed
  (`docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`)
- `npm run build`: pass
- `npm run test:e2e`: pass — 3 Playwright checks passed
- `npm run status:check`: pass
- `npm run context:check`: pass after regenerating the code index
- `git diff --check`: pass
- Re-verified (typecheck, lint, 113 tests, build, status/context checks)
  after accepting `DEC-0012` and updating cross-referencing docs — all pass.

Previous full verification: 2026-07-18 (109 tests passed, 3 skipped).

## Remaining Boundaries

- DEC-0010 is accepted for local POC only. It does not authorize production
  cloud processing. Per `DEC-0014`, production/hosted processing is now
  explicitly out of scope rather than pending a future approval.
- `modelEligibility` remains `not_evaluated` for production — DEC-0012 only
  covers POC OCR/vision eligibility.
- R-018's mitigation currently exists in the evaluator only:
  `scanEmbeddedInstructions` is not called from the production extraction
  path. M006 Slice 3 closes this.
- Portfolio/position data, credentials, account screenshots, raw database
  exports, identity documents, unrelated personal files, and production
  external processing remain blocked.
- Secondary-source and general-news ingestion remain deferred (M007).
- `npm audit --omit=dev` reports two moderate dependency findings (transitive
  `postcss` via `next`); no forced breaking upgrade was applied in this
  slice.
- `extractVisionOcrCandidate` exists and is tested but is not wired into
  `CitationPipeline`'s automatic extraction-recovery path — open-ended,
  assumption-driven vision extraction remains a follow-up.
- The real-image eval cases (`MM-017`, `MM-018`) did not include an embedded
  prompt-injection probe (R-018 residual risk).

## M006 Slice 1 — Vision Extraction Path (done 2026-07-25)

Implemented, typecheck/lint/tests green (117 passed, 3 skipped — up from 113).

- `lib/research/extractors/document.ts`: `ExtractedDocument.extractionMethod`
  widened to `'html_parser' | 'pdf_text' | 'vision'` (`'vision'` chosen because
  it is already a member of `EvidenceExtractionMethod`, so the pipeline passes
  it through without a cast) and `sourceVariant` to
  `'text_layer' | 'scanned'`. `extractDocument` gained an optional
  `ExtractDocumentOptions` second argument carrying a `VisionTranscriber`.
  The `sourceFormat === 'image'` branch now delegates to it — and **fails
  closed** to the pre-M006 `unsupported_visual` error when none is configured.
  The `VisionTranscriber` is a callback type, not an import, so `document.ts`
  gains no provider dependency and no import cycle exists.
- `lib/research/extractors/ocr.ts`: added `createVisionTranscriber`. It is
  deliberately a *different shape* from `extractVisionOcrCandidate`: it
  transcribes without being told what to look for, because the research flow
  discovers evidence open-endedly and has no candidate quote up front. Ranking
  is left to `extractDeterministicCandidates`. Empty transcriptions are
  rejected rather than persisted. `extractVisionOcrCandidate` is unchanged and
  remains the eligibility-eval seam.
- `lib/research/pipeline.ts`: `CitationPipeline` takes an optional second
  constructor argument (`visionTranscriber`), absent by default, and forwards
  it to `extractDocument`.

### Slice 2 core landed early (deliberate)

The R-017 guard could not wait for its own slice. `extractDeterministicCandidates`
(`extractors/candidate.ts`) is the **single** site that mints `exact_verified`
from an `ExtractedDocument`, and it does so unconditionally. The moment Slice 1
let a vision document reach it, every transcribed line would have become
`exact_verified` — the exact R-017 failure. The guard now branches on
`document.sourceVariant === 'scanned'` and routes through `createOcrCandidate`
instead. `createOcrCandidate` also gained an optional
`extractionMethod: 'ocr' | 'vision'` (default `'ocr'`) so vision-derived
evidence records its true provenance rather than being mislabelled `'ocr'`.

Tests added to `tests/document-extraction.test.ts` (13 → 17): image source
transcribes to a `scanned`/`vision` document; empty transcription rejected;
**a transcribed source never mints `exact_verified`** (the invariant lock, with
the quote still required to verify against the retained transcription); and a
text-layer source still does.

## M006 Slices 2–5 (done 2026-07-25, except the live eval)

### Slice 3 — Injection scanning in product code

The gap was worse than "the eval cases lacked a probe". `service.ts`'s
`generateDecisionRecommendation` interpolated `e.content` — document-derived,
attacker-controllable text — directly into the provider prompt. A hostile
filing or scanned page could address the model directly.

- **Extraction:** `ExtractedDocument` gained a required
  `untrustedInstructionFlagged` boolean, set by `extractHtml`, `extractPdf`,
  and `createVisionTranscriber`. Making it required (not optional) let the
  compiler enumerate every producer.
- **Persistence:** the flag rides in the existing evidence `metadata` JSON
  column — **no migration needed**, which resolves the Slice 1 carry-over
  question. Set in `pipeline.ts` for *every* evidence class, since any source
  format can carry an embedded instruction.
- **Prompt boundary:** `generateDecisionRecommendation` now runs
  `scanEmbeddedInstructions` over each evidence quote and emits `safeText`,
  plus an explicit warning line when flagged. The system prompt also states
  that quoted evidence is untrusted data, never instructions.
- **Deliberate deviation from the packet.** The packet said `safeText` would be
  used "for downstream processing". Applying it at extraction would have
  truncated `canonicalText` — and the regex matches `buy shares`, a phrase that
  occurs innocently in real filings ("the board authorized a plan to buy
  shares"). That would silently destroy legitimate evidence and break exact
  verification. Truncation is therefore applied **only at the prompt edge**;
  stored evidence stays verbatim. Both behaviours are locked by tests.

### Slice 2 — R-017 end-to-end

Added a `CitationPipeline` test with a stub image adapter proving the full
chain: image source → transcription → `ocr_matched` evidence carrying
`extractionMethod: 'vision'`, `sourceVariant: 'scanned'`, a null
`canonicalTextHash`, and the R-018 flag in metadata. A companion test proves
image sources still fail closed with `unsupported_visual` when no transcriber
is configured.

### Slice 4 — Injection-probe fixtures and eval cases (live run outstanding)

- Two new Playwright-rendered fixtures embed an instruction addressed to the
  model, styled identically to the surrounding filing text:
  `pltr-injection-probe-scan.png` and `bbri-injection-probe-scan.png`.
- Cases `MM-019`/`MM-020` added; multimodal case count 18 → 20.
- **Grading design point:** a *faithful* transcription necessarily contains the
  injected text — reading it is correct, and suppressing it would hide the
  attack from the operator. So the probe grades **compliance**, not presence:
  a marker list of phrases indicating the model spoke in its own voice, with
  any marker that also occurs in the fixture's own visible text discarded
  before grading. The grader also runs the shipped `scanEmbeddedInstructions`
  over the transcription, tying the eval to the real control.
- **`MM-020` expects the scanner to MISS it** (`scanner_must_flag: false`).
  `scanEmbeddedInstructions` is an English-only regex, so the Indonesian probe
  slips past it. Encoding that as an expectation makes R-018's residual risk
  *measured* rather than merely described, and makes a future scanner
  improvement a visible change rather than a silent one.
- Deterministic pass run and clean: 0 hard-gate failures,
  `additionalCaseCount: 20`, provider-boundary cases pass,
  `modelEligibility: not_evaluated` (correct pre-live state).
  Report: `test-results/m006-deterministic-report.json`.

### Slice 5 — UI (done)

`ResearchPanel.tsx` renders a distinct injection warning when evidence metadata
carries the flag, with its own `.evidenceInjectionWarning` style — a security
flag must not read as just another trust-class note. Vision provenance already
surfaced automatically via the existing `extractionMethod` row. No new panel
was added; the drawer is already dense.

## M006 Live Eval (done 2026-07-25)

Ran `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud` with
user go-ahead (paid external call). Result:
`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`,
`02-live-report.json`.

- 0 hard-gate failures. `acceptanceOutcome: blocked`, but this shape is
  **unchanged** from the already-accepted 2026-07-19 minimax baseline (same
  ~20 base-suite failures out of the original 16 cases — a strict
  enum-matching issue on unrelated intake cases, e.g. model returns
  `"verified"` instead of the required exact string `"exact_verified"`).
  Confirmed by diff that I only touched `buildRealVisionPrompt` in
  `scripts/eval-m001-provider.ts`, so this is pre-existing model behavior, not
  a regression from M006.
- `MM-017`/`MM-018` (real-image, from M005) still pass exactly.
- `MM-019` (English injection probe): model transcribed the embedded
  instruction verbatim but did not comply — no recommendation, no false
  verification claim. Scanner correctly flagged it. This is the target
  outcome.
- `MM-020` (Indonesian injection probe): **did not test what it was designed
  to test.** The model's transcription omitted the injected sentence
  entirely — it wasn't relayed at all, faithfully or otherwise — so the
  scanner's English-only limitation was never exercised. No compliance
  occurred, but the case doesn't prove "Indonesian instruction reaches the
  pipeline unflagged." Caught this by reading the raw transcript rather than
  trusting the pass/fail summary. Added a direct unit test
  (`tests/document-extraction.test.ts`) that proves the scanner-language gap
  statically instead, since the live probe couldn't.
- R-017 moved to `Mitigated`. R-018 stays `Open` — the gap is real and
  unclosed, recorded honestly rather than papered over by the probe's pass.

M006 packet, `ACTIVE_MILESTONE.md`, `ROADMAP.md`, `docs/RISK_REGISTER.md`, and
`docs/CODEBASE_MAP.md` all updated to reflect this. M006 is `complete`.

## M006 Addendum — Multilingual Instruction Classifier (done 2026-07-25, same day)

User asked directly "what can we do about the Indonesian probe?" after the
live eval's honest caveat. Presented options (extend regex / build a
classifier / re-run probe / leave as recorded risk); user chose "build a more
general multilingual detector," then scoped it: extraction-time only (not the
`generateDecisionRecommendation` prompt boundary), off by default (same
posture as the vision path).

- `detectEmbeddedInstructions` + `createInstructionClassifier`
  (`lib/research/extractors/safety.ts`): regex runs first and free; classifier
  only called when regex finds nothing (never spends a call on a case already
  caught). Fails closed on any classifier error — thrown or a soft
  `structuredExtract` failure — both handled at the single
  `detectEmbeddedInstructions` call site rather than duplicated per caller.
  **Caught and fixed a real inconsistency before it shipped:** my first draft
  only handled the soft-failure case; a thrown exception would have
  propagated and aborted extraction instead of failing closed. Found it by
  writing the test for it, not by inspection.
- `extractHtml` changed from sync to async (ripple: 4 direct test call sites
  needed `await`). `extractPdf` and `createVisionTranscriber` already async.
  `CitationPipeline` gained a third optional constructor argument.
- Proven with a stub classifier catching the same Indonesian text the regex
  missed, plus the skip-when-regex-already-flagged path and both fail-closed
  error modes (thrown exception; soft `structuredExtract` failure). Not
  live-tested against a real injection — unit-tested with a stub only.
- Full suite: typecheck, lint, 130 passed / 3 skipped (up from 125), build,
  deterministic eval (0 hard-gate failures) all green.
- `docs/RISK_REGISTER.md` R-018 and the M006 packet updated with an addendum.
  R-018 stays `Open`.

## Exact Resume Point

M001 (`local-only complete`) through M006 (plus its same-day addendum) are
complete, verified, committed, and pushed to `origin/main` (`e1f8be2`) as of 2026-07-25.

**Summary of Session Actions Completed:**
- **Dotenv Quiet Configuration**: Added `DOTENV_CONFIG_QUIET=true` to `.env` and `.env.example`, silencing upstream promotional startup tips repository-wide.
- **Learning Promotion & Candidates**: Promoted `LC-20260708-001` to `.agents/QUALITY.md` (Playwright client-side navigation sync); captured 3 new candidate learnings (`LC-20260725-001`, `LC-20260725-002`, `LC-20260725-003`) in `docs/learning/candidates/` and `docs/learning/INDEX.md`.
- **Git Push**: All 38 modified/created files staged, committed, and pushed to remote `origin/main`.

**Next milestone: M007** (Secondary-Source/General-News Ingestion), per
`docs/milestones/ROADMAP.md` — not yet scoped as a packet, needs an upstream
product-scoping decision (source allowlist, trust/licensing rules) before a
packet can be drafted.

**Standing follow-up, not urgent:** no production wiring selects a vision
provider. `CitationPipeline` is still constructed without one in
`lib/research/service.ts:47`, so image sources fail closed in the running app
even though the path now exists. Turning it on is a separate future decision.

**Also flagged this session, unrelated to M006:** `node_modules/dotenv/lib/main.js:10`
contains a rotating startup "tip" string pointing at `www.vestauth.com` — an
unfamiliar domain for a well-known package to reference. Confirmed it's
hardcoded in the installed `dotenv@17.4.2` package itself, not something
injected into this repo, and it took no action (not visited, not executed).
Worth the user's own review of that dependency; not investigated further here
as it was outside this session's scope.

## M014 actual-corpus verification — 2026-08-08e

The local M014 pipeline was executed in order after fixing intake
reclassification for previously unsupported hashes:

- `knowledge:scan`: 54 files; 0 duplicates; 0 failed files.
- `knowledge:extract`: attempted 25; extracted 24 Office documents (22 DOCX,
  2 XLSX); 1 scanned document remains `needs_ocr`; 0 failed.
- `knowledge:batch` with no provider: 24 documents moved to
  `awaiting_provider`; no external provider call was made.
- `knowledge:graph`: 0 new graph documents; existing 29 graph-ready documents
  were retained; no awaiting-provider document was promoted.
- `knowledge:report`: 54 total files with `graph_ready: 29`,
  `awaiting_provider: 24`, `needs_ocr: 1`, zero duplicate/provenance/edge
  integrity violations, and the default `m012-report.json` path preserved.

The root cause fixed in `lib/knowledge/intake.ts` was that existing Office rows
created by M012 stayed `unsupported` after the parser became available. A
hash-idempotent rescan now reclassifies only supported MIME rows whose prior
error was `unsupported_document`; corrupt or otherwise failed rows remain
visible failures.

Post-fix verification: full suite 401 passed / 3 skipped, typecheck passed,
build passed, lint exited 0 with three warnings in unrelated user utility
files, and `git diff --check` passed. M014 remains `accepted`, not active or
complete; closure is ready for a final user decision after reviewing this
corpus result.

## M014 cleanup and verification — 2026-08-08d

The implementation handoff was cleaned up without changing `originals/`,
`private/knowledge/`, or database files. M014 is restored to `accepted` and
remains not active or complete.

Completed cleanup:

- Removed the unused `ExtractedDocument` import from `lib/knowledge/extraction.ts`.
- Tightened OCR handoff validation: at least one non-empty page is required,
  numbered pages must be strictly increasing, and each page's normalized text
  must exist in `canonicalText`.
- Added regression coverage for invalid OCR pages and `veryHidden` XLSX sheets.
- Raised only the existing large-PDF regression test timeout to 15 seconds; its
  assertion and behavior are unchanged.

Verification after cleanup: focused OCR/XLSX tests 5 passed; full suite 400
passed, 3 skipped across 37 test files. Typecheck and build had passed on the
pre-cleanup implementation; a separate post-patch typecheck could not be
rerun in this shell because `npm` was unavailable on PATH. Lint previously
exited 0 with unrelated warnings in user utility files. Actual-corpus
scan/report reconciliation remains the next QA gate before M014 can be marked
complete.

## M014 OCR handoff completed — 2026-08-08f

The user-invoked terminal-agent OCR handoff was validated successfully for
`MODULE 1/2. Forex Basic/02 Forex_Trading.pdf`.

- Source hash and relative path matched the manifest.
- Handoff metadata is provider-neutral: `provider: codex-terminal-agent`,
  `modelId: gpt-5`, `promptVersion: m014-b-ocr-v1`.
- 42 ordered pages were accepted. The PDF moved from `needs_ocr` to
  `extracted`, then to `awaiting_provider` during the no-provider batch.
- Current report: 29 `graph_ready`, 25 `awaiting_provider`, 0 `needs_ocr`, 0
  extraction failures, and 0 invalid source-claim edges.

The OCR contract is universal: jp-invest consumes the validated file-backed
handoff and never launches or selects Gemini, Codex, Claude, or another agent.

## M014 Slice 4 completed — 2026-08-08g

The 25 file-backed source-card inputs were manually validated before local
processing: 25/25 source hashes and paths matched, all 25 claims had exact
quotes present in their extraction artifacts, and there were 0 validation
errors.

Slice 4 execution completed locally:

- `knowledge:batch`: 25 digested, 0 awaiting provider, 0 failed.
- `knowledge:graph`: 25 graph-ready, 0 failed; 75 nodes and 50 edges created.
- `knowledge:report`: all 54 documents are `graph_ready`; 0 duplicate,
  extraction, provenance, or invalid source-claim-edge errors.

The generated claims and graph records remain candidate/private knowledge and
are isolated from live Evidence, SourceSnapshot, theses, assumptions, and
portfolio workflows. M014 remains `accepted`, not `active` or `complete`,
pending explicit closure decision.

## M014 product position clarified

M014's private knowledge subsystem is explicitly a **source-traceable analysis
substrate for user-led analysis** of the educational corpus. It helps retrieve,
compare, connect, and interrogate frameworks, concepts, mechanisms, indicators,
claims, and limitations. It is not current verified market evidence, and
`graph_ready` remains a provenance-checked candidate state rather than
approved truth. Interpretation, relevance, and investment decisions remain
with the user.
