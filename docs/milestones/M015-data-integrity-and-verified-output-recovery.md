# M015: Data Integrity & Verified-Output Recovery

Status: `accepted` (2026-09-05) — steps 1-5 done; step 6 next. Step 5 is done
as a recorded failed attempt: A1 cannot be settled because the transaction it
measures has not closed. Non-inconclusive evidence remains 0.

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

### Step 4 — `npm run doctor` preflight

**Done, 2026-09-05.** Command name is `npm run doctor` (`scripts/doctor.ts`)
to match this repository's script convention; the packet's earlier `jp
doctor` shorthand means the same thing.

#### Why a naive version of this would fail

The obvious design — fail whenever the system looks unhealthy — would exit
non-zero today and every day until step 5 lands, because 0 of 270 evidence
rows are directional. A check that is always red is a check nobody reads, and
"nobody was looking" is precisely how the three misses this command exists to
prevent happened. So the design separates *defects*, which are assertable and
must fail, from *yield*, which is a fact to report and watch for regression.

#### Tier A — integrity assertions (exit 1)

Definitively broken, actionable immediately, and all currently green except
where an exception is recorded:

- **A1.** Every `source_snapshots.storage_path` resolves to a file that
  exists. (Live today: 114/114 pass.)
- **A2.** No snapshot file is zero-byte while its `research_job_sources`
  outcome is `verified`. **Seven documented exceptions**, listed by
  `document_hash` in the script itself — the M013 `pdfjs` buffer-detach
  defect the user accepted on 2026-09-05 (§7). The exception list is by exact
  hash, not by a count or a directory, so an *eighth* occurrence fails. An
  accepted defect must stay visible, not become an invisible pass.
- **A3.** Every `storage_path` sits under `getSnapshotDirectory()`. Same seven
  hashes are the recorded exception — they were deliberately left in the old
  directory.

#### Tier B — lane liveness (exit 1)

Per lane — issuer official, IDX official, issuer press release, news wire,
issuer info memo, XBRL, discovery→promotion — report attempts, successes, and
last success. `source_snapshots.sourceName` carries the lane label already
(verified live: `Issuer official (TLKM)` 38, `Issuer press release (TLKM)` 32,
`Issuer info memo (TLKM)` 20, `IDX official disclosure (TLKM)` 9, `CNBC
Indonesia Market` 8, web-discovered 7), and `logs/outbound.log` carries
attempts per host.

**The rule: a lane with attempts ≥ 10 and successes == 0 fails.** This is the
one liveness assertion that is a statement of fact rather than a wish — a
mechanism exercised ten times that has never once worked is broken, not merely
unlucky. A lane with zero attempts does not trip it, so an unconfigured lane
stays quiet. Applied historically this rule fails on the day of, not months
later: IDX at 67 attempts / 0 documents, discovery at 65 candidates / 0
promotions. The threshold of 10 is the one calibration input here; it is an
engineering tolerance, not a thesis threshold, and is proposed rather than
assumed — raise it if a lane legitimately needs more attempts before a first
success.

#### Tier C — yield facts (exit 2 on regression only)

Reported every run, never failing on their absolute value, compared against a
committed baseline at `docs/generated/doctor-baseline.json`:

- evidence by `polarity` (live today: 270 inconclusive, 0 supports, 0
  contradicts)
- evidence by `assurance_level` (live today: 270 unknown, 0 audited, 0
  unaudited)
- snapshots and evidence per lane
- `decisions` row count (live today: 1)

A drop in any success count, or a lane's last-success timestamp going stale
past its expected cadence, is a regression and exits 2 — a distinct code from
Tier A/B so automation can treat "something broke" and "something got worse"
differently. Baseline is regenerated explicitly with `--update-baseline`,
never silently, so a regression cannot be laundered into the new normal by a
routine run.

#### Tier D — warnings (exit 0)

Reported, never failing: snapshot files in the canonical directory that no
`source_snapshots` row references (live today: 8, pre-existing, no evidence
depends on them).

#### Flags

- default: human-readable, grouped by tier
- `--json`: machine-readable, for step 5's before/after comparison
- `--strict`: additionally fails when non-inconclusive evidence count is 0.
  Not the default, because that would be permanently red until step 5 lands.
  Step 5 uses `--strict` as its own acceptance gate.
- `--update-baseline`: rewrites the Tier C baseline; refuses to run if Tier A
  or B is failing, so a broken state cannot be baselined as normal.

#### Deliberately not part of `verify:full`

`verify:full` validates the repository — code, types, docs, tests. `doctor`
validates the live database and filesystem, which a clean checkout does not
have. Keeping them separate is the point: the three historical misses all
passed `verify:full` on the day they shipped. Both must be green to close any
M015 step; neither substitutes for the other.

#### Definition of done — met, 2026-09-05

The command exists, runs against the live database, and reproduces the four
findings this milestone already established by hand: 114/114 paths resolve,
the 7 zero-byte exceptions are listed as accepted rather than passing
silently, IDX shows 9 snapshots / 22 evidence rows, and non-inconclusive
evidence reads 0. Verified live — actual `npm run doctor` output, not a test
count — in `SESSION_CHECKPOINT.md`'s 2026-09-05 entry. Step 5 is then verified
against `doctor --json` output before and after, not against a test count.

Read-only by construction: `computeDoctorReport` opens its own
`new Database(dbPath, { readonly: true, fileMustExist: true })` rather than
`db/client.ts`'s `getDatabase()`/`createDatabase()`, which run migrations and
set a WAL pragma on connect — writes doctor must never perform. `db/client.ts`
is not imported at all: it (and `lib/research/http.ts`, `service.ts`, and
every other module in the live pipeline) starts with `import 'server-only'`,
which throws unless the process carries Node's `--conditions=react-server`
flag; doctor's own npm script deliberately does not carry it, matching
`status-check.ts`'s plain invocation, so the database path is resolved by a
small function mirroring `db/client.ts`'s `resolveDatabasePath` (same
`DB_PATH` env var, same fallback) rather than importing it.

Lane attribution for Tier B/C is derived, not a new registry: the six
fetch-based lanes classify `source_snapshots`/`evidence` rows by the same
`sourceName` prefix (or, for XBRL, `sourceFormat === 'xbrl'`) those tables
already carry, and attempts come from `logs/outbound.log` grouped by hostname
against the same host allowlists `lib/research/adapters/factory.ts` already
hardcodes per lane (`issuer official`/`issuer info memo` necessarily share
one host set — both fetch `ISSUER_SOURCE_URLS`'s report-listing page and are
only distinguished after the fact, by which classifier the fetched document
matches). `discovery → promotion` is the one lane read from
`discovery_candidates` instead: a candidate hits arbitrary origins (the point
of web search), so there is no host to attribute attempts to, and
`status = 'fetched'` — not mere `resulting_document_hash` presence — is the
genuine-promotion signal, since `cleanup-mislabelled-promotions.ts` can leave
a document hash on a candidate it has relabelled back to `rejected`.

**A new finding surfaced by building the tool, not fixed by it.** Applied
honestly, Tier B fails today: the `XBRL (SEC structured facts)` lane reads 55
attempts / 0 successes. Investigated rather than adjusted away — those 55
`www.sec.gov`/`data.sec.gov` log lines are the one-off manual SEC/XBRL probe
M011 ran on 2026-07-05, 07-30, and 08-03 against a real TSLA CIK, logged to
the shared `logs/outbound.log` per ADR-0006's "log every outbound call" rule.
There has never been a live US-market thesis, so `processResearchJobs` has
never actually invoked this lane in production; the mechanism itself is
live-verified working (M011: 282 real TSLA facts, correctly classified). The
log carries no field distinguishing a manual probe from a production call, so
this cannot be filtered out mechanically without adding something step 4's
text does not specify. Because Tier B fails, `--update-baseline` correctly
refuses — exactly its documented job, "a broken state must never be
baselined as normal." **User decision, 2026-09-05: ship doctor exactly as
specified, with no XBRL-specific carve-out; leave
`docs/generated/doctor-baseline.json` ungenerated until a follow-up resolves
it** (a real US-market thesis exercising the lane, or an explicit, visible
Tier B exception mirroring A2/A3's hash list — not decided here). Recorded as
an open risk in §7, not silently worked around.

### Step 5 — One real verified outcome

**Done, 2026-09-05 — as a recorded genuine failed attempt.** A1 was attempted
and cannot be settled. Not because retrieval failed, not because extraction
failed, but because **the transaction A1 measures has not closed**, so the
number its contract asks for does not yet exist in any document. No code was
written; writing any would have meant manufacturing the verdict.

#### The contract, read from the live database rather than paraphrased

`assumption_measurements` for `42333c4e-6602-49a6-877f-9f7ec663fc79`:

| field | value |
|---|---|
| `resolution` | `resolved` |
| `metric` | Persentase kepemilikan TLKM di PT Telkom Data Ekosistem (NeutraDC) pasca-transaksi |
| `definition_variant` | Kepemilikan ekonomi langsung + tidak langsung TLKM, diukur setelah closing transaksi pelepasan ~70% saham yang sedang diproses |
| `operator` / `threshold` / `unit` / `time_basis` | `gte` / `30` / `percent` / `instant` |

Three requirements, each independently binding: **after closing**, **economic**
ownership, **direct + indirect**. A figure missing any one of them is not a
near-miss; it measures something else.

#### What was inspected

Every one of A1's 56 evidence rows and all 25 distinct documents behind them,
each file re-hashed against its `document_hash` — 24 of 25 verified byte-exact,
the 25th being `7c37e117…`, one of the seven accepted zero-byte snapshots (§7).
Ten of the 25 are `source_tier = 'official'`: 3 IDX official disclosures (one
`assurance_level = 'audited'`) and 7 issuer official filings.

Because A1's *extracted* evidence is not the same thing as A1's *retained
bytes*, the search was then widened past the evidence rows: all 116
`source_snapshots` were re-extracted through the pipeline's own
`extractDocument`, 109 yielding text (the 7 zero-byte defects skipped). **48
documents mention NeutraDC or PT Telkom Data Ekosistem. None states a
post-closing TLKM ownership percentage. None states that the transaction
closed.**

#### Candidate matrix

| document | hash | published | closed? | states a % ? | blocker |
|---|---|---|---|---|---|
| IDX Q2-2026 financial statement | `ec80a0bdc712…` | 2026-07-31 | **no** | yes — `PT Telkom Data Ekosistem … 100.0` | pre-closing consolidated ownership, not post-closing |
| IDX FY2025 annual financial statement | `9b766bb9f05d…` | 2026-05-11 | no | yes — `TDE … 100.0` | same |
| IDX Q1-2026 financial statement | `fbbe1b6d0c3d…` | 2026-05-29 | no | yes — `TDE … 100.0` | same |
| IDX FY2024 + 2025 Q1/Q2/Q3 statements | `f425eebc9ade…`, `dfa170de1e23…`, `57f83d9256ea…`, `78832be2c8e1…` | 2025-04-17 → 2025-10-30 | no | yes — `TDE … 100.0` | same, and older |
| IDX sustainability report (`assurance_level = audited`) | `c51b7770d952…` | 2025-04-21 | no | no | NeutraDC named only for green-DC development |
| Issuer AR 2024 (Bahasa) | `021cd384b94f…` | — | no | **yes — 79,93% direct + 20,07% via Sigma Cipta Caraka** | disclosed to establish an affiliate relationship for a **10 Dec 2024 land-and-building purchase**; pre-transaction, and the closest passage in the corpus |
| Issuer AR 2024 (English) | `1a4c1666082d…` | — | no | yes — `TDE … 100%` subsidiary list | pre-closing consolidated ownership |
| Issuer AR 2025 | `c0294f44e842…`, `6834daad5d92…` | 2026-05-12 | no | yes — `TDE … 100%` | pre-closing; the *unlocK value* pillar states intent to monetise DC assets via partnership, no transaction |
| Issuer press release | `9244428b1531…` | 2026-07-31 | no | no | describes a **consolidation** making NeutraDC the group's central DC manager — future tense, and a different transaction |
| Issuer press release (NeutraDC × PLN MoU) | `5adc8a8f1ffa…` | 2026-08-14 | no | no | NeutraDC still "operating company dari PT Telkom Indonesia (Persero) Tbk"; its 200 MW figure is power capacity |
| Issuer press release | `619e445e26d9…` | 2026-09-03 | no | no | most recent document in the corpus; NeutraDC mentioned only as an AI-ready DC capability |

The closest passage found anywhere, quoted verbatim from `021cd384b94f…`:

> "1. PT Telkom Data Ekosistem 79,93% dimiliki oleh PT Telkom Indonesia
> (Persero) Tbk; dan 20,07% dimiliki oleh PT Sigma Cipta Caraka (dimiliki
> 99,99% oleh PT Telkom Indonesia (Persero) Tbk."

It is the right entity, the right ownership concept, and even the right
direct + indirect decomposition — and it is still unusable, because it
describes ownership **as at 10 December 2024**, before the divestment began.
Reading it as A1's answer would mean reporting pre-closing ownership as
post-closing ownership.

#### The blocker, named

**The transaction has not closed.** This is source absence downstream of a
real-world event that has not happened — not a retrieval failure, not an
extraction limitation, and not a direct/indirect definition mismatch.

Producing an `observedValue` from this corpus would require asserting that a
pre-closing figure survives a closing that has not occurred. That is not
arithmetic over clearly labelled source values; it is a prediction.
`classifyPolarity` already answers this correctly — all 56 A1 rows read
`no_observed_value`, which is the accurate reason, not a degraded one.

#### One question this step's earlier text left open, now answered

The superseded step-5 outlook asked, of the IDX snapshots reading
`assurance_level = 'unknown'` despite arriving the day the assurance axis
shipped: *"Whether the classifier did not run on these rows or ran and could
not decide is an open question."* **It did not run.** `a2f766f` was committed
2026-09-04 at 15:44 +0700; all 9 of those snapshots were written earlier the
same day, at 01:00 and 04:24, by the scheduled refresh — before the classifier
existed. The two IDX documents retrieved *after* it shipped, on 2026-09-05 at
06:40 (`c51b7770d952…`, `f425eebc9ade…`), both classify **`audited`**, and are
the source of the 6 `audited` evidence rows now in the database — the only
non-`unknown` assurance values in the whole corpus. The classifier works;
those 9 rows are simply older than it. No backfill is proposed here: the
column's own contract is that `'unknown'` means *not established*, and
re-deriving it retroactively is a separate decision.

The IDX lane's live counts have also moved since step 4 was written: **11
snapshots / 28 evidence rows**, up from 9 / 22.

#### Two secondary findings, neither fixed here

**A refresh would not have helped, and the live data shows it rather than
argues it.** A1's job is `succeeded` at 31 attempts, last updated
2026-09-05T06:40:08Z — a live run made by a concurrent session that morning. It
retrieved two documents, both from **2025** (`c51b7770d952…`, `f425eebc9ade…`),
sweeping backwards through the already-known set. The newest IDX document
remains the 2026-07-31 filing. Re-running `research:refresh` would have
repeated the same calls against the same corpus, so no live run was made and no
network call was spent on this step.

**`IdxAdapter` structurally cannot retrieve a material-transaction
disclosure.** `REPORT_TERMS` (`lib/research/adapters/idx.ts:7`) admits only
`laporan keuangan`, `financial statement`, `annual report`, `laporan tahunan`
and `audited` — so *"Transaksi Material Tanpa Persetujuan RUPS"*, the
announcement type M013 named as A1's likely source, is filtered out before its
attachment is ever seen. This matters for the day the transaction *does* close,
and it is a second named blocker sitting behind the first. **Not changed
here**: widening a live adapter's discovery filter is a retrieval-behaviour
change needing its own fail-first proof and a live run, and it would not have
moved A1 today, because the disclosure it would admit does not exist yet.

#### Definition of done — met, under the failure-recording clause

This step's own text: *"If it cannot be done for any assumption after a genuine
attempt, that finding is recorded as-is."* The attempt was genuine and this is
the record. `tierC.current.nonInconclusiveEvidenceCount` reads **0 before and 0
after**, and honestly so.

Nothing was written. The live database is byte-identical across the whole
investigation — all 11 tables fingerprinted before and after, `db.sqlite` mtime
unchanged — and `logs/outbound.log` is unchanged at 5,209 lines / 3,155 Tavily
calls. No backup was required because no mutation was attempted.

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
  live database. **Met**, 2026-09-05 — `npm run doctor` reproduces all four
  hand-established facts live (§4, §6). The Tier C baseline file is a
  separately recorded open item (§4, §7), not a condition of this criterion:
  the criterion is that the tool exists and reports correctly, which it does.
- **AC-M015-06** — At least one TLKM assumption reaches `supports` or
  `contradicts` from a real document, or the attempt's failure is recorded as
  a finding. **Met, 2026-09-05, under the failure-recording clause.** A1 was
  attempted against the full retained corpus and cannot be settled: the
  transaction its contract measures has not closed, so no document states the
  post-closing figure. Candidate matrix, verified hashes, the closest passage
  found, and the named blocker are in step 5 above. Non-inconclusive evidence
  stays at **0**, which is the honest count — no directional row was
  manufactured, and no code was written to force one.
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
  **This is what happened, 2026-09-05, and the binding constraint was neither
  of the two anticipated ones.** It was not retrieval and not relevance: the
  transaction A1 measures has not closed, so the figure does not exist yet in
  any document, anywhere. The corpus is not inadequate — the event has not
  happened. Step 5 above carries the full record. Consequence for the packet:
  the pipeline still has not been shown to reach `supports`/`contradicts`
  end-to-end once on real data, and A1 is no longer the best candidate for the
  next attempt — its blocker is a calendar, not a defect. A future attempt
  should start from **A4**, the one assumption M013 classified (A), whose
  contract asks for a segment YoY differential that TLKM's filings do publish.
- **Surfaced by step 5, not fixed by it: `IdxAdapter.REPORT_TERMS`
  (`lib/research/adapters/idx.ts:7`) admits only periodic financial reports.**
  A material-transaction disclosure — *"Transaksi Material Tanpa Persetujuan
  RUPS"*, exactly the announcement type M013 named as A1's likely source — is
  filtered out before its attachment is ever seen. Deliberately not changed
  here: widening a live adapter's discovery filter is a retrieval-behaviour
  change needing its own fail-first proof and a live run, and it would not have
  moved A1 today. It becomes load-bearing on the day the transaction closes.
- The 8 unreferenced files found in `source-snapshots/` during step 2's
  verification are noted, not remediated — no evidence depends on them.
- **New, surfaced by step 4 itself, 2026-09-05: `doctor`'s Tier B fails on
  the `XBRL (SEC structured facts)` lane (55 attempts, 0 successes), and this
  is not a production defect.** The 55 attempts are a one-off manual SEC/XBRL
  probe M011 ran against a real TSLA CIK on 2026-07-05/07-30/08-03, logged to
  the shared `logs/outbound.log` (ADR-0006 logs every outbound call
  regardless of caller); there has never been a live US-market thesis, so the
  actual pipeline has never invoked this lane, and the log carries no field
  distinguishing a manual probe from a production call. **Resolved for now,
  user decision 2026-09-05: ship `doctor` exactly as specified — no
  XBRL-specific exception — and leave `docs/generated/doctor-baseline.json`
  ungenerated** rather than baseline a Tier-B-failing state or invent an
  exception mechanism step 4's text does not specify. Consequence: the
  Tier C baseline does not yet exist, so Tier C currently always reports "no
  baseline" rather than comparing for regression, until this is resolved by
  either a real US-market thesis exercising the XBRL lane or an explicit,
  future decision to add a Tier B exception analogous to A2/A3's hash list.

## 8. Reversal

Step 1 is additive only (a new backup directory). Step 2's migration is
reversible from the step-1 backup and was verified transactionally (DB update
and file move committed together per file, with hash verification before
delete). Steps 3–6 each touch running behavior or stored data directly;
each will record its own specific reversal path when implemented, per this
repository's standing practice of a `git revert`-able commit per behavioral
change.
