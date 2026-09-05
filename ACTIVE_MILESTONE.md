# Active Milestone

Status: `accepted` — **M015 opened 2026-09-05, steps 1–5 done; step 6 open.**
Three independent reviews of the repository (a full product audit, a
CLI-specific audit, and a chat summary of the first) were verified directly
against code and the live database on 2026-09-05; every checked finding held.
Two things surfaced that none of the three reviews said: source bytes had zero
backup coverage, and the live database has never once produced a directional
verdict (276/276 evidence rows `inconclusive` as of 2026-09-05; 270 when first
measured). **Step 5 attempted to change that and could not — see below; the
count is still 0 and that is the honest answer.** See
[`docs/milestones/M015-data-integrity-and-verified-output-recovery.md`](docs/milestones/M015-data-integrity-and-verified-output-recovery.md)
for the six-step Definition of Done and `SESSION_CHECKPOINT.md`'s 2026-09-05
entry for the full verification record.

**M013's post-sign-off roadmap (steps 1–4, 2026-09-03→04) is complete and
superseded by M015** — its step 6 (assurance metadata) shipped 2026-09-04
(`a2f766f`); its step 5 (IDX vertical slice) was declined by the user
2026-09-04. Both are closed; M015 is the active packet.

Active Packet: [`docs/milestones/M015-data-integrity-and-verified-output-recovery.md`](docs/milestones/M015-data-integrity-and-verified-output-recovery.md).
M014 (private-knowledge coverage expansion) remains `accepted`/dormant,
unchanged, and out of M015's scope — it resumes only after M015 closes.

**Governance note (opened 2026-08-29, closed 2026-09-03):** Closed 2026-09-03: User provided explicit sign-off statement ("sign-off m013 dulu"). Both this file and the packet now record status `accepted` with all criteria met and verified.

Latest Completed Packet: [`docs/milestones/M013-source-adequacy-and-official-path-recovery.md`](docs/milestones/M013-source-adequacy-and-official-path-recovery.md) (complete 2026-09-03; official-source path repaired and live-validated; per-assumption source adequacy classified)

## Current Phase — M015: data integrity and a first real verified outcome

**Step 1 done**: both snapshot directories backed up and count-verified
before any other change (`../jp-invest-data/backups/snapshots-backup-20260905T052656Z/`).

**Step 2 done**: of 15 files in the stray `snapshots/` directory, 8 were
migrated to the canonical `source-snapshots/` path with SHA-256 verified
before move, after move, and against the updated `source_snapshots.storage_path`
row, all inside one transaction per file. The remaining 7 are not misplaced —
they are zero-byte files, the pre-existing M013 `pdfjs` buffer-detach defect,
and carry **21 evidence rows on the live TLKM thesis** whose snapshot can no
longer be re-verified against source bytes. **User decision, 2026-09-05: leave
as-is** — a permanent, recorded gap in those 21 rows' re-verifiability, not a
defect this packet leaves half-fixed. `research-queue.ts` and
`research-retry.ts` now both resolve the snapshot directory through
`getSnapshotDirectory()`, typechecked clean — the edit was briefly reverted
mid-session by a concurrent terminal-agent session's `git stash` acting on the
same working tree (confirmed by the user as their own session, now finished)
and was re-applied from scratch once that session was done. `stash@{0}`
("sync main before pull") is still present on disk and is deliberately not
this packet's to touch.

**Step 3 done**: the leak was two leaks. `createDiscoveryProvider()` now
branches on `getResearchSourceMode()` before reading any credential — the same
guard its three sibling factories already had, making discovery no longer the
lone outlier — and returns an *off* provider reporting a new
`discovery_disabled_by_mode` code, deliberately distinct from
`discovery_not_configured` so "switched off" never reads as "found nothing".
The second, previously unnamed leak: `buildPromotionClients()` built real HTTP
clients in mock mode, and promotion fetches `pending` rows from the database
rather than from the discovery call, so switching discovery off did not switch
that off. Gated at client construction rather than at promotion behaviour, so
callers injecting offline clients keep exercising the full path. That leak was
latent — 0 pending candidates live — but the fail-first test proved it real:
pre-fix, mock mode built **4 real HTTP clients** from configured allowlists.

Verified against the real bar: full suite **and** the Playwright E2E run —
both original leak sources — with the real key still in `.env` produced
**zero `api.tavily.com` requests**. 453 tests pass (up from 450), typecheck /
lint / build / E2E / context / status clean. The one Tavily line added all
session was a single HTTP 401 from the fail-first run against pre-fix code —
the defect demonstrating itself, with a stubbed fake key, so no credit was
spent.

**Step 4 done, 2026-09-05** — `npm run doctor` (`scripts/doctor.ts`), matching
the packet §4 design. Three tiers so the command is not permanently red:
integrity assertions and lane liveness hard-fail (exit 1), yield facts are
reported and fail only on regression against a committed baseline (exit 2).
The load-bearing rule is **a lane with ≥ 10 attempts and 0 successes fails** —
a statement of fact rather than a wish, and one that would have caught IDX
(67 attempts, 0 documents) and discovery (65 candidates, 0 promotions) on the
day of. The seven accepted zero-byte snapshots are an exception list keyed by
exact hash, so an eighth occurrence still fails. Opens its own SQLite handle
read-only (`new Database(dbPath, { readonly: true })`) rather than
`db/client.ts`'s `getDatabase()`, which runs migrations and a WAL pragma on
connect — doctor must never write to the database, and the only file it
writes at all is `docs/generated/doctor-baseline.json`, and only under
`--update-baseline`.

**Finding while specifying step 4: the IDX lane is working, and the documents
below say it is not.** The live database holds **9 IDX official disclosure
snapshots** (all `live`, all HTTP 200, retrieved 2026-09-04 by the unattended
daily refresh, publish dates to 2026-07-31) which produced **22 evidence
rows**. The `831941e` `.trim()` fix worked; the superseded narrative below,
accurate when written, records IDX as never having produced a document and the
pipeline as never re-run. Nothing reports lane-level yield, so the recovery
went unrecorded — the inverse of the three misses step 4 targets. This makes
**A1** the first candidate for step 5: M013 classified it (B), "blocked by a
named blocker", and that blocker was this defect. Still open: all 22 rows
remain `inconclusive`, and all 9 snapshots read `assurance_level = 'unknown'`
despite arriving the day the assurance axis shipped.

**Verified live, 2026-09-05, against real data, not fixtures:** `npm run
doctor` reproduces all four facts this milestone established by hand — 114/114
`source_snapshots.storage_path` rows resolve; the 7 zero-byte hashes report as
accepted exceptions, listed by hash, not a silent pass; IDX official shows 9
snapshots / 22 evidence rows; non-inconclusive evidence reads 0. Full run
output is in `SESSION_CHECKPOINT.md`'s 2026-09-05 entry.

**A new finding surfaced by building the tool, not fixed by it: Tier B
currently fails, and `--update-baseline` correctly refuses as a result.** The
`XBRL (SEC structured facts)` lane reads 55 attempts / 0 successes — dead by
the rule's own mechanical definition — but the 55 attempts are not production
traffic. They are the one-off manual SEC/XBRL probe M011 ran on 2026-07-05,
07-30, and 08-03 against a real TSLA CIK (`data.sec.gov`/`www.sec.gov`),
logged to the same shared `logs/outbound.log` per ADR-0006's "log every
outbound call" rule — there has never been a live US-market thesis, so
`processResearchJobs` has never actually invoked this lane. The mechanism
itself is live-verified working (M011: 282 real TSLA facts, correctly
classified); it has just never been production-exercised, and the log has no
field distinguishing a manual probe from a pipeline call. **User decision,
2026-09-05: ship doctor exactly as specified, with no XBRL-specific
carve-out, and leave `docs/generated/doctor-baseline.json` ungenerated for
now** rather than add an exception mechanism the packet's step 4 text does not
specify. AC-M015-05 is met for the tool itself (it exists, reads the live
database read-only, and reports real-output health); the baseline file is a
recorded open item, not silently worked around — resolved by a future
decision (e.g. a real US-market thesis exercising the lane, or an explicit,
visible Tier B exception mirroring A2/A3's hash list) rather than assumed away
here.

**Step 5 done, 2026-09-05 — as a recorded genuine failed attempt, and the
reason is not the one anything predicted.** A1 was taken as far as the retained
corpus allows and cannot reach `supports` or `contradicts`. Not retrieval — the
IDX lane works, and a concurrent session's live run that same morning
(2026-09-05T06:40) exercised it. Not extraction, and not the relevance gap the
main review flagged as the likely blocker. **The transaction A1 measures has
not closed.** Its contract asks for TLKM's direct + indirect economic ownership
of NeutraDC *after closing*, at `gte 30 percent`, `instant`; the most recent
official filing in the corpus (IDX Q2-2026, published 2026-07-31, hash
`ec80a0bdc712…`) still lists `PT Telkom Data Ekosistem … 100.0`, as does every
one of the 8 IDX filings, and the two most recent issuer releases (2026-08-14,
2026-09-03) still describe NeutraDC as a Telkom operating company.

All 116 snapshots were re-extracted through the pipeline's own
`extractDocument` and searched — not just A1's 56 evidence rows. 48 documents
mention NeutraDC; **none states a post-closing ownership percentage and none
says the transaction closed.** The closest passage in the entire corpus is the
2024 annual report's *"PT Telkom Data Ekosistem 79,93% dimiliki oleh PT Telkom
Indonesia (Persero) Tbk; dan 20,07% dimiliki oleh PT Sigma Cipta Caraka"* —
right entity, right direct + indirect decomposition, and still unusable,
because it describes ownership as at **10 December 2024**, disclosed to
establish an affiliate relationship for a land-and-building purchase. Using it
would mean reporting pre-closing ownership as post-closing ownership.

Non-inconclusive evidence is **0 before and 0 after**, and honestly so. Nothing
was written: the live database is byte-identical (all 11 tables fingerprinted
before and after), `logs/outbound.log` unchanged, no network call spent. A1 is
no longer the best next candidate — its blocker is a calendar, not a defect;
**A4** (class (A), a segment YoY differential TLKM does publish) is. A second
blocker was surfaced and deliberately left: `IdxAdapter.REPORT_TERMS` admits
only periodic financial reports, so the *"Transaksi Material"* announcement
M013 named as A1's source is filtered out before its attachment is seen —
load-bearing on the day the transaction closes, irrelevant before it. Full
candidate matrix and hashes in the packet §4 step 5.

### Superseded — the narrative below predates M015

**Slice 5 completed 2026-09-02.** Two decisions closed it, both the user's.
**A6 = (C)** — no public source identified for the current measurement contract;
across 90 documents and 238 rows, including the 20-F and the fully OCR'd 41-page
climate report, no firm PLN power figure in MW/MVA/GW has ever appeared. The
8/31 claim that the corpus "does hold the figures A6 needs" did not survive
being read against the contract: the 200 MW figure is *data-centre capacity*
against a bar of **1,200 MW of firm PLN allocation**, and every one of the nine
MW/GW rows in the thesis measures IT load or self-generated solar instead.
**A6's threshold is recorded as defective and deliberately left unchanged** — at
1,200 MW against a 200 MW ambition it is unsatisfiable at any realistic scale,
but re-framing it now would delete the finding, the same reasoning that deferred
A2 and A5.

**Q4 closed on shape, not on volume.** Measurement showed volume is not the
binding constraint: arrival swings 14 → 118 rows/week with pipeline health,
while **236 of 236 rows sit at `inconclusive`** and `impact_summary` — though
populated everywhere — holds **only 3 distinct values**, all describing the class
of source rather than the content. The user's *Option 3 + summary layer* is
adopted as the specification, with no number set, because nothing persisted
today can feed a summary and the model-based route is out of this packet's
scope. Building the differentiator belongs to the Q6 follow-on.

**Two operational findings from the same day**, both recorded in the packet: the
Tavily quota theory is disproved (steady state 12–14 calls/day against a
1,000/month tier; the 25-day outage came from manual M008 testing at 385–470/day
on 3–8 August), and **discovery has never once succeeded — all 65 candidates
ever produced were rejected**, a second failure mode the panel is as blind to as
the first. ISAT was archived: `active` but with no allowlist entry at all, so
its 8 jobs could never succeed.

**The parked `idx.co.id` question turned out to be a phantom (2026-09-03).**
IDX is *already* the ID market's primary official adapter, with the issuer
adapter only as its fallback, and `idx.co.id` is already an accepted attachment
host — nothing needed widening. **The real finding: that adapter has never
produced a single document.** 67 calls to `www.idx.id` since 2026-07-05, every
one HTTP 200, and zero snapshots and zero evidence; all 106 official TLKM rows
came from the fallback. Cause: the live API returns `Kode_Emiten` as fixed-width
`CHAR(100)`, so an exact `!==` discarded all 100 announcements before the
title filter — 11 of which match the adapter's own report terms. Fixed in
`831941e` (one `.trim()`, fail-first test, suite 427 green). **The pipeline has
not been re-run.**

Read against the six contracts this does **not** overturn the classification:
only **A1** can move, (B) → (A), and that is (B) working as defined — it means
"exists but blocked by a named blocker", and this bug is that blocker. A2/A5/A6
fail at the metric level, which no IDX filing touches; A3 is `not_measurable`.

**Signed off 2026-09-03.** The user chose sign-off first, `research:refresh`
deferred to the follow-on work, per the recorded recommendation. An
independent multi-model adversarial review (this assistant, then GPT, then
Gemini reviewing that exchange) followed the same day and converged on a
6-step execution order — see `SESSION_CHECKPOINT.md` "Post-sign-off roadmap"
for the full record, corrections, and two small fixes identified but not yet
applied (`route.ts:71`'s stale non-US XBRL claim; `sec-xbrl.ts`'s
`PREFERRED_FORMS` excluding real amendment forms).

### Superseded — the narrative below predates Slice 5

**Slice 4 completed 2026-08-31.** Per-assumption source adequacy: **A4 = (A);
A1, A3 = (B); A2, A5, A6 = (C)** — A6 resolved the same day when the Laporan
Risiko Iklim OCR returned with no firm MW figure anywhere in its 41 pages. The
user decided the classes after reviewing three
independent analyses; the assistant assembled evidence and reasoning and did not
classify. Two things carried forward from it: the (C) label now reads *"no
public source identified for the current measurement contract"* rather than
asserting an unprovable universal negative, and re-framing A2/A5 into reachable
proxies was **deferred to Q6 as its own explicit decision** — doing it inside
Slice 4 would have deleted the finding and quietly changed what counts as
support (`DEC-0018`). Full reasoning is in the packet's Slice 4 section; the
narrative below this line predates it.

**One measured correction came out of it, affecting `R-028`.** The register
predicted that a majority of (C) classes would pin the thesis at
`INSUFFICIENT_EVIDENCE`. It does not: `verdict.ts` falls to that level only when
`coverage.supported === 0`, so one supported assumption reaches `holding`. The
measured exposure is the reverse — at most 2 of 6 TLKM assumptions can ever be
supported, yet the verdict can read `HOLDING` off one of them while two-thirds
of the thesis is permanently untestable, and `confidenceGate` cannot detect it
(`coverageRatio` counts any quote of any polarity, so it reads 100% / `open`).
R-028's residual column now carries the measurement with the falsified
prediction left visible. This is the main input to Q5.



Acceptance was given by direction rather than by a single statement: the user
authorised each slice in turn (Slice 1 alone, then the repair, then the re-run),
and set the byte-limit calibration. Recorded that way rather than backdating a
formal acceptance that did not happen.

**Slices 1–3 complete. The Slice 4 discovery blocker is now confirmed repaired
against the live source, not just in code.** Post-2024 issuer abbreviations
(`FS`, `LK`, `AR`, `SR`, `TW`) and SEC form codes (`6-K`, `20-F`) are handled by
`classifyIssuerDocument()`, with lane separation (`IssuerAdapter` for Tier 1
official, `IssuerInfoMemoAdapter` for Tier 2) enforced by runtime invariants in
both `pipeline.ts` and `evidenceInsertValues`.

**Live run executed 2026-08-29** via `npm run research:refresh` (see the note
below on why `research:queue` alone cannot re-trigger an already-`succeeded`
job — that cost two failed diagnostic paths before the right command was
found). Counts read directly from `d:/jp-invest-data/db.sqlite` and
`logs/outbound.log` after the run, not narrated from the script's own summary:

| | Before | After |
|---|---:|---:|
| TLKM evidence, total | 121 | **158** |
| `exact_verified` | 52 | **70** |
| `secondary_issuer` | 43 | **62** |
| Official `source_snapshots` from 2024–2026 | 0 | **6** |
| Info Memo `source_snapshots` | 0 | **4** |
| Lane mismatch (`exact_verified`/`ocr_matched` paired with `sourceTier: secondary`, or vice versa) | — | **0** |

The 6 new official documents are the exact abbreviated-name filings this
milestone exists to recover, fetched live (`status: 200` each in
`outbound.log`): `Telkom-FS-Bahasa-TW-II-2026.pdf`,
`TW-I-2026-FS-Konsolidasian-Telkom-Bahasa.pdf`,
`TLKM-2025AR-fullbook-54-00-hires.pdf` (45.7 MB),
`LK-Konsolidasian-Telkom-Tahun-2025-Audited-Bahasa.pdf`,
`FS-Telkom-Triwulan-III-2025-rilis.pdf`, and one `%20`-encoded filename —
direct proof the percent-decoding regression fix (below) was load-bearing, not
theoretical. No pure marketing/roadshow deck was fetched (checked directly
against `outbound.log`); no snapshot from this run is zero bytes (checked
directly on disk, 111 KB–45.7 MB). `ISAT`'s jobs went `degraded` in the same
run for an unrelated, pre-existing reason (`issuer_source_unavailable` — no
`ISSUER_SOURCE_URLS` entry configured for it), not a regression.

**Why `research:queue` alone produced nothing, three attempts in a row:**
`processResearchJobs` only selects `research_jobs` rows with
`status = 'queued'` ([`service.ts:520`](lib/research/service.ts#L520)); all
six TLKM jobs were already `succeeded` from the 28 August cron, so the query
matched zero rows and the command exited cleanly having done nothing.
`research:retry` was also not the answer — it only accepts `degraded`/`failed`
jobs. `research:refresh` (`refreshOfficialSources` in
[`lib/research/ingestion.ts`](lib/research/ingestion.ts)) is the command that
resets every `active` thesis's jobs to `queued` before processing — it has no
per-thesis scope, so it touches every active thesis (`TLKM` and `ISAT`
currently), not just the one being investigated.

Slice 4's per-assumption source-adequacy classification — (A) Reachable /
(B) Exists but unreachable / (C) No public source — was not started *in that
session*; it ran on 2026-08-31 against the refreshed corpus. See the Current
Phase section above for the outcome.

### What Slices 1–3 established

**The official path is repaired.** Two size limits disagreed — 25 MB at download
(`lib/research/http.ts`), 10 MB at extraction
(`lib/research/extractors/document.ts`) — so documents between them were fetched,
hashed, stored, and then refused unread. Both now read one `SOURCE_BYTE_LIMIT`
(`lib/research/adapters/types.ts`, 500 MB, the user's calibration). Shipped in
`d2c6427`; suite 389 → 392. All six TLKM jobs moved `degraded` → `succeeded`,
official evidence 3 → 21 rows, and the re-run added 18 rows rather than
hundreds — the volume fear behind Q4 did not materialise.

Two things had kept the cause hidden, and both are fixed: the error text
hardcoded "25 MB" and went on being emitted after a different check did the
rejecting, and both size rejections threw **without logging** while every
neighbouring path logged first — so `logs/outbound.log` looked clean while six
jobs failed.

### Four findings, held for discussion after Slice 4

1. **The document that motivated the fix still contributes nothing.** The 24.3 MB
   Laporan Tahunan 2023 was not re-processed — `knownDocumentIds` is
   ticker-scoped (already on the open list) and skips a document once seen. The
   18 new rows come from six *newly discovered* 2021–2022 documents instead. The
   limit is genuinely repaired, proven by direct extraction (521 pages,
   1,224,092 characters, 8.5 s); a different known defect now stands between
   that document and the corpus.

2. **R-025 applies at the official tier just as badly.** Of 21 official rows, at
   most one is plausibly relevant. The rest include a glossary page and a
   disclosure-criteria index table; the strategic-investor claim drew COVID-19
   vaccine distribution, the hyperscaler claim a 2008 2G/3G procurement
   agreement, the PLN power claim post-employment health benefits. Fixing supply
   did not fix relevance — they are now measured as independent problems at both
   tiers.

3. **A regression in honesty, caused by success.** Assumption status moved from
   five `pending_confirmation` to six `untested`, which is M007 behaving as
   designed: the gate clears when official evidence arrives. But the official
   evidence that cleared it is as irrelevant as the secondary evidence it
   replaced, so the signal "this rests only on secondary sources" is gone and the
   acceptance containment from `6fa90d7` is moot. The gate keyed on **tier** as a
   proxy for trust; what it was proxying for is **relevance**, which nothing
   measures.

4. **Retained snapshots for successfully-extracted PDFs are zero bytes.** Seven
   of fifteen files in the snapshot store are empty. Cause proven, not inferred:
   `pdfjs.getDocument` transfers and detaches the source ArrayBuffer — measured
   on a real file, `byteLength` 10,972,090 → **0** after the call — and
   `persistSourceSnapshot` runs afterwards, writing the detached buffer. The
   correlation is exact: every PDF that extracted successfully is empty, the two
   rejected for size are intact, and HTML is unaffected.

**Finding 4 was repaired before Slice 4 resumed**, by user decision — it was
producing bad data on a daily schedule while Slice 4 is analysis that writes no
evidence, so pausing cost nothing. Two changes, each proven fail-then-pass:

- `extractPdf` hands pdfjs a **copy**, never the caller's buffer. This protects
  all five `persistSourceSnapshot` call sites at once, since every one of them
  runs after extraction.
- `persistSourceSnapshot` treats a **zero-byte file as a failed write**, not as
  a stored document. The guard was `existsSync` alone, so an empty file could
  never be replaced and the damage was permanent; storage is content-addressed,
  so an empty file at a hash-named path cannot be a legitimate version of it. A
  retained non-empty snapshot is still never overwritten.

Verified on live data, not fixtures: a `research:refresh` afterwards fetched six
issuer documents (annual reports 2019–2021 and three quarterly statements) and
**all six wrote intact**, 1.4–7.3 MB, where before the fix every successfully
extracted PDF became 0 bytes. `tests/snapshot-store.test.ts` is new — the module
had no test coverage at all.

**Not fully repaired, and recorded rather than smoothed over.** 21 of the 85
evidence rows still point at empty source files, because those documents have
not been re-fetched. Their quote text is intact and displays normally; what is
missing is the ability to re-verify them against the source. The self-healing
guard means a re-fetch would repair them, but that has not been done and is a
separate decision: leave them as recorded debt, re-fetch, or delete. Most of the
21 are the irrelevant passages R-025 describes, so the practical loss is small —
the broken guarantee is the real cost, not the data.

Also recorded and not yet fixed, found earlier in the same analysis:
`recordDecision` auto-populates `evidenceIds` with **every** evidence row
currently displayed (`components/ResearchPanel.tsx:196`) rather than a user
selection, so the one real decision record in the live database cites rows the
user never chose — which undermines `VISION.md` §9.7's "reconstruct the evidence
behind a decision" precisely because the record looks thorough.

### Slice 4, first finding — the official corpus stops at 2023

Slice 4 opened by mapping what the corpus actually holds, and found something
larger than any per-assumption classification. **All 15 official TLKM documents
are 2019–2023.** Nothing from 2024, 2025, or 2026 exists in the corpus, while
the thesis concerns a transaction in progress *now*.

Cause verified against the live issuer page, not inferred. Of 185 `.pdf` links
in the page HTML, 24 carry a 2024–2026 date, and `discoverIssuerDocuments`
returns **48 documents, none of them newer than 2023**. The filter
(`lib/research/adapters/issuer.ts:56`) requires the link's context to contain a
`REPORT_TERMS` entry — `laporan keuangan`, `financial statement`, `annual
report`, `laporan tahunan`, `audited`. Two facts combine:

- The page is JavaScript-rendered, so for the recent entries the anchor text and
  its container text are both **empty**. The only context available is the URL
  path.
- Telkom changed its file-naming convention around 2024, from full words
  (`Laporan Keuangan(Unaudited) 9M 2019.pdf`, `6K_Annual_Report_2019.pdf`) to
  abbreviations (`Telkom-FS-Bahasa-TW-II-2026.pdf`,
  `TLKM-2025AR-fullbook-54-00-hires.pdf`, `FS-Telkom-Triwulan-III-2025-rilis.pdf`).

`FS`, `AR`, `LK` and `TW` match none of the terms, so every report published
from 2024 onward is invisible to the pipeline. The documents themselves are on
the allowlisted host and fetchable — the 2025 annual report, FY2025 audited
financials, and 1Q/2Q 2026 statements among them.

This is the **third independent blocker on the same official path**, each
failing silently into "no evidence" rather than an error: the byte-limit
mismatch (fixed, `d2c6427`), ticker-scoped `knownDocumentIds` (known, unfixed),
and now the naming-convention gap. It also changes what Slice 4 can conclude:
A1 (30% ownership post-transaction) and A2 (Digital Infrastructure revenue
growth) both looked unanswerable and are in fact **(B) — exists but unreachable**,
behind a small and now-named blocker.

**User decision: fix this before completing the classification** (option 1 of
three offered), so the A/B/C judgment is made against a corpus that includes the
documents the thesis actually depends on. Which terms or URL patterns count as
"an official report" is a calibration the user owns — too loose and corporate
presentations and marketing decks enter the corpus.

## Previous Phase — M012 close-out

M012 is complete as the approved local-only foundation for a source-traceable
private knowledge corpus and candidate knowledge graph. The canonical raw
archive is the repository-root `originals/` directory; generated artifacts
remain under ignored `private/knowledge/`. This subsystem is deliberately
separate from the ticker/date-bound `Evidence` and `SourceSnapshot` research
pipeline.
Its product role is to provide a source-traceable analysis substrate for
user-led analysis of the educational corpus. It is not live Evidence, current
market fact, or an automatic investment-conclusion workflow; candidate graph
records remain provenance-linked knowledge rather than approved truth.

Active Packet: [`docs/milestones/M011-evidence-polarity-and-measurement-contracts.md`](docs/milestones/M011-evidence-polarity-and-measurement-contracts.md) (complete 2026-08-03; all six slices plus governance close-out implemented and tested — see "Slice Outcomes")

Latest Completed Packet: [`docs/milestones/M011-evidence-polarity-and-measurement-contracts.md`](docs/milestones/M011-evidence-polarity-and-measurement-contracts.md) (complete; R-027 → `Mitigated`, R-025 deliberately left `Open` — measurement contracts, a clarification hard block, evidence polarity, SEC XBRL structured-fact retrieval with an instant-versus-duration gate, and a deterministic verdict + coverage ledger the model does not write, proven by 99 new tests, 2 new hard-gating eval cases confirmed capable of failing, and 7/7 Playwright)

See [`docs/milestones/ROADMAP.md`](docs/milestones/ROADMAP.md) for the M005→M010 sequence. The M006 slot was re-planned on 2026-07-25: its original subject (production confidential-data provider approval) was withdrawn by [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md). M007's Class C (web search discovery) was deliberately deferred to M008, which shipped 2026-07-26 as [`M008-web-search-discovery.md`](docs/milestones/M008-web-search-discovery.md) — provider chosen (Tavily) with live-evaluated evidence, not by reputation; see the packet's §0. M008's first live run then surfaced the precision defect M009 fixes; see the paragraph below.

## Current Phase

M011 closes a gap M009 and M010 could not reach, and the progression is the
point: M009 fixed evidence **vocabulary** (which words appear), M010 fixed
evidence **shape** (what a passage looks like), and both left a system that
could retrieve without being able to *judge*. M011 adds **meaning**.

It was opened by an external finding rather than a fired review trigger. A
multi-model QA audit of a Tesla thesis — "automotive gross margin will remain
above 20% through 2026" — found that the system retrieved an automotive gross
margin of **16.9%**, a breach at the thesis's own baseline, and presented it as
the fourth of five neutral bullets. Two related defects came with it: FSD
*deferred revenue* (a balance-sheet stock) offered as support for a claim about
recognized revenue *growth* (an income-statement flow), and four of ten
assumptions with zero evidence and no report of that gap anywhere.

Four mechanisms, of which the first three are structural. **Measurement
contracts** (`assumption_measurements`, migration `0008`) normalize each
assumption to a metric, operator, threshold, unit, and time basis; a claim that
cannot be settled blocks confirmation until the user answers one clarifying
question — enforced both by a disabled button and by `confirmDraft` refusing
outright, because a disabled button is not a control. **Evidence polarity**
(three real columns on `evidence`, migration `0009`) records whether each row
supports, contradicts, or is inconclusive about its assumption, computed in
`evidenceInsertValues` — the single choke point every evidence row passes
through. **SEC XBRL structured-fact retrieval** (US only) supplies the machine-
comparable numbers polarity needs, with `factSatisfiesTimeBasis` mechanically
refusing an instant fact for any duration claim — the structural fix for the
deferred-revenue conflation. And a **deterministic verdict plus coverage
ledger** render above everything else, computed by pure functions rather than
written by a model; `generateDecisionRecommendation`'s output schema is narrowed
under a breach or thin coverage, so a breached thesis literally cannot return
`'No Change'`.

Two things are deliberately *not* done. `assumptions.status` still has no
auto-transition — `deriveAssumptionStatus`'s documented invariant is preserved,
so a breach does not surface in the Top-10 Queue, recorded as a deferral rather
than an oversight. And the optional `PolarityClassifier` seam ships
**unexercised**: nothing constructs one, and `resolvePolarityClassifier` drops
it unless research is live, which is the specific gate whose absence caused the
2026-07-29 revert. [`DEC-0016`](docs/decisions/DEC-0016-evidence-polarity-classifier-boundary.md)
governs it — the one place M011 could not hide under DEC-0015 as M009 and M010
did.

**Live verification, and the limit that remains.** A read-only probe against
real `data.sec.gov` data confirmed the retrieval and classification path end to
end: TSLA's `GrossProfit` returns 282 facts, all `duration`, correctly narrowed
to the latest 10-Q quarter and classified; `DeferredRevenueCurrent` returns 58
facts, **all `instant`**, and a duration claim pointed at it selects nothing —
the deferred-revenue defect refused against genuinely filed data. What that
probe did **not** do is persist anything: the live database holds only an
ID-market thesis, so no evidence row has been written from a live XBRL response.
Polarity is also only ever non-`inconclusive` for structured-fact evidence,
which is US-only — so the live tracked Indonesian tickers get a named
`no_source_for_market` gap and no polarity at all today.

M010 closed a gap M009 could not, and the distinction is the point. M009's three
mechanisms all filter on **vocabulary**; the 2026-07-27 live run produced a
failure of **shape** — a category-filter widget that cleared every M009 gate by
matching the literal word "Enterprise", a nav category label colliding with a
genuine assumption's word "enterprise". Three structural holes were confirmed
and fixed: `extractHtml` joined block elements with a space, so a nav widget
reached `splitSentences` as one punctuation-free run-on that `Intl.Segmenter`
returns as a single giant segment with maximal token surface (now marked with a
`U+FFFC` sentinel and exposed as `ExtractedPage.blocks`); `rankSentenceCandidates`
had no upper length bound and no length penalty (now a 400-character cap and an
8–14 word band for unpunctuated text, both secondary-tier only); and
`discoverIssuerPressReleases` accepted any link whose *container* mentioned a
press-release term, so the pipeline systematically fetched the newsroom listing
page and mined it (now five rejection rules taking the real snapshot from 29
refs to exactly 9 genuine articles). `canonicalText` is proven byte-identical on
all four retained real snapshots, and the tested identity `blocks.join(' ') ===
text` is what guarantees every quote is still a verbatim substring for
`verifyExactMatch`. Segmentation and both guards are gated on
`sourceTier === 'secondary'`, so the official path reduces to literally the
pre-M010 expression. The 15 already-persisted low-quality rows were removed by a
sweep that re-derives rather than pattern-matches — stale iff the fixed
extractor no longer produces the quote — which makes it self-validating.
**R-026** → `Mitigated`; **R-025 deliberately returned to `Open`**, because its
own trigger fired and M009's mitigation was necessary but not sufficient.
Verified live: the post-fix refresh fetched a genuine `/news/...` article and
persisted 2 rows of real press-release prose where the prior run persisted 15
rows of chrome — though one of those two matched partly on division names, so
*semantic* relevance remains unsolved and R-025 says so.

M009 closed the gap M008's first live run opened: several `secondary_issuer` evidence rows persisted as site-wide web boilerplate despite correct trust-tier labeling. Three layered mechanisms now guard `rankSentenceCandidates`
(`lib/research/extractors/candidate.ts`) and `extractHtml` (`lib/research/extractors/document.ts`) — DOM-level chrome stripping, a phrase-level denylist, and a `sourceTier`-gated qualifying-token rule that excludes the ticker and bare years from the secondary-path match minimum, the only mechanism able to catch a genuine but topically irrelevant article (the real CSR/coral-reef case) that no denylist or DOM rule can reach. The official path is proven byte-for-byte unchanged: `extractDeterministicCandidates` always calls with `sourceTier: 'official'`, so the new gate never fires for it, confirmed by a new official-tier HTML-chrome regression fixture plus the unchanged M001 eval case count (23, 0 hard-gate failures). Reviewed independently twice before implementation — a second AI collaborator (Gemini) and a separate reconciliation pass both converged on the same root cause and the same qualifying-token mechanism as the fix for the CSR-class failure. Company-name-token exclusion was explicitly scoped out (no such field exists in the call chain) and recorded as residual risk rather than silently covered. R-025 → `Mitigated`.

M001 (Existing Thesis Loop, `local-only complete`), M002 (Portfolio Positions & Ingestion Alerts), M003 (Explore-To-Tracked Loop), M004 (Multi-Thesis Briefing), M005 (OCR/Vision Provider Eligibility), M006 (In-Pipeline Vision Extraction & Injection Hardening), M007 (Secondary-Source/General-News Ingestion), M008 (Web Search Discovery, Class C), and M009 (Secondary Evidence Boilerplate Filtering) are 100% completed and verified.

Milestone 8 closes the gap M007 deliberately left open: `discoveryCandidates`
(schema-ready since M007, unpopulated until now) is wired to a real search
provider. `TavilyDiscoveryProvider` (`lib/research/discovery/tavily.ts`) was
chosen from real measured data, not vendor reputation — 12 live runs across
5 tickers (3 Indonesian, 2 US control), with a load-bearing caveat honestly
recorded rather than hidden: runs 3-12 returned byte-identical URLs
(server-side caching), so the effective independent sample is closer to 2-3
runs than 12. Google News RSS and Serper were evaluated and parked with
documented technical reasons (RSS article links resolve via client-side JS,
not an HTTP redirect chain; Serper's free tier is a one-time 2,500-query
allocation, not recurring), not deleted — see the M008 packet's §0 and §8.

`DiscoveryCandidateUrl` (`lib/research/discovery/types.ts`) has exactly one
field, `url` — the R-013 structural gate at the type level, proven
adversarially (a response dense with snippet text feeds `toDiscoveryCandidateUrls`
and none of that text survives). A candidate can only become evidence
through `promoteCandidate` (`lib/research/discovery-promotion.ts`), which
enforces DEC-0015 §3.2's domain gate *before* any fetch — an unallowlisted
origin never reaches `OfficialHttpClient`, proven by a test asserting zero
network calls. A matched fetch lands on the **same** `secondary_issuer`/
`secondary_news` evidence classes M007 built, inheriting R-010's structural
ceiling with no new trust tier. Promotion runs automatically inside
`processResearchJobs` (Slice 3's resolved design), with an explicit CLI
counterpart, `npm run research:promote-discoveries`, for re-evaluating
candidates after `.env` allowlists change — needed because nothing else
re-checks a `rejected: domain_not_allowlisted` candidate once its domain is
later trusted.

A real review-time gap was found and fixed, not left as a known issue:
`TavilyDiscoveryProvider` called `fetch` directly with zero outbound record,
unlike every other external call in this codebase (an ADR-0006 transparency
miss caught during the packet's second-opinion review). It now logs every
attempted request to `logs/outbound.log`, proven by test. R-013 moved to
`Mitigated` — the mechanism is proven; real-world coverage is still zero,
since `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` remain unconfigured
in the live environment (the same bootstrapping gap M007 already flagged
for Class A/B), recorded as residual risk rather than assumed away.

Milestone 7 added two secondary evidence classes — `secondary_issuer`
(company IR press releases) and `secondary_news` (curated financial news
wires) — structurally incapable of ever being promoted to `exact_verified`/
`ocr_matched`: `extractSecondaryCandidates` (`lib/research/extractors/candidate.ts`)
is a dedicated function whose only exits are dedicated factories, so the
invariant lives in which function was called, not in a runtime check.
Proven adversarially by reusing exact-verified-shaped source text through
the secondary path (unit test and eval case `MM-023`) and confirming it
still cannot be promoted. New adapters `IssuerPressReleaseAdapter`/
`NewsWireAdapter` (`lib/research/adapters/`) always tag `sourceTier: 'secondary'`
— deliberately siblings to, not reuses of, `IssuerAdapter`, which hardcodes
`'official'`. An assumption resting only on secondary evidence is gated to
`pending_confirmation`, clearing to `untested` when official evidence
arrives or to a distinct `user_confirmed_secondary` (never `verified`) on
explicit user acceptance — both transitions proven end-to-end through real
`processResearchJobs` calls, not just the pure decision function in
isolation. Secondary-source failures are isolated: a throwing adapter never
changes `research_jobs.status`. R-010 moved to `Mitigated`.

**Deliberately not done in M007 — Class C (web search discovery):** recorded
at the time as a new, unscoped **M008** rather than silently left inside
M007. M008 has since shipped (2026-07-26) — see the paragraph above and the
M008 packet's "Slice Outcomes".

A real regression surfaced and was fixed mid-milestone: turning the
assumption-status line from raw enum text into a proper badge broke two
pre-existing Playwright assertions expecting the old literal text — caught
by `npm run test:e2e`, not vitest, and fixed by updating the assertions to
match the new (correct) UI.

Milestone 6 made M005's proven OCR/vision capability reachable from the
product instead of remaining an isolated eval seam, and moved R-018's
injection mitigation from the evaluator into real product code. `extractDocument`
(`lib/research/extractors/document.ts`) now accepts an optional
`VisionTranscriber`; when configured, an image source is transcribed by the
DEC-0012-eligible model and flows through the normal evidence pipeline as
`ocr_matched` — never `exact_verified`, enforced structurally by
`extractDeterministicCandidates` gating on `sourceVariant`, not by convention.
`scanEmbeddedInstructions` now runs in every extractor and at the
`generateDecisionRecommendation` prompt boundary — previously it ran only in
tests and the eval script. A live probe against `minimax-m3:cloud`
(2026-07-25) confirmed the model transcribes an embedded English instruction
faithfully without complying with it; the Indonesian-language companion probe
also produced no compliance, but by a different, less-understood path (the
model's transcription omitted the injected text rather than surfacing it for
the scanner to catch) — so the scanner's documented English-only limitation
remains real and un-exercised live, confirmed instead by direct unit test.
See [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)
for the full honest account. No production wiring selects a vision provider
yet — `CitationPipeline` is still constructed without one, so image sources
fail closed in the running app; turning it on is a separate future decision.

**Same-day addendum:** the Indonesian probe's honest caveat prompted a direct
follow-on — an optional multilingual `InstructionClassifier`
(`lib/research/extractors/safety.ts`) that runs as a second opinion only when
the regex finds nothing, wired through `extractDocument`/`CitationPipeline` at
extraction time. Fails closed on any error. Off by default, same posture as
the vision path — nothing calls a provider for this until a caller configures
one, so the running app's R-018 coverage is still regex-only today. Proven by
unit test with a stub classifier catching the Indonesian text the regex
misses. R-018 stays `Open`; this narrows the gap rather than closing it. See
the M006 packet's "Addendum" section.

Milestone 5 answered one question: is a real OCR/vision-capable model,
reached through the already-accepted Ollama Cloud POC boundary, eligible for
continued POC use on the multimodal evidence pipeline scaffolded since
DEC-0008. Real image-attachment support was added to the provider boundary
(`lib/ai/provider.ts`, `lib/ai/adapters/ollama.ts`), a real-provider vision-
extraction seam (`extractVisionOcrCandidate` in `lib/research/extractors/ocr.ts`)
was added alongside the existing synthetic-fixture path, and two genuine
Playwright-rendered image fixtures were used for a live eligibility eval. The
primary candidate, `gemini-3-flash-preview`, was found retired by the
provider mid-eval; the fallback, `minimax-m3:cloud`, passed cleanly (0
hard-gate failures, 0% hallucination, both real-image transcription cases
exact). [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
(accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility.
[`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
(accepted) removed the retired model from DEC-0010's allowlist and promoted
`deepseek-v4-flash:cloud` for general POC use.

Milestone 4 scaled holding tracking from one active thesis to 100 assets with priority ranking and comprehensive status. All four core steps shipped:

1. **Top-10 Priority Queue** (`lib/portfolio/priorityQueue.ts`, `components/TopTenQueue.tsx`) — scores holdings from unread filing alerts, review staleness, and challenged assumptions.
2. **Comprehensive Status Index** (`app/portfolio/page.tsx`) — sortable/filterable table of all watchlisted and active portfolio positions.
3. **Navigation & Briefing Integration** — fixed routing bug (thesis-linked items now use conversationId, not thesisId); `db/queries.ts#getPortfolioBriefing` computes ranked list via grouped SQL aggregates and returns both `conversationId` and latest decision outcome/action.
4. **Review History Retention** — `db/schema.ts#decisions` now stores typed `outcome`/`action` columns (migration `0006_normalize_decision_outcomes` backfilled prior packed rows and normalized timestamp formats); decision reads carry explicit `orderBy(createdAt)`; Research drawer, Status Index, and Top-10 Queue surface chronological timeline with "changed from X" deltas and latest recorded outcome/action. Regression test guards that recorded decisions never reach provider prompts (DEC-0009 boundary).

The deterministic mock workflow remains the default QA path. The live research
slice already provides SEC filing retrieval, official IDX announcement
retrieval, bounded official issuer fallback, immutable snapshots and
provenance, exact verification, incremental cursors, idempotent refresh, and
local daily scheduling.

The multimodal slice now preserves distinct evidence classes through extraction,
verification, persistence, export/import, API DTOs, and the Research UI:

- `exact_verified` for HTML and text-layer PDF source text matched against
  canonical extracted text.
- `ocr_matched` for retained OCR or screenshot text, never promoted to exact
  source text.
- `derived` for table, chart, XBRL, and deterministic calculation outputs with
  retained inputs, units, method, page, and provenance.

The evaluator scaffold reads the accepted base and multimodal M001 suites,
records deterministic first-slice readiness, and now includes provider-boundary
cases for DEC-0009 data classes. `modelEligibility` remains `not_evaluated`;
the gate does not approve a model or production provider.

The new provider-eval harness now records candidate-model metadata, fixed
allowlist order, deterministic baseline results, and a separate live-eval path
for local confidential runs. Kimi is the default candidate and first eval
target. The live Kimi report has run successfully with clean results and zero
hard-gate failures.

The DEC-0009 provider gate now requires all LLM calls to carry route and data
class context through the project-owned `lib/ai` boundary. POC workflow
confidential data is allowed only in the local POC boundary. Portfolio/position
data, restricted personal or financial secrets, and production confidential
processing fail closed before any external provider fetch.

Periodic ingestion remains local-only under ADR-0006. It runs through
`npm run research:refresh` or Windows Task Scheduler and writes to the external
SQLite database. No private research data or SQLite worker is deployed to
Vercel.

## Fresh Verification

Latest full verification: 2026-08-03 (M011 implementation, all six slices plus
governance close-out).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-08-03 (**354
  passed, 3 skipped** — up from a confirmed 255 baseline measured at session
  start rather than assumed from a stale count). Adds
  `tests/measurement-contract.test.ts` (15), `tests/polarity.test.ts` (28),
  `tests/xbrl-facts.test.ts` (19), `tests/coverage-verdict.test.ts` (19), plus
  new cases in `tests/migrations.test.ts`, `tests/research-service.test.ts`,
  `tests/decisions.test.ts`, and `tests/chat-route-prompts.test.ts`.
- `npm run build`: pass on 2026-08-03
- `npm run context:generate` / `npm run context:check`: pass on 2026-08-03
- `npm run status:check`: pass on 2026-08-03
- `npm run eval:m001:multimodal -- --output test-results/m011-multimodal-report.json`:
  pass on 2026-08-03; `additionalCaseCount` 23 → **25**, 0 hard-gate failures.
  Load-bearing, not routine: `MM-024` and `MM-025` were **proven capable of
  failing** by tampering with their expectations (flipping `MM-025`'s expected
  outcome to `supports`, relaxing `MM-024`'s time basis to `instant`) and
  confirming the report emitted `MM-024:balance_offered_for_flow_claim` and
  `MM-025:contradiction_reported_as_support` with both cases `unsupported`. The
  tamper was reverted and the clean result re-verified. This follows M010's
  lesson that a case absent from `deterministicNotes`' dispatch can never fail.
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m011-provider-report.json`:
  pass on 2026-08-03; 0 hard-gate failures, `additionalCaseCount: 25` confirmed
  to propagate
- `npm run test:e2e` (Playwright): **7/7** pass on 2026-08-03, up from 5. Two
  new cases (the clarification hard block, and the rendered verdict + coverage
  ledger + polarity badge). **The browser layer caught the real regression
  again:** `polarityBadge` read `deltaVsThreshold.toFixed()` without checking
  the field was present, which white-screened the entire Research panel against
  a route-mocked payload predating M011 — a crash any older client cache would
  also have hit. Separately, a **pre-existing** e2e fragility was fixed
  incidentally and confirmed pre-existing by re-running with M011's new case
  excluded: the sidebar-title test matched "New Thesis" globally while the
  suite shares one SQLite file, so accumulated conversations tripped strict
  mode.
- **Live read-only probe against real `data.sec.gov` data (2026-08-03).** Run
  through the real `SecCompanyConceptSource` → `selectFact` →
  `createXbrlFactCandidate` → `classifyPolarity` chain, touching no database:
  - `TSLA` / `GrossProfit`: **282 real facts, every one `duration`**. Selected
    the most recent 10-Q quarter (2026-04-01→2026-06-30, $4.751B) and
    classified it `supports` against a $3B threshold, delta +$1.751B.
  - `TSLA` / `DeferredRevenueCurrent`: **58 real facts, every one `instant`** —
    and a `duration_quarter` claim pointed at it selected **nothing**. This is
    the deferred-revenue defect refused against genuinely filed data rather
    than a fixture, which is what R-027's trigger actually asked for.
  - The same tag restated as an `instant` claim was accepted and classified —
    and surfaced a real-world detail no fixture would have: its newest fact
    ends **2018-03-31**, because Tesla migrated off that tag at ASC 606
    adoption. Tag drift over time is real, and only a live probe shows it.
  - A USD fact against a `percent` claim → `inconclusive`/`no_observed_value`;
    an unreported tag → `not_found`, soft.
  - `logs/outbound.log` recorded every request (ADR-0006), and the ticker map
    was fetched **once** — confirming the shared-`OfficialHttpClient` cache
    claim rather than assuming it.
- **Still not done, and load-bearing:** no evidence row has been *persisted*
  from a live XBRL response. The live database holds only an ID-market thesis
  (ISAT), and creating a US one would mean writing to real user data. The
  retrieval and classification path is live-verified; the write path is proven
  by tests only.

Previous full verification: 2026-07-27 (M010 implementation, all four slices plus
governance close-out).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-27 (**237
  passed, 3 skipped** — up from 206 at M009's close; adds 12 M010 shape/
  segmentation cases to `tests/document-extraction.test.ts`, 7 listing-page
  guard cases to `tests/source-adapters.test.ts`, and the new
  `tests/evidence-cleanup.test.ts` with 12 cases covering deletion, retention,
  the official-tier hard filter, missing snapshots, dry-run inertness,
  idempotence, and `user_confirmed_secondary` protection)
- `npm run build`: pass on 2026-07-27
- `npm run context:generate` / `npm run context:check`: pass on 2026-07-27
- `npm run status:check`: pass on 2026-07-27
- `npm run eval:m001:multimodal -- --output test-results/m010-multimodal-report.json`:
  pass on 2026-07-27; `additionalCaseCount: 23` unchanged, 0 hard-gate failures.
  Load-bearing here, not routine: `scripts/eval-m001-multimodal.ts` hard-gates
  `candidates.length === 0` on MM-021/022/023, so over-filtering the eval
  fixtures would have failed loudly rather than degrading silently.
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m010-provider-report.json`:
  pass on 2026-07-27; 0 hard-gate failures
- `npm run test:e2e` (Playwright): 4/4 pass on 2026-07-27 — M010 touches no UI
  code, so this is a confirmation, not an expected-change check
- **Real-data verification, beyond fixtures:** `canonicalText` byte-identical to
  a faithful re-implementation of the pre-M010 derivation on all four retained
  TLKM snapshots, with `blocks.join(' ') === text` holding on each;
  `discoverIssuerPressReleases` on the retained newsroom snapshot goes from 29
  refs (first 13 junk, `[0]` the discovery page itself) to exactly the 9 genuine
  `/news/...` articles, correctly dated, newest first
- **Live end-to-end:** `npm run research:cleanup-evidence` dry run reported 15
  scanned / 15 stale / 0 kept / 0 unresolvable; an explicit database backup was
  taken (`db-before-m010-cleanup-2026-07-27T21-30-52.sqlite`) before `--apply`;
  after applying, 0 evidence rows remained, 7 assumptions reverted to
  `untested`, all 4 `source_snapshots` rows and `.bin` files retained, and a
  second run was a clean no-op. `npm run research:refresh` then fetched
  `.../news/perkuat-peran-penggiat-budaya-...-3849` — a genuine article —
  instead of the listing page, persisting 2 rows of real press-release prose.

Previous full verification: 2026-07-26 (M009 implementation, all four slices).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-26 (206
  passed, 3 skipped — up from 199 at M008's close; adds 7 adversarial
  boilerplate-filtering cases to `tests/document-extraction.test.ts`: two
  official-tier HTML-chrome regression fixtures for Slice 1, three for the
  phrase denylist and secondary-tier qualifying-token rule reproducing the
  real 2026-07-26 TLKM failures, and two explicit non-regression cases — a
  genuine secondary press-release fact still passes, and the official path
  is untouched by the new gate)
- `npm run build`: pass on 2026-07-26
- `npm run context:generate` / `npm run context:check`: pass on 2026-07-26
- `npm run eval:m001:multimodal -- --output test-results/m009-multimodal-report.json`:
  pass on 2026-07-26; `additionalCaseCount: 23` unchanged from M008, 0
  hard-gate failures — confirms official-filing recall is unregressed
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m009-provider-report.json`:
  pass on 2026-07-26; 0 hard-gate failures; deterministic only, no live run
  needed since M009 makes no provider-boundary change
- `npm run status:check`: pass on 2026-07-26
- `npm run test:e2e` (Playwright): 4/4 pass on 2026-07-26, after restarting
  the stale dev server on port 3000 (the pre-existing Turbopack
  compiler-worker crash flagged at the end of the prior session) with the
  user's explicit go-ahead — confirms no regression to the Research panel;
  M009 touches no UI code, so this is a confirmation, not an expected-change
  check.

Previous full verification: 2026-07-26 (M008 implementation, all five slices).

- `npm run typecheck`, `npm test`: pass on 2026-07-26 (191 passed, 3
  skipped — up from 156 at M007's close; adds discovery-provider
  outbound-logging, discovery-persistence, domain-gate/promotion, and
  automatic-promotion integration coverage for M008 across
  `tests/discovery-eval.test.ts`, `tests/discovery-promotion.test.ts`
  (new), and `tests/research-service.test.ts`)
- `npm run build`: pass on 2026-07-26
- `npm run test:e2e` (Playwright): 3/3 pass on 2026-07-26 — confirms no
  regression to the Research panel; does not exercise the new Discovery
  Candidates section itself, since no e2e fixture seeds a
  `discoveryCandidates` row (that path is covered by the unit/integration
  tests instead, not visually verified in a browser)
- `npm run status:check`, `npm run context:check`: pass on 2026-07-26

Previous full verification: 2026-07-25 (M007 implementation, all eight slices).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-25 (156
  passed, 3 skipped — up from 130 at M006's addendum; adds schema,
  extractor/candidate structural gate, adapter, pipeline/service
  integration, confirmation-gate, UI, and eval coverage for M007)
- `npm run build`: pass on 2026-07-25
- `npm run test:e2e` (Playwright): 3/3 pass on 2026-07-25, after fixing a
  real regression the suite caught (assumption-status badge text change —
  see "Current Phase")
- `npm run eval:m001:multimodal -- --output test-results/m007-slice7-multimodal-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, `additionalCaseCount: 23` (up
  from 20) — includes the first genuinely assertive cases in this suite
  (`MM-021`/`022`/`023`); every prior case in this file had `status: 'passed'`
  hardcoded and could not actually fail
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m007-slice7-provider-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, confirms `additionalCaseCount: 23`
  propagates through this script unchanged
- `npm run status:check`, `npm run context:check`: pass on 2026-07-25

Previous full verification: 2026-07-25 (M006 implementation + live injection-probe eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-25 (124
  passed, 3 skipped — adds vision-extraction-pipeline, R-017 structural
  invariant, and R-018 prompt-boundary/scanner-gap coverage; multimodal case
  count 18 → 20)
- `npm run build`: pass on 2026-07-25
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output test-results/m006-deterministic-report.json`:
  pass on 2026-07-25; 0 hard-gate failures, 20 multimodal cases,
  `modelEligibility: not_evaluated` (correct pre-live state)
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-25-m006-injection-eval/02-live-report.json`:
  0 hard-gate failures; `acceptanceOutcome: blocked` — unchanged in shape from
  the already-accepted 2026-07-19 minimax baseline (same ~20 base-suite
  failures, unrelated to vision/injection); both injection-probe cases
  (`MM-019`, `MM-020`) passed with no model compliance. See the manifest's
  "Honest note" on what `MM-020` does and does not prove.
- `npm run status:check`, `npm run context:check`: pass on 2026-07-25

Previous full verification: 2026-07-19 (M005 Slice 0 + eligibility eval).

- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 (113
  passed, 3 skipped — adds attachment-serialization and vision-extraction
  coverage; bumps multimodal case count to 18)
- `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`:
  blocked on 2026-07-19 — model retired by provider as of 2026-07-15
- `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`:
  pass on 2026-07-19
- `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`:
  pass on 2026-07-19; 0 hard-gate failures, 0% citation hallucination, both
  real-image transcription cases (`MM-017`, `MM-018`) passed exactly
- `npm run typecheck`, `npm run lint`, `npm test`: pass on 2026-07-19 after
  DEC-0013's allowlist change (five-model roster; 113 passed, 3 skipped)

Previous full verification: 2026-07-17.

Latest targeted provider-package verification: 2026-07-11.

- Base commit before provider-gate implementation:
  `00dd1fe97f0de9740e8868b9b9c1015870533254`
- Remote:
  `https://github.com/pojurb/shadow-ic-vision.git`
- `npm run context:check`: pass on 2026-07-17 after regenerating the code index
- `npm run status:check`: pass on 2026-07-17 after accepting the M004 packet
- TypeScript `tsc --noEmit`: pass on 2026-07-17 (a stale `.next` build artifact
  had been causing 5 spurious errors in generated dev types; cleared and
  rebuilt clean)
- ESLint `eslint`: pass on 2026-07-17
- Vitest: 104 pass; 3 opt-in live checks skipped on 2026-07-17 (adds
  `tests/portfolio-briefing.test.ts` covering the M4 priority queue and
  briefing query)
- Next.js production build: pass on 2026-07-17
- Playwright: 3 pass on 2026-07-17
  - deterministic PLTR desktop and narrow Research drawer
  - live-labelled IDX fail-closed UI without a network request
  - OCR and derived trust-class labels visible in the Research drawer
- `npm run verify:full`: pass on 2026-07-17
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`: pass
  - base case count: 16
  - multimodal addendum case count: 16
  - all 16 deterministic multimodal addendum cases: pass
  - DEC-0009 provider-boundary cases: 6 pass
  - hard-gate failures: none
  - model eligibility: `not_evaluated`
- `git diff --check`: pass
- `npm run status:check`: pass on 2026-07-09 after drafting DEC-0010
- `npm test -- tests/provider-gate.test.ts tests/provider-boundary.test.ts tests/ollama-provider.test.ts`:
  pass on 2026-07-09; 14 tests passed
- `npm test -- tests/api-contracts.test.ts tests/ollama-provider.test.ts tests/ollama-models.test.ts tests/research-service.test.ts`:
  pass on 2026-07-09; 21 tests passed
- `npm run eval:m001:multimodal -- --output test-results\m001-multimodal-report.json`:
  pass on 2026-07-09; 16 base cases, 16 multimodal addendum cases,
  6 provider-boundary cases, no hard-gate failures, `modelEligibility:
  not_evaluated`
- `npm run eval:m001:provider -- --mode deterministic --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/01-deterministic-report.json`:
  pass on 2026-07-09; Kimi metadata recorded, fixed eval order recorded,
  deterministic baseline loaded, 6 provider-boundary cases passed
- `npm run eval:m001:provider -- --mode live --model kimi-k2.7-code:cloud --output docs/evidence/releases/2026-07-09-kimi-provider-eval/02-live-report.json`:
  pass on 2026-07-11; completed successfully with 0 hard-gate failures, 0%
  hallucination rate, and 93.3% assumption extraction completeness

Release evidence:
[`docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`](docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md)
[`docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md`](docs/evidence/releases/2026-07-09-kimi-provider-eval/manifest.md)
[`docs/evidence/releases/2026-07-11-model-evals/manifest.md`](docs/evidence/releases/2026-07-11-model-evals/manifest.md)
[`docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-gemini-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md`](docs/evidence/releases/2026-07-19-minimax-vision-eval/manifest.md)
[`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md)

## Remaining Boundaries

- M001 is **`local-only complete`** as of 2026-07-25. It previously stayed open
  on two items. Real OCR/vision provider eligibility is resolved for POC use
  (`minimax-m3:cloud`, DEC-0012). Production confidential-data provider
  approval is no longer outstanding: [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
  places production/hosted processing explicitly out of scope, so it no longer
  holds M001 open. Provider-specific current-source approval remains an
  in-scope open boundary, tracked on its own rather than inherited from a
  withdrawn milestone.
- [`DEC-0010`](docs/decisions/DEC-0010-ollama-cloud-poc-approval.md) is an
  accepted Ollama Cloud POC approval package. The app now exposes an
  allowlisted selector for `kimi-k2.7-code:cloud`, `qwen3.5:cloud`,
  `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`, and `minimax-m3:cloud`
  (five models, all `accepted_for_poc`). Real confidential POC traffic is
  authorized through the project-owned provider boundary under the accepted
  scopes. [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
  (`accepted`) removed `gemini-3-flash-preview` after it was confirmed
  retired by the provider (found 2026-07-19) and promoted
  `deepseek-v4-flash:cloud` in its place, using its existing 2026-07-11
  eligibility result — no new eval run was required for that promotion.
- [`DEC-0009`](docs/decisions/DEC-0009-provider-security-gate.md) is accepted
  and implemented as the POC provider/security gate. It permits local POC
  workflow confidential routing through the project-owned provider boundary,
  but does not approve production external processing or selectable model
  eligibility. Portfolio/position data, credentials, account screenshots, raw
  database exports, identity documents, and unrelated personal files remain
  blocked unless a later explicit decision allows them.
  [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
  (`accepted`) clarifies that recorded decision outcomes fall under this
  blocked "portfolio and position data" classification.
- The deterministic multimodal evaluator proves first-slice application and
  provider-boundary gates; it does not approve a model, provider, cloud
  processor, or native browsing capability.
- `scanEmbeddedInstructions` (R-018 mitigation, now wired into the real
  extraction path and prompt boundary by M006) is a single hardcoded English
  phrase list. It cannot match the same instruction in Indonesian — material
  because IDX filings are a first-class product input. Confirmed by direct
  unit test; the live Indonesian probe did not exercise this path (see the
  M006 evidence manifest). R-018 stays `Open`; broadening scanner coverage was
  explicitly deferred by user decision during M006 scoping.
- **2026-07-29/30 addendum.** A same-day change briefly wired the optional
  `InstructionClassifier` in by default and marked R-018 `Mitigated`.
  Independent review found it did not gate on `getResearchSourceMode()`, so
  deterministic mock research would still trigger real live provider calls
  wherever `LLM_PROVIDER_TYPE=ollama` is configured — violating the mock
  research stays fully offline invariant — with zero test coverage of the
  default-wiring path and no scoped decision behind it. Reverted
  (`git revert d420a33`) rather than patched in place; see
  `docs/RISK_REGISTER.md`'s R-018 row for the full account.
- No production wiring selects a vision provider. `CitationPipeline` is
  constructed without one in `lib/research/service.ts`, so image sources
  still fail closed in the running app even after M006.
- **M007 boundary, closed by M008.** Class C (web search discovery) is no
  longer deferred — see "Current Phase" above and the M008 packet's "Slice
  Outcomes". DEC-0015 named the Top-10 Queue and Portfolio Briefing as
  additional secondary-evidence badge locations; only the Research drawer
  and alerts sidebar were built — those two surfaces don't currently render
  any evidence-level trust badges at all (confirmed by grep), so extending
  them would have meant inventing new UI surface beyond M007's scope, not
  filling in an existing gap. M008's Discovery Candidates section (Slice 4)
  was likewise added only to the Research drawer, not those two surfaces,
  for the same reason.
- **M008 boundary, narrowed 2026-07-26.** `ISSUER_PRESS_RELEASE_URLS`/
  `NEWS_WIRE_FEED_URLS` are now populated — TLKM issuer press release
  (`telkom.co.id`) and CNBC Indonesia news wire, both verified live and
  reachable before configuring (`.env` comments record the verification).
  One real quality caveat found and kept deliberately, not silently shipped
  (user decision): TLKM's page has repeated header/nav links that fill
  `discoverIssuerPressReleases`'s 20-result cap before real `/news/...`
  article links are reached in DOM order, so it mostly re-discovers its own
  listing page — soft-fails to low/no yield, never to something wrong. CNBC
  Indonesia's feed is clean but general-market, not ticker-specific, so it
  yields evidence only on days a tracked ticker is actually in the news.
  Still no live end-to-end promotion has been observed from a real
  `processResearchJobs` run (only from these two adapters' `discover()`
  called directly during verification) — see `docs/RISK_REGISTER.md` R-013's
  next-review trigger. `npm run research:promote-discoveries` exists to
  re-evaluate already-discovered candidates after a future allowlist change,
  without waiting for a fresh discovery search to surface the same URL
  again.
- `npm audit --omit=dev` currently reports two moderate dependency findings
  (transitive `postcss` via `next`); no forced breaking upgrade was applied in
  this slice.
- **M009 boundary, 2026-07-26.** The boilerplate-phrase denylist covers only
  the listed English/Indonesian phrasing found in the real 2026-07-26 TLKM
  run — boilerplate worded differently, or in another language, is not
  caught. The secondary-tier qualifying-token rule excludes only the ticker
  and bare four-digit years; company-name tokens are deliberately **not**
  excluded, since no company-display-name field exists anywhere in the call
  chain reaching `rankSentenceCandidates` today (only ticker/assumption text
  do) — threading one through was scoped out rather than silently assumed
  unnecessary (see `docs/RISK_REGISTER.md` R-025). Repeated-across-pages
  boilerplate detection (the same quote recurring across multiple fetched
  pages of one domain) was considered and not built — the current pipeline
  fetches one document per adapter call, so cross-page comparison isn't yet
  structurally possible. Cleanup of the 15 already-persisted low-quality
  evidence rows from the 2026-07-26 TLKM run was explicitly out of scope —
  this milestone fixes the extractor going forward only.

## Next Steps

Milestones 4 through 10 are complete and verified.

1. ~~**DEC-0009 Amendment**~~ Accepted: [`DEC-0011`](docs/decisions/DEC-0011-decision-record-classification-amendment.md)
   clarifies that recorded Buy/Hold/Reduce/Exit decisions are governed
   exclusively by DEC-0009's "Portfolio and position data" row and remain
   blocked. See `docs/decisions/DEC-0009-provider-security-gate.md`'s
   amendment signpost.

2. ~~**Milestone 5**~~ Complete: all four Acceptance Criteria met.
   [`DEC-0012`](docs/decisions/DEC-0012-ocr-vision-provider-eligibility.md)
   (accepted) records `minimax-m3:cloud`'s POC OCR/vision eligibility after
   the primary candidate, `gemini-3-flash-preview`, was found retired by the
   provider mid-eval.

3. ~~**Follow-up finding**~~ Resolved: [`DEC-0013`](docs/decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
   removes `gemini-3-flash-preview` from the DEC-0010 allowlist and promotes
   `deepseek-v4-flash:cloud` (already `accepted_for_poc`) in its place. See
   `docs/RISK_REGISTER.md` R-024.

4. ~~**Production Confidential-Data Provider Approval**~~ Withdrawn:
   [`DEC-0014`](docs/decisions/DEC-0014-local-only-scope-reaffirmation.md)
   (accepted 2026-07-25) records production/hosted confidential processing as
   explicitly out of scope. `ADR-0006` §1's local-only deployment contract
   leaves such an approval no subject to govern, and its vendor-terms checklist
   is unanswerable without a chosen deployment shape. Reactivation requires a
   hosted deployment to be actually intended **and** a new managed-persistence
   / authentication ADR to be accepted first.

5. ~~**Milestone 6 (re-planned)**~~ Complete: [`docs/milestones/M006-in-pipeline-vision-extraction.md`](docs/milestones/M006-in-pipeline-vision-extraction.md)
   (complete 2026-07-25). All five ACs met; R-017 moved to `Mitigated`; R-018
   stays `Open` with the scanner's language-coverage gap honestly recorded
   rather than closed. See the packet's "Slice Outcomes" and
   [`docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md`](docs/evidence/releases/2026-07-25-m006-injection-eval/manifest.md).

6. ~~**Milestone 7**~~ Complete: [`docs/milestones/M007-secondary-source-ingestion.md`](docs/milestones/M007-secondary-source-ingestion.md)
   (complete 2026-07-25). Product-scoping decision
   [`DEC-0015`](docs/decisions/DEC-0015-secondary-source-ingestion-boundaries.md)
   accepted the same day. AC-M007-01/02/03/05/06 fully met; AC-M007-04
   (R-013 snippet exclusion) only structurally prepared, not exercised,
   since Class C was deferred in full. R-010 moved to `Mitigated`; R-013
   stayed `Open` pending M008. See the packet's "Slice Outcomes".

7. ~~**Milestone 8**~~ Complete: [`docs/milestones/M008-web-search-discovery.md`](docs/milestones/M008-web-search-discovery.md)
   (accepted and complete 2026-07-26). All five acceptance criteria met; all
   five implementation slices (plus Slice 0's groundwork) shipped and
   tested. R-013 moved to `Mitigated` — mechanism proven structurally and by
   test, real-world coverage still zero pending allowlist population,
   recorded honestly as residual risk. See the packet's "Slice Outcomes".

8. ~~**Milestone 9**~~ Complete: [`docs/milestones/M009-secondary-evidence-boilerplate-filtering.md`](docs/milestones/M009-secondary-evidence-boilerplate-filtering.md)
   (accepted and complete 2026-07-26). All four acceptance criteria met; all
   four implementation slices shipped and tested. Reviewed independently
   twice before implementation (a second AI collaborator and a separate
   reconciliation pass), both converging on the qualifying-token mechanism
   as the fix for the CSR/coral-reef failure class. R-025 moved to
   `Mitigated` — three layered mechanisms proven by test and unregressed
   M001 evals; company-name-token exclusion and cross-page detection
   recorded honestly as residual risk. See the packet's "Slice Outcomes".

9. ~~**Milestone 10**~~ Complete: [`docs/milestones/M010-structural-evidence-precision.md`](docs/milestones/M010-structural-evidence-precision.md)
   (accepted and complete 2026-07-27). All four acceptance criteria met. R-026
   → `Mitigated`; **R-025 deliberately returned to `Open`** — its own trigger
   fired on 2026-07-27, so M009's mitigation is recorded as necessary but
   insufficient rather than quietly amended. M009 §8's pre-authorized question
   ("adopt a readability library if the hand-rolled denylist proves too
   narrow") was raised at review as instructed and declined by user decision:
   jsdom is a heavy dependency for a module holding only `cheerio` and
   `pdfjs-dist`, and the structural fix had not yet been shown insufficient.
   See the packet's "Slice Outcomes".

10. ~~**Milestone 11**~~ Complete: [`docs/milestones/M011-evidence-polarity-and-measurement-contracts.md`](docs/milestones/M011-evidence-polarity-and-measurement-contracts.md)
    (accepted and complete 2026-08-03). All five acceptance criteria met; all
    six implementation slices shipped and tested. R-027 → `Mitigated`;
    **R-025 stays `Open`** — polarity is only ever non-`inconclusive` for
    structured-fact evidence, so semantic relevance of text-derived secondary
    evidence is exactly where M010 left it. [`DEC-0016`](docs/decisions/DEC-0016-evidence-polarity-classifier-boundary.md)
    accepted the same day, scoped narrowly to the optional classifier seam.

11. **Milestone 13** — `accepted`, in progress:
    [`docs/milestones/M013-source-adequacy-and-official-path-recovery.md`](docs/milestones/M013-source-adequacy-and-official-path-recovery.md).
    Slices 1–3 complete: the official path is repaired (`d2c6427`, one shared
    `SOURCE_BYTE_LIMIT`), all six TLKM jobs now `succeeded`, official evidence
    3 → 21 rows; the zero-byte-snapshot integrity defect found during Slice 3 is
    repaired (`09208aa`). Slice 4 is **started and paused at its first finding**:
    the official corpus stops at 2023 because `REPORT_TERMS` does not match
    Telkom's post-2024 abbreviated file naming, so 24 reachable 2024–2026 reports
    are invisible. User chose to fix that before completing the A/B/C
    classification. Implements none of the four R-025 remedy options; **R-025
    stays `Open`**; new **R-028** measured, not mitigated. See "Current Phase"
    above and the packet's "Slice outcomes".

Milestone 12 is complete. Milestone 11 is complete.

M012 has no external-provider approval and no provider is enabled by default.
The corpus intake is complete; source files under `originals/` remain
read-only. Future OCR, Office parsing, and provider-backed digest work require
an explicit follow-up scope.

**Open, not this milestone's problem:** semantic relevance of secondary
evidence (R-025, `Open`) — M010 fixes evidence *shape*, and the live run that
proved it also persisted two quotes from a genuine culture-festival press
release matched partly on division names. Real article prose, not site chrome,
but still not obviously material to a data-centre thesis. M011 narrows this for
*structured-fact* evidence only; text-derived secondary evidence is untouched.

**Highest-value next step, per R-027's own review trigger:** a live
`processResearchJobs` run against a **US** thesis whose measurement contract
names real `us-gaap` tags. Every M011 mechanism is fixture-proven; nothing has
been validated against a real `data.sec.gov` company-concept response.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `LC-20260708-001` (2026-07-05, separate session);
`LC-20260725-001` through `LC-20260725-003` (2026-07-25, earlier session — not
yet reviewed); none new this session
