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

## Slice outcomes — Slices 1–3 (2026-08-08), Slice 4 (2026-08-31); Slice 5 not started

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

### Slice 4 — source adequacy per assumption, 2026-08-31

Classified against the corpus produced by the live run of 2026-08-29 (TLKM
evidence 158; official `source_snapshots` 2024–2026 = 6; Info Memo = 4).

**Whose judgment this is.** The user decided these six classes, after reviewing
three independent analyses that reached them by different routes — this
assistant's, and two external reviews the user commissioned and pasted back
("Gemini" and "Terra"). The assistant assembled the evidence and laid out the
reasoning; it did not classify. Recorded this way because the packet's own rule
requires it, and because one of the six changed *because* an external review
disagreed with this assistant (see A2).

**Basis of each judgment.** Every class below rests on **verified evidence** —
the evidence rows and measurement contracts read directly from
`d:/jp-invest-data/db.sqlite` on 2026-08-31 — except where a line says
`exploration`. No web search was performed by this assistant. The two external
reviews are themselves exploration, not jp-invest evidence; they are recorded as
corroborating reasoning, never as a source (`AGENTS.md` rule 1).

| # | Assumption (abbrev.) | Class | Contract resolution |
|---|---|---|---|
| A1 | TLKM retains ≥30% of NeutraDC post-divestment | **B** | resolved (`gte 30 percent`) |
| A2 | NeutraDC market share vs named competitive set | **C** | resolved (share of MW live+contracted) |
| A3 | Strategic investor is a credible global DC/cloud operator | **B** | **`not_measurable`** |
| A4 | Data-center contribution material to TLKM financials | **A** | resolved (segment YoY differential) |
| A5 | Hyperscaler capital commitments flow via NeutraDC | **C** | resolved (`gte 1200`, MW) |
| A6 | NeutraDC secures firm PLN power capacity | **C** (was B-provisional; OCR returned, see below) | resolved (`gte 1200`, MW firm) |

**A1 — (B).** The transaction is in progress: the contract's own
`definitionVariant` describes "pelepasan ~70% saham yang sedang diproses". No
retrieved evidence states a post-transaction ownership percentage. The official
job is `degraded/source_http_error`, so this is a retrieval and timing blocker,
not an absence of source. The press releases that *were* retrieved concern
InfraNexia — a different spin-off, ~99% Telkom-owned — not NeutraDC.

**A2 — (C). This is the class that changed during review, and how it changed
matters more than the class.** This assistant first read the statement loosely
as "competitive position" and classified it **(A)**, citing the 2026 20-F
naming competitors, the 10 MW Cikarang IT load, and 89% utilization. The
"Terra" review rejected that: those are operating indicators, not a market
share — there is no denominator and no peer-comparable share series. Reading
the measurement contract afterwards settled it in Terra's favour, harder than
Terra could have known: the contract requires **MW live+contracted for DCI,
BDx, DayOne and DAMAC** as the denominator. Those are private operators that do
not publish it, and TLKM does not publish its competitors' figures. The
retrieved evidence supports a proxy analysis, not this contract.

This also restores consistency with this packet's own §0, written on
2026-08-08, which already named "competitor-set MW market share" as one of
three assumptions asking for figures issuers do not customarily disclose. The
assistant had drifted from that record by reading the statement text instead of
the contract.

**A3 — (B), with a finding neither external review could reach.** Both external
reviews classified this (B) on the ground that a strategic investor's identity
is disclosed at deal announcement, and that is right. But the contract row reads
`resolution = not_measurable` with no metric at all. So A3 is (B) on *source
adequacy* while remaining permanently unmeasurable: even when the disclosure
arrives, there is no metric against which support or breach could be computed.
Source adequacy and measurability are different axes, and A3 separates them.
This is a Q5 input, recorded here so Slice 5 does not have to re-derive it.

**A4 — (A).** The contract already converts the unmeasurable wording ("material
enough to move valuation") into something a filing can settle: Digital
Infrastructure segment YoY revenue growth minus consolidated YoY growth,
differential ≥ 0 pp over 2+ consecutive quarters — and it states openly that
NeutraDC is not disclosed separately, so the segment is used as a proxy. Segment
reporting is a required disclosure and the financial statements are already in
the corpus. What retrieval surfaced instead was ESG boilerplate from
sustainability reports; that is a ranking failure (R-025), not a supply failure.
The distinction is the whole point of this packet.

**A5 — (C).** Across 43 retrieved rows there is no named hyperscaler
commitment, counterparty, amount or allocation. The closest official match is a
2008 2G/3G procurement agreement involving Oracle Corporation — unrelated to
data-center hosting, and already recorded as an R-025 example in Slice 3. The
contract asks for MW contracted/MoU per hyperscaler against a 1,200 MW
benchmark; tenant-level contracted capacity is not something either the operator
or the hyperscaler publishes.

**A6 — (B), provisional.** The official evidence retrieved is entirely
unrelated (related-party transactions, post-employment benefits, spectrum
licensing). One press release confirms a NeutraDC–PLN collaboration on energy
supply readiness for phased hyperscale expansion, with **no MW figure**. The
contract's bar is explicit: **MW firm, not LoI or feasibility study**, against
1,200 MW. Held provisional rather than closed because a concrete unread lead
exists — the Laporan Risiko Iklim, already established as class (B) in Slice 2
(a PowerPoint export flattened to raster, zero embedded fonts, legible, blocked
only by OCR not being wired into `CitationPipeline`). The OCR handoff prompt for
it was first issued on 2026-08-08 and went unanswered for three weeks. Locking a
class over a document nobody has read would have been the same error this packet
was created to correct, one tier down.

**The OCR returned on 2026-08-31, and A6 resolves to (C).** Run by the user's
own vision-capable terminal agent under the standing handoff protocol (this
assistant writes the prompt, does not call a vision provider, and does not run
OCR itself). Result on the question that mattered: **no firm capacity figure in
MW, MVA or GW appears anywhere in the 41 pages** — and no aspirational one
either. PLN appears twice, both times as Scope 2 *accounting methodology*
(consumption derived from PLN billing, at a fixed tariff per kWh), never as
supply, allocation or agreement. "NeutraDC", "hyperscale", "Cikarang" and
"Batam" do not appear at all; the data centers are named only as an emissions
boundary ("data center Telkom Data Ekosistem"). What the document does carry is
a Scope 1/2 series 2020–2023, a 20%-by-2030 and net-zero-by-2060 target, solar
and fuel-cell capacity in **GJ**, and NGFS energy-spend projections — real
content, all of it irrelevant to this contract.

So the lead is exhausted, and under the amended label A6 is **(C) — no public
source identified for the current measurement contract**. This was the branch
the Terra review specified in advance ("jika tidak ada angka firm capacity,
evaluasi ulang menjadi 'tidak tersedia untuk measurement contract ini'"), which
is why it is recorded here rather than re-opened as a new decision.

**Verification of the OCR itself, not taken on the agent's report.** Structure
was re-derived independently with pdfjs against the same snapshot: 41 pages
(exact match), `Title: LAPORAN RISIKO IKLIM 2023`, `Producer: Microsoft®
PowerPoint®`, and **65 characters of extractable text across all 41 pages
combined** — confirming the raster-only finding from Slice 2 against the live
file, with 9–560 image objects per page. What could *not* be independently
re-checked is the negative itself: proving no MW figure exists anywhere requires
a full visual pass of 41 raster pages, and `pdftoppm` is not installed in this
environment. That residue is recorded rather than smoothed over. It is
corroborated from a second direction: across all 158 evidence rows the pipeline
has never surfaced a PLN capacity figure either, and a climate-risk report is
not the genre in which contracted grid capacity is published.

**A second-order finding worth keeping.** The Laporan Risiko Iklim was
classified (B) in Slice 2 — correctly, as a statement about the *document*
(legible, blocked only by format). It was then carried forward as if that made
it a promising source for A6. It was not. **The class of a document and the
class of an assumption are different judgments**, and the first does not
propagate to the second. Slice 2's (B) said "this can be read"; only reading it
could say "this answers nothing here."

#### The (C) label is amended, and why

The packet defined (C) as *"no public document would settle this claim, at any
point on the ladder"*. That is a **universal negative**, and an empty search
cannot establish it. Adopted instead, from the Terra review and accepted by the
user:

> **(C) — No public source identified for the current measurement contract.**

This binds the label to two checkable things — the retrieval actually performed,
and the contract in force when the judgment was made — rather than to a claim
about the world that can never be verified. It is the same discipline
`DEC-0018` applies to the verdict: do not assert what you cannot support. It
also makes the label correctly *contingent*: change the contract and the class
must be re-derived, which is exactly the behaviour the next section requires.

#### Re-framing A2 and A5 is deferred, deliberately

Both external reviews recommended reformulating A2 and A5 into proxies that
public sources can satisfy. **Not done here, and not as part of Slice 4.**

The substantive objection: A2 asks whether NeutraDC is *winning against a named
competitive set*. The proposed proxy — its own capacity and utilization —
answers a different and much easier question, whether it is *growing*. An
operator can grow capacity and utilization while losing share. Substituting the
proxy would let the thesis reach a positive verdict on a claim that was never
tested, which is precisely the silent change to "what counts as support" that
`DEC-0018` forbids.

The sequencing objection is simpler: the finding *is* "under the contracts the
user set, three of six assumptions have no identified public source". Re-framing
before recording deletes the result of the experiment this packet exists to run.

The right order, and where it belongs: record the classes against today's
contracts (done here) → then decide re-framing as its own explicit, recorded
decision with the prior contract preserved. That is Q6 / follow-on packet
territory, and the proxy choice and any threshold in it are the user's
calibration, not the assistant's (`AGENTS.md` rule 4).

#### What the distribution actually means — and a correction to R-028

Final distribution: **A = 1 (A4); B = 2 (A1, A3); C = 3 (A2, A5, A6).**

`R-028` predicted the consequence on 2026-08-08, flagged as "unmeasured until
M013 Slice 4 completes": *"`holding` requires `coverage.supported > 0`, so if
most assumptions are (C), the thesis is structurally pinned at
`INSUFFICIENT_EVIDENCE` no matter how much evidence work is done."* Slice 4 has
now measured it, **and the inference was wrong.** Read directly from
[`verdict.ts:154`](../../lib/research/verdict.ts#L154): the level falls to
`insufficient_evidence` when `coverage.supported === 0`. Zero, not "most". **One
supported assumption is enough to reach `holding`** — and A4 (class A, contract
resolved) and A1 (class B, contract resolved, blocked only on a pending
disclosure) are both capable of becoming supported. This thesis is not pinned.

The real exposure is the mirror image of the predicted one, and worse:

> At most **2 of 6** assumptions can ever be supported. The other four cannot,
> for two different reasons: A2, A5 and A6 have no identified public source, and
> A3 has no metric at all (`not_measurable`). Yet the verdict can read
> **`HOLDING`** on the strength of **one** of the six — while two-thirds of the
> thesis is permanently untestable, and nothing in the output says so.

The suppression backstop does not catch this either: `confidenceGate` is derived
from `coverageRatio`, which counts assumptions carrying *any* quote of any
polarity. All six currently do, so the ratio reads 100% and the gate reads
`open`. The gate cannot distinguish "evidenced" from "evidenceable".

This belongs to Q5 and is the sharpest input it has: the question is not whether
the user accepts a verdict pinned pessimistic, but whether they accept a
positive verdict computed from a third of a thesis. R-028's residual-risk column
should be corrected to this measured finding rather than left carrying the
prediction.

**Method note, since it caught two errors in one session.** Both mistakes
corrected today — this assistant's (A) for A2, and this `DEC-0018` inference —
came from reading a *summary* of a rule instead of the rule: the assumption
statement instead of its measurement contract, and R-028's characterisation of
`DEC-0018` instead of `verdict.ts`. In both cases the artifact was one file
away.

#### Follow-on items raised by this slice, not acted on

- **A2 and A5 jobs are still being retried** — attempt counts 22–25 at the time
  of classification, and the daily scheduled refresh keeps running them. They
  cannot succeed as worded, so this burns fetches and keeps adding irrelevant
  rows to the corpus. Recorded rather than fixed: `§8 Reversal` states Slice 2
  is the only slice that changes runtime behaviour.
- **A1 and A3 share one disclosure event.** Both external reviews independently
  proposed a single transaction-monitoring trigger that would resolve both. They
  remain two assumptions — the retained percentage and the counterparty's
  profile are separate facts — but a shared refresh trigger is a sound follow-on
  design.
- **AC-M013-03 is met for all six.** A6's OCR returned the same day and closed
  the last provisional class. What remains open is not this criterion but the
  OCR *path*: `VisionTranscriber` is still not wired into `CitationPipeline`, so
  the handoff remains manual and its output is a source-adequacy judgment, never
  ingested as evidence (`DEC-0012` would make it `ocr_matched`, never
  `exact_verified`).
- **R-028's residual-risk column carries a prediction that measurement has now
  falsified.** Correcting it is a register edit, not a Slice 4 finding, but it
  should not be left standing.

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
