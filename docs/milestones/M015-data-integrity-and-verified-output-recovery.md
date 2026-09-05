# M015: Data Integrity & Verified-Output Recovery

Status: `accepted` (2026-09-05) — steps 1-3 done; step 4 next

Date drafted: 2026-09-05

Date accepted: 2026-09-05

Approval authority: user

Depends on: completed M011 (measurement contracts, coverage ledger,
deterministic verdict), completed M013 (`source_snapshots` schema, per-assumption
source adequacy, the official-path repair), [`DEC-0017`](../decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md)
(terminal-agent orchestration boundary — this packet's scope 2 and 6 touch the
CLI surface it governs).

**No new decision record is required.** This packet adds no provider, model,
data class, trust tier, or product boundary — it repairs storage integrity and
test isolation, and it attempts (does not guarantee) a first real directional
verdict on existing infrastructure.

---

## 1. Why this packet exists

Three independent reviews of the repository on 2026-09-05 (a full product
audit, a CLI-specific audit, and a chat summary of the first) were each
verified directly against the code and the live database rather than accepted
as reported. Every checked finding held up. Two things surfaced that none of
the three reviews said, and they set this packet's priority order:

- **Source bytes have zero backup coverage.** `db/client.ts`'s
  `backupExistingDatabase` copies `db.sqlite` only; nothing backs up either
  snapshot directory. At the time of writing this covered 306 MB across two
  directories — the entire retrievable evidence base.
- **The live database has never produced a directional verdict.** All 270
  `evidence` rows read `polarity = 'inconclusive'` (0 `supports`, 0
  `contradicts`); all 270 read `assurance_level = 'unknown'`; `decisions` holds
  1 row in the project's lifetime. Every other finding in all three reviews is
  scaffolding around a core that has not yet fired once.

Full findings, verification table, and the three-review comparison are
recorded in `SESSION_CHECKPOINT.md`'s 2026-09-05 entry, not duplicated here.

## 2. Outcome

Six steps, agreed with the user 2026-09-05, each with an observable
completion state — not "tests pass," but a fact checkable against the live
database or filesystem. This packet is complete when all six are met or
explicitly deferred with a recorded reason.

## 3. Scope

In scope: snapshot storage consistency and backup, the discovery mock-mode
leak, a preflight health check, one real end-to-end verified evidence outcome,
database/export backup integrity, and CLI/doc consistency for the workflow
`CLI_WORKFLOW.md` describes.

Out of scope: the relevance/entailment layer redesign (needs its own
methodology decision per the review's P1 finding), Private Knowledge card
regeneration, weekly-briefing prioritization, and anything in M014's private-
knowledge-coverage scope. This packet does not touch what counts as
`supports`/`contradicts` — only whether the pipeline can reach either state at
all on real evidence.

## 4. Steps and status

### Step 1 — Back up both snapshot directories

**Done, 2026-09-05.** `../jp-invest-data/backups/snapshots-backup-20260905T052656Z/`
holds a verified byte-count-matched copy of both `snapshots/` (15 files) and
`source-snapshots/` (107 files) taken before any other change in this packet.

### Step 2 — Unify the snapshot directory

**Done, 2026-09-05.** `lib/research/config.ts`'s `getSnapshotDirectory()` already
reads `SOURCE_SNAPSHOT_DIR` correctly and is what the web app
(`app/api/research/run/route.ts`) and `promote-discoveries.ts` use. Only
`research-queue.ts` and `research-retry.ts` hardcoded `<dbdir>/snapshots`
instead.

Of the 15 files in the stray directory:

- **8 migrated and verified 2026-09-05.** Each file's SHA-256 was checked
  against its `document_hash` before moving, copied, re-verified byte-for-byte
  at the new path, its `source_snapshots.storage_path` row updated inside one
  transaction, and only then deleted from the old location. Final state
  confirmed directly against the live database: 0 of 114 `source_snapshots`
  rows point at a path that does not exist on disk.
- **7 were not migrated — they are zero-byte files**, not misplaced ones. This
  is the pre-existing, already-diagnosed M013 defect described in
  `snapshot-store.ts`'s comment (`pdfjs.getDocument` detaches the buffer it is
  handed before the write completes). All 7 are `research_job_sources.outcome
  = 'verified'` and carry evidence — **21 evidence rows on the live, active
  TLKM thesis** depend on documents (2021–2023 annual/sustainability/quarterly
  reports) whose retained snapshot can no longer be re-verified against source
  bytes, because the bytes were never actually persisted. **User decision,
  2026-09-05: leave the 7 rows as they are.** No re-fetch, no evidence
  flagging — recorded as a known, permanent gap in these 21 rows'
  re-verifiability against source bytes. Full record in §7.
- The two CLI script edits (swap the hardcoded path for `getSnapshotDirectory()`)
  were written and typechecked clean, then reverted to HEAD by a concurrent
  session's `git stash` (`stash@{0}`, "sync main before pull") acting on the
  same working tree — confirmed by the user to be their own separate session.
  Left untouched rather than popped or dropped (not this packet's stash to
  resolve); once that session finished, **re-applied from scratch** 2026-09-05
  — identical two-file, four-line diff, typechecked clean again. `stash@{0}`
  itself is still present and still not this packet's to touch.
- Incidental, unrelated finding: 8 files in `source-snapshots/` have no
  `source_snapshots` row referencing them at all (pre-existing, not created by
  this migration). No evidence depends on them; noted for later cleanup, not
  blocking.

**Definition of done — met.** `research-queue.ts` and `research-retry.ts` both
resolve their snapshot directory through `getSnapshotDirectory()`, typechecked
clean; 0 of the live `source_snapshots` rows unaccounted for that are not the
7 recorded zero-byte defects; the 7 have an explicit, recorded user decision
on disposition (§7).

### Step 3 — Close the mock-mode discovery leak

**Done, 2026-09-05.** The leak turned out to be two leaks, not one.

**Leak 1, active — `createDiscoveryProvider()`.** Fixed by branching on
`getResearchSourceMode()` before reading any credential, exactly as
`createSourceAdapters`, `createSecondarySourceAdapters` and
`createXbrlFactSources` already do. Discovery was the lone outlier of the four
lanes. Mock mode now returns a provider that is *off* and reports
`discovery_disabled_by_mode` — a new `DiscoveryErrorCode` kept distinct from
`discovery_not_configured` so "switched off" is never read as "searched and
found nothing".

**Leak 2, latent and previously unnamed — `buildPromotionClients()`.**
Promotion fetches `pending` rows read from the *database*, not from the
discovery call preceding it, so switching discovery off did not switch
promotion off: a candidate left pending by an earlier live run would still be
fetched over the real network against whatever origins `.env` allowlists.
`sourceMode` was already threaded down to promotion but only ever recorded as
snapshot metadata, never consulted as a control — the same "credential or
metadata as the control" mistake in a second place. Fixed at the client-
construction boundary rather than in `promotePendingForAssumption`, because
the hazard is constructing a real network client, not promoting as such:
callers that inject offline clients (every promotion test) must keep
exercising the full promote-and-classify path in mock mode. An empty map is
also what `ServiceDependencies` already documents as the safe default.

The live database held 0 pending candidates when this was found (2 fetched, 77
rejected), so leak 2 had never actually fired — latent, not harmless. The
fail-first test proved it real: against pre-fix code, mock mode built **4 real
HTTP clients** from the configured allowlists.

**Verified against the real bar, not the test count.** Full suite plus the
Playwright E2E run — both original leak sources — with the real
`SEARCH_DISCOVERY_API_KEY` still present in `.env`: **zero requests to
`api.tavily.com`**. The only Tavily line added all session was one HTTP 401 at
05:56:04, made by the fail-first run against pre-fix code — the defect
demonstrating itself, with a stubbed fake key so no credit was consumed. 453
tests pass (up from 450), typecheck / lint / build / E2E / context / status
all clean.

**Two existing tests had to change, and neither was a leak.** The two M008
`research-service` promotion tests inject their own stub provider and
`promotionClients: {}` — they were always offline, and the first placement of
the leak-2 gate wrongly broke them, which is what sent the fix to the
construction boundary instead. `discovery-promotion.test.ts`'s client-tagging
test now states `RESEARCH_SOURCE_MODE = 'live'` explicitly: its subject is how
clients are tagged once built, which is a live-mode concern the suite's mock
default no longer supplies.

Original finding, retained for the record: `lib/research/discovery/factory.ts` had no mode branch —
`createDiscoveryProvider()` relies on an unconfigured `SEARCH_DISCOVERY_API_KEY`
being the safe default in every environment, a reasoning the factory's own doc
comment states explicitly. The 2026-09-05 audit's 61 real Tavily calls (all
HTTP 200, all that day) disprove it for any environment where `.env` carries a
real key — which is this environment. The fix belongs in the factory (mode-
aware), not in the CLI scripts — Sol's CLI review attributed the 61 calls to
`research:queue`; the actual source was the vitest/Playwright suites, and a
script-level patch would leave that leak open.

**Definition of done:** running the full test suite with a real key configured
in `.env` produces zero outbound requests to `api.tavily.com`, verified by
`logs/outbound.log` byte count before/after, not by test assertions alone.
This overturns a documented M008 Slice 1 decision — recorded here rather than
edited quietly, per this repository's standing practice.

### Step 4 — `jp doctor` preflight

**Not started.** Scope: a single command that reports, from the live database
and filesystem, not from test status: snapshot directory consistency (no rows
pointing at a nonexistent or non-canonical path), per-lane outcome counts for
the most recent run of each research lane (official/secondary/XBRL/discovery),
and the count of non-`inconclusive` evidence rows. This is the check that
would have caught the assurance-axis ship (270/270 `unknown`), the IDX adapter
(67 calls, 0 documents), and discovery (0-for-65) on the day each shipped
rather than months later.

**Definition of done:** the command exists, runs against the live database,
and its output is what step 5 below is verified against — not `verify:full`'s
test count.

### Step 5 — One real verified outcome

**Not started.** Take one TLKM assumption through the full live pipeline to
either `supports` or `contradicts` on a real document — not a fixture. If it
cannot be done for any assumption after a genuine attempt, that finding is
recorded as-is; it is more valuable than completing steps 6–8 on a pipeline
that has not been shown to work end-to-end once.

**Definition of done:** a `jp doctor` (or direct database query) run before
and after shows the non-`inconclusive` evidence count move from 0, on a
document that is not a test fixture.

### Step 6 — Backup, export/import, and the CLI slice

**Not started**, and deliberately last. Covers the WAL-unsafe backup
(`db/client.ts`), export/import losing `source_adequacy_assessments` and
`assuranceLevel` and not remapping decision evidence IDs on import, and Sol's
CLI findings not already covered above: the broken `thesis:stage` →
`research:queue` handoff (no thesis ID printed — use the conversation URL as
the stable handle, per Sol's recommendation), `source-adequacy:record`
writing durable state from CLI flags with no browser gate, non-atomic
staging, and `CLI_WORKFLOW.md`'s understated description of `research:queue`.

**Definition of done:** a database backed up mid-write (WAL non-empty)
restores with the in-flight transaction intact, verified by restoring to a
separate path and reading it — not by inspecting the backup file's existence.
An exported-then-imported thesis preserves adequacy, assurance, and decision-
evidence linkage, verified by comparing the coverage ledger and verdict before
export and after import, not by field-count alone.

## 5. Acceptance criteria

- **AC-M015-01** — Both snapshot directories are backed up before any other
  change in this packet. **Met**, 2026-09-05.
- **AC-M015-02** — `research-queue.ts` and `research-retry.ts` resolve the
  snapshot directory the same way the web app and `promote-discoveries.ts` do;
  every live `source_snapshots` row not among the recorded zero-byte defects
  points at an existing file. **Met**, 2026-09-05.
- **AC-M015-03** — The 7 zero-byte snapshot rows (21 dependent evidence rows,
  live TLKM thesis) have an explicit, recorded user decision on disposition.
  **Met**, 2026-09-05 — user decision: leave as-is. See §7.
- **AC-M015-04** — Mock mode makes zero outbound calls to the discovery
  provider with a real key configured, verified against `logs/outbound.log`.
  **Met**, 2026-09-05 — full suite and E2E, real key present, zero
  `api.tavily.com` requests; the two leaks and their fail-first proofs are
  recorded in step 3 above.
- **AC-M015-05** — `jp doctor` exists and reports real-output health (snapshot
  consistency, per-lane outcomes, non-inconclusive evidence count) from the
  live database. **Not met.**
- **AC-M015-06** — At least one TLKM assumption reaches `supports` or
  `contradicts` from a real document, or the attempt's failure is recorded as
  a finding. **Not met.**
- **AC-M015-07** — Backup survives a WAL-active restore, verified by restoring
  to a separate path; export → import round-trips adequacy, assurance, and
  decision-evidence linkage, verified by before/after coverage-ledger and
  verdict comparison. **Not met.**
- **AC-M015-08** — `CLI_WORKFLOW.md` accurately describes what `research:queue`
  runs, and the `thesis:stage` → `research:queue` handoff does not require a
  value the first command never prints. **Not met.**

## 6. Verification plan

- Every completion claim in this packet is checked against the live database
  or filesystem directly, not against test pass/fail — per this packet's own
  reason for existing (pattern: green tests, zero real output, repeated three
  times before this packet).
- Full suite / `tsc --noEmit` / `lint` / `context:check` / `status:check`
  clean before any step is marked done, in addition to the direct check above,
  not instead of it.
- Step 3's fix is proven against `logs/outbound.log` call counts before and
  after, with a real (not synthetic) key configured — a mocked key does not
  reproduce the defect this step closes.
- Any DB mutation is preceded by a fresh backup and a read-only integrity
  check of the specific rows being touched (as done for step 2's migration),
  not assumed safe because it "should" be reversible.

## 7. Risks and deferrals

- **New, unnamed by any of the three reviews**: 21 live evidence rows for
  TLKM's 2021–2023 official filings rest on snapshot files that are
  permanently empty. The evidence itself was very likely captured correctly —
  extraction ran on the in-memory buffer before the write-time defect
  truncated it — but this cannot be proven from what is on disk today, and it
  cannot be re-verified against original bytes if ever challenged.
  **Resolved, user decision 2026-09-05: leave as-is.** No re-fetch, no
  evidence flagging. Recorded here as a permanent, known gap: these 21
  evidence rows (documentHashes `8de29aa3979e…`, `7c37e1170784…`,
  `20c0a56ea7f3…`, `22b3ff91080e…`, `75d5ab403dd0…`, `0a4d768138a4…`,
  `275e9107e3a2…`, full hashes in `source_snapshots`) cannot be re-verified
  against original source bytes if their content is ever challenged. This is
  not a defect this packet leaves half-fixed — it is the accepted, permanent
  shape of that data going forward.
- **Concurrency**: this session and at least one other terminal-agent session
  operate on the same working tree concurrently (confirmed by the user,
  2026-09-05). A `git stash` from either session can collaterally revert the
  other's uncommitted edits. No new mitigation is added by this packet beyond
  recording it; it is a pre-existing condition of the project's multi-agent
  terminal workflow (`DEC-0017`).
- Step 5 may fail to produce a directional verdict for reasons this packet
  cannot fix within its own scope (e.g., if the binding constraint turns out
  to be the relevance/entailment gap the main review flags as P1, needing its
  own methodology decision). That outcome is an acceptance criterion met by
  recording the finding, not a packet failure.
- The 8 unreferenced files found in `source-snapshots/` during step 2's
  verification are noted, not remediated — no evidence depends on them.

## 8. Reversal

Step 1 is additive only (a new backup directory). Step 2's migration is
reversible from the step-1 backup and was verified transactionally (DB update
and file move committed together per file, with hash verification before
delete). Steps 3–6 each touch running behavior or stored data directly;
each will record its own specific reversal path when implemented, per this
repository's standing practice of a `git revert`-able commit per behavioral
change.
