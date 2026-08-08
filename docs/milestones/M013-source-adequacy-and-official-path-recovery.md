# M013: Source Adequacy & Official-Path Recovery

Status: `scoped` — awaiting user acceptance

Date drafted: 2026-08-08

Date accepted: pending

Date completed: pending

Approval authority: user

Depends on: completed M011 (measurement contracts, coverage ledger,
deterministic verdict), [`DEC-0018`](../decisions/DEC-0018-verdict-positive-state-conditions.md)
(the verdict's positive state requires actual support), and the containment
shipped in `6fa90d7` (secondary-evidence acceptance withheld while relevance is
unassessed).

**No new decision record is required.** This packet adds no provider, model,
data class, trust tier, or product boundary — it repairs an existing retrieval
path and produces written findings. It clears the same bar M009 and M010
cleared. If Slice 2's diagnosis turns out to require a new capability (for
example, a different extraction strategy for large documents), that becomes its
own decision, raised at review rather than assumed here.

## Slice outcomes — 2026-08-08 (Slices 1–3; Slices 4–5 not started)

Every figure below was read directly from `d:/jp-invest-data/db.sqlite` or
measured by running the real code against the real retained documents. A
database backup was taken before the Slice 3 re-run:
`db-before-m013-slice3-20260808T114512.sqlite`.

### Slice 1 — diagnosis

**Two size limits disagreed.** Download allowed 25 MB
(`lib/research/http.ts`); extraction refused anything past 10 MB
(`lib/research/extractors/document.ts`). Documents between the two were
fetched, hashed, written to the snapshot store, and then refused unread —
a 24.3 MB annual report and a 10.5 MB climate report, the latter missing the
old ceiling by 0.5 MB.

Two things kept this hidden for days, and both are worth remembering:

- **The reported reason was wrong.** Jobs read *"exceeds the 25 MB M001
  limit"* while the document was 24.3 MB — under that limit. The text was
  hardcoded in the download path and went on being emitted after a different
  check did the rejecting.
- **The failure path did not log.** Both size rejections threw without calling
  `this.log`, while every neighbouring rejection path logged first. So
  `logs/outbound.log` showed nothing at all, and that silence actively misled
  this milestone's own diagnosis — the log looked clean while six jobs failed.

### Slice 2 — repair, and what it measured

One `SOURCE_BYTE_LIMIT` in `lib/research/adapters/types.ts`, read by the
download path, the extraction path, and both issuer clients. Value 500 MB, the
user's calibration decision. Messages now state measured size against the
active limit; both rejections log. Committed as `d2c6427`; five tests proven to
fail first, suite 389 → 392.

Measured by running the real extraction path over the retained snapshots:

| Document | Size | Time | Peak RSS | Result |
|---|---|---|---|---|
| Laporan Tahunan Telkom 2023 | 24.3 MB | 8.5 s | ~790 MB | 521 pages, 1,224,092 chars |
| Laporan Risiko Iklim | 10.5 MB | 0.5 s | ~817 MB | 41 pages, **110 chars** |

**The climate report is not empty, and pdfjs is not at fault.** Its metadata
reads `Producer: Microsoft® PowerPoint®`, `Title: LAPORAN RISIKO IKLIM 2023`,
with **zero embedded fonts** — every slide was flattened to raster on export.
Page 12 alone holds 201 image objects; extracting one and viewing it shows
legible text (*"PT Telkom Indonesia (Persero) Tbk"*). The content is fully
present as pixels. It needs OCR, and the `VisionTranscriber` path (DEC-0012
eligible) is still not wired into `CitationPipeline`.

**This document is therefore class (B), not (C)** — it exists and is readable,
with a named, known blocker. Recorded here so Slice 4 does not re-derive it.
Note it is a *climate risk* report and one assumption concerns firm PLN power;
whether it actually carries that figure is a Slice 4 question, not an
assumption to make here.

### Slice 3 — re-run and record

| | Before | After |
|---|---|---|
| Jobs | 6 `degraded/source_too_large` | **6 `succeeded`** |
| Evidence, official (`exact_verified`) | 3 | **21** |
| Evidence, secondary | 48 | 48 |
| Assumption status | 5 `pending_confirmation`, 1 `untested` | **6 `untested`** |
| Polarity | 51 all `inconclusive` | 69 all `inconclusive` |
| Verdict | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE`, 0 of 6 supported |

**No flood.** 18 new rows, not hundreds — the ranker's per-assumption limit
bounds yield regardless of document length. The volume fear behind Q4 did not
materialise at this corpus size.

**The verdict held.** `DEC-0018` kept the system from claiming support it does
not have, and the headline states the real situation: quotes verified verbatim,
relevance unchecked.

### Four findings from Slice 3, for discussion after Slice 4

**1. The document that motivated the fix still contributes nothing.** The 18
new rows come from six *newly discovered* documents — Laporan Tahunan 2021 and
2022, Laporan Keberlanjutan 2021 and 2022, and two 2021 quarterly financial
statements. The 24.3 MB Laporan Tahunan 2023 was **not re-processed**: its only
`research_job_sources` row is dated `2026-08-05`, before the fix, and
`knownDocumentIds` (ticker-scoped — a defect already on the open list) skips a
document once seen. The limit is genuinely repaired, proven by direct
extraction; a *different* known defect now stands between it and the corpus.
The six documents that did contribute are all 2021–2022 vintage.

**2. R-025 applies at the official tier just as badly.** The 88.9% audit was
measured on secondary evidence; official is no better. Of 21 official rows, at
most one is plausibly relevant — p106, *"Telkom bersaing dengan beberapa
perusahaan yang turut mendirikan data center di Jakarta, Surabaya…"* against
the market-share assumption. The rest include a **glossary page** and a
**disclosure-criteria index table**. The NeutraDC ownership claim drew
generic governance prose and loan-covenant terms; the strategic-investor claim
drew a 2021 data-privacy case and **COVID-19 vaccine distribution**; the
hyperscaler claim drew a **2008 2G/3G network procurement agreement**; the PLN
power claim drew post-employment health benefits. Fixing supply did not fix
relevance, and now there is measured evidence that they are independent
problems at both tiers.

**3. A regression in honesty, caused by success.** Assumption status moved from
five `pending_confirmation` to six `untested`. That is M007 behaving as
designed — an assumption resting only on secondary evidence is gated, and the
gate clears when official evidence arrives. But the official evidence that
cleared it is as irrelevant as the secondary evidence it replaced. The signal
*"this rests only on secondary sources"* is now gone, and the acceptance
containment shipped in `6fa90d7` is moot because nothing is
`pending_confirmation` any more. The gate keyed on **tier**, which was a proxy
for trust; the thing it was proxying for was **relevance**, which nothing
measures.

**4. Retained snapshots for successfully-extracted PDFs are zero bytes.**
Seven of fifteen files in the snapshot store are empty; six were created by
this Slice 3 run. Cause proven directly rather than inferred: `pdfjs.getDocument`
**transfers and detaches** the source ArrayBuffer — measured on a real file,
`byteLength` 10,972,090 → **0** after the call. `pipeline.ts` hashes the bytes
(line 112) and extracts (line 115), then `service.ts` calls
`persistSourceSnapshot` afterwards, and `snapshot-store.ts:31` writes the
now-detached buffer.

The correlation is exact and is what confirms it: every PDF that extracted
successfully is 0 bytes; the two PDFs rejected for size — pdfjs never touched
them — are intact at 24.3 MB and 10.5 MB; HTML snapshots are unaffected because
cheerio does not detach.

This is the most serious defect this milestone has surfaced, because it is not
about relevance at all. Evidence is stored `exact_verified` while its retained
source artifact is empty, so those quotes **cannot be re-verified against their
source**, and `document_hash` records a hash the stored file does not have. It
also endangers the M010 cleanup precedent, which re-derives from snapshots to
decide staleness: run against an empty snapshot it would find no quote and
could delete valid evidence. Nothing is permanently lost — the documents are
re-fetchable — but the provenance guarantee is currently not being kept.

**Repaired 2026-08-08, before Slice 4 resumed** — user decision, on the ground
that it was corrupting data on a daily schedule while Slice 4 writes no evidence
at all. Two changes, each proven fail-then-pass:

- `extractPdf` hands pdfjs a copy rather than the caller's buffer. The
  regression test asserts the invariant persistence depends on — *the caller
  still owns `rawBytes` after extraction returns* — rather than the shape of the
  fix, so it keeps holding if extraction is rewritten. It failed at 604 → 0
  before the change.
- `persistSourceSnapshot` treats a zero-byte file as a failed write rather than
  a stored document. Without this the seven already-empty files could never be
  replaced: the guard read "already stored" from mere existence, making the
  damage permanent. Storage is content-addressed, so an empty file at a
  hash-named path cannot be a legitimate version of it; a retained non-empty
  snapshot is still never overwritten, which has its own test.

Verified on live data: a subsequent `research:refresh` fetched six issuer
documents (annual reports 2019–2021, three quarterly statements) and all six
wrote intact at 1.4–7.3 MB. `tests/snapshot-store.test.ts` is new; the module
had no coverage.

**Still outstanding:** 21 of 85 evidence rows point at empty source files, since
those documents have not been re-fetched. Quote text is intact and displays
normally; only re-verification is lost. The self-healing guard means a re-fetch
repairs them, but whether to re-fetch, leave as recorded debt, or delete is a
user decision. Most of the 21 are the irrelevant passages R-025 describes, so
the practical loss is small — the broken guarantee is the cost, not the data.

A second, unrelated observation surfaced while verifying: snapshots live under
**two** directories — `D:\jp-invest-data\snapshots\` (the seven empty legacy
files) and `D:\jp-invest-data\source-snapshots\` (where writes go now, per
`SOURCE_SNAPSHOT_DIR`). Not investigated; recorded so it is not mistaken for
part of this defect.

## 0. Why this packet exists, and why it is not a relevance milestone

Three days of analysis — two independent AI reviewers working from different
directions, both grounded in `VISION.md` — converged on a diagnosis of R-025:
the system conflates *passage found*, *passage worth reviewing*, and *evidence
judged relevant*, and gives the user no way to correct or measure that mixture.
That diagnosis is sound and is recorded in this repository's history.

A source-corpus inspection performed after that convergence found something
neither review had tested, and it changes the sequencing rather than the
diagnosis:

- **Every official-source job for the live TLKM thesis fails.** All six
  assumptions sit at `degraded` / `source_too_large` after 8–9 attempts. The
  financial statements have never once been read.
- **The corpus that filled the gap is almost entirely unrelated to the thesis.**
  Of 51 persisted evidence rows: ~25 from daily market-wire round-ups (index
  moves, foreign net-sell figures), ~13 from CSR and education press releases
  (student programmes, village development, a 61st-anniversary item), and the
  only document classified `Issuer official` is a **sustainability report**, not
  a financial statement.
- **Several assumptions may have no public source at all.** Three of six ask for
  figures issuers do not customarily disclose: competitor-set MW market share,
  hyperscaler contracted/MoU MW, and firm PLN power MW.

The consequence is a sequencing constraint, not a change of direction. Building
a relevance-review loop on top of this corpus would mean the user's first real
session is labelling ~45 market-wire and CSR passages as irrelevant, one at a
time — against a corpus that is about to change completely the moment the
official path is repaired. Any volume or ranking calibration made now would be
calibrated against something that will not survive this packet.

**So this packet does not choose the R-025 remedy. It produces the two inputs
that any honest choice of remedy requires**, and it says plainly which questions
remain open until it is finished.

## 1. Outcome

The official-source path retrieves and extracts at least one real financial
document for the live TLKM thesis, and every TLKM assumption carries a
**recorded, evidenced judgment** about whether any reachable public source could
ever settle it.

After this packet, the scope of the relevance work is decidable from findings
rather than from argument.

## 2. The six questions this packet closes

These were surfaced during the 2026-08-06→08 analysis. Their dependency
structure is the reason for the slice order below: Q2 is the hinge, and Q4–Q6
cannot be answered honestly before it.

| | Question | Closed by |
|---|---|---|
| **Q1** | Is the official path repaired? | Slices 1–2 (code) |
| **Q2** | For each assumption: does a reachable public source exist? | Slices 3–4 (findings) |
| **Q3** | Judge, finder, or challenger? | Slice 5 — **already answered by VISION**; recorded, not re-litigated |
| **Q4** | How many candidates per review cycle is acceptable? | Slice 5 — user calibration, informed by Slice 3 |
| **Q5** | Is a verdict that depends on user labelling acceptable? | Slice 5 — user decision, informed by Slice 4 |
| **Q6** | R-025 remedy scope | Slice 5 — scoped as a follow-on packet, not implemented here |

**Q3 is not an open question.** `VISION.md` §3 (*"challenges your
assumptions"*), §5.2 (*"Alternative Views: presenting the strongest argument for
the opposing position"*), and §7 (*"does not present every headline. It
prioritizes"*) together exclude both a passive finder and an autonomous judge.
The posture is **challenger**. Slice 5 records this so it stops being re-opened;
it does not ask the user to decide it again.

## 3. Scope

**In scope**

- Diagnosing why every official-source job fails with `source_too_large`,
  including whether the correct document is even being targeted.
- Repairing the official path so at least one real financial document is
  retrieved, extracted, and persisted for TLKM.
- Re-running research after the repair and recording what the corpus becomes.
- A per-assumption source-adequacy assessment, recorded as durable data.
- Recording Q3, and closing Q4–Q6 as user decisions informed by findings.

**Explicitly not in scope**

- Any relevance contract, distinctive-entity matching, or alias taxonomy
  (remedy option **b**).
- The `PassageCandidate` / `Evidence` split (remedy option **c**).
- Any model-based relevance assessor (remedy option **d**) — unauthorized by
  `DEC-0016`, which governs polarity *after* evidence exists, not a relevance
  gate *before* evidence is created.
- Stop-word or ranking hygiene (remedy option **a**) — deferred into whichever
  packet follows, where it can be evaluated against a labelled corpus and its
  official-path regression risk handled once rather than twice. `significantTokens`
  is shared by both tiers (`lib/research/extractors/candidate.ts:204,212`), so
  changing `STOP_WORDS` changes official-path scoring that M009 deliberately
  proved byte-for-byte unchanged.
- Any §9 metrics instrumentation. Measurement without the capability it measures
  produces numbers that describe nothing.
- Re-labelling, deleting, or reinterpreting the 51 existing evidence rows.
  They remain relevance-unassessed. **A judgment that was never made must not be
  fabricated retroactively.**

## 4. Implementation slices

### Slice 1 — Diagnose the official-path failure (no fix)

Establish, with evidence rather than inference: which document each job targets,
its actual size, where the 25 MB limit is enforced, and whether the failure is a
limit that is too low, a document that is the wrong target, or an extraction
strategy that loads whole files into memory when it need not.

Deliverable: a written diagnosis naming the mechanism. **No code change in this
slice** — the fix is chosen after the cause is known, following this
repository's established pattern of diagnosing before repairing.

### Slice 2 — Repair the official path

Implementation follows Slice 1's finding. Whatever the mechanism, two
constraints hold:

- Evidence extracted through the repaired path must remain `exact_verified`
  under the existing verification rules. No new trust class, and no relaxation
  of `verifyExactMatch`.
- If the repair needs a genuinely new capability, that is raised at review as a
  scope question rather than absorbed silently.

Verified live against the real document, not a fixture.

### Slice 3 — Re-run and record what the corpus becomes

Re-run research for the TLKM thesis after the repair. Record the corpus
composition before and after: document count by class, evidence rows by tier and
verification status, and which assumptions moved off `degraded`.

This is the empirical input to Q4. It is a **recording** slice — no
recalibration of ranking or volume happens here.

### Slice 4 — Source adequacy assessment per assumption

For each of TLKM's six assumptions, classify:

- **(A) Reachable** — a public source exists and the current source ladder can
  reach it.
- **(B) Exists but unreachable** — a public source exists, but the ladder cannot
  reach it today (size, format, paywall, disclosure channel not covered).
- **(C) No public source** — no public document would settle this claim, at any
  point on the ladder.

Two rules govern this slice, and they are the reason it is a slice rather than a
side-note:

1. **Exploration is not evidence.** Any web search or model knowledge used to
   locate a candidate source is *exploration*, and must be labelled as such. It
   does not become jp-invest's verified evidence unless it goes through the
   research pipeline. This is `AGENTS.md` rule 1.
2. **The classification is the user's, not the assistant's.** The assistant may
   assemble what it found and lay out the reasoning; the user decides each
   assumption's class. A (C) classification is a statement about the world that
   materially constrains the product's output — it is not an engineering call.

The vocabulary already exists in code: `lib/research/coverage.ts` carries
`no_source_for_market`, documented as *"a permanent gap"*. Whether (C) should
reuse or extend that concept is a design question for the follow-on packet, not
a change made here.

### Slice 5 — Record Q3, close Q4–Q6, scope what follows

With Slices 1–4 complete:

- **Q3** recorded as settled by VISION, with the citations above.
- **Q4** — the user sets an acceptable review volume, now that Slice 3 shows
  what the real candidate volume is. A calibration value; the assistant presents
  the distribution and trade-offs and does not choose the number
  (`AGENTS.md` rule 4).
- **Q5** — the user decides whether a verdict gated on their own labelling is
  acceptable, now that Slice 4 shows whether that labelling has a ceiling. If
  several assumptions are (C), then under `DEC-0018` the thesis cannot reach a
  positive verdict regardless of any labelling effort, and the user should be
  making that call knowing it.
- **Q6** — the R-025 remedy is scoped as a follow-on packet, its shape
  determined by Slice 4's distribution. If (C) dominates, the honest product
  need is a way to state *"this assumption cannot be evidenced by any public
  source"* — a materially smaller change than either (b) or (c).

## 5. Acceptance criteria

- **AC-M013-01** — At least one real official financial document for TLKM is
  retrieved, extracted, and persisted as `exact_verified` evidence, verified
  against the live database rather than a fixture. No TLKM job remains at
  `source_too_large` for a reason Slice 1 identified as fixable.
- **AC-M013-02** — Corpus composition before and after the repair is recorded
  with counts, so the change is measurable rather than asserted.
- **AC-M013-03** — All six TLKM assumptions carry a recorded (A)/(B)/(C)
  classification with the reasoning behind each, and each records whether its
  basis was exploration or verified evidence.
- **AC-M013-04** — Q3 recorded as settled; Q4, Q5, and Q6 each carry an
  explicit user decision or an explicit, reasoned deferral. **No question is
  left silently open.**
- **AC-M013-05** — The 51 pre-existing evidence rows are unchanged in relevance
  status, and no historical row is retroactively labelled relevant or
  irrelevant.

## 6. Verification plan

- Full suite, `tsc --noEmit`, `lint`, `context:check`, `status:check` clean.
- For any test-covered repair: the test is **proven to fail before the fix and
  pass after**, per this repository's standing rule.
- Slice 2 verified against the real document through a live run, not a fixture —
  the official path has been fixture-green while failing live for days, which is
  precisely the failure mode this requires.
- Database counts read directly from `d:/jp-invest-data/db.sqlite`, not from the
  UI and not from a prior session's report.
- **Use a frozen snapshot for any before/after comparison.** A daily scheduled
  refresh (`research:install-task`) mutates the live database without anyone
  running anything; TLKM evidence moved 39 → 45 → 48 → 51 across three days
  through that path alone. Any comparison against the live database is not
  reproducible.

## 7. Risks and deferrals

- **R-028** (new): a tracked assumption may have no reachable public source that
  could ever settle it, and the system searches indefinitely rather than saying
  so. This packet measures the risk; it does not mitigate it.
- **R-025** stays `Open`. This packet does not touch relevance. It supplies the
  inputs a remedy needs, and its findings may materially change which remedy is
  proportionate.
- Slice 2's size is genuinely unknown before Slice 1. If the repair proves large
  enough to be its own packet, that is a legitimate outcome to raise at review —
  not a reason to force a fix into this scope.
- The assessment in Slice 4 is performed for TLKM only. Whether its pattern
  generalizes to other issuers or markets is untested, and this packet does not
  claim it does.

## 8. Reversal

Slice 2 is the only slice that changes runtime behaviour; reverting its commit
restores the previous official path exactly. Slices 1, 3, 4, and 5 produce
documents and recorded findings, which are additive and carry no runtime effect.
