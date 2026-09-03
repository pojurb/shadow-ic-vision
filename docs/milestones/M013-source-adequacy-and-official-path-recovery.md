# M013: Source Adequacy & Official-Path Recovery

Status: `all acceptance criteria met 2026-09-02` — awaiting user sign-off

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

## Slice outcomes — Slices 1–3 (2026-08-08), Slices 4–5 (2026-08-31, completed 2026-09-02); Q3–Q6 all closed

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

> **✔ CORRECTION RESOLVED, 2026-09-02. A6 is settled as (C).** Read this
> paragraph with two amendments, both worked through in §"Slice 5 completed"
> below.
>
> **(i) The sentence "with no MW figure" is imprecise, as the 8/31 review said.**
> That press release (2026-08-14, document `5adc8a8f1ffa`) does carry a 200 MW
> figure — in a different sentence from the PLN clause, and filed under **A2**,
> so it never appeared in A6's evidence.
>
> **(ii) But the inference the 8/31 review drew from that is wrong.** It
> concluded the corpus "does hold the figures A6 needs". It does not: the 200 MW
> is *data-centre capacity*, and this contract asks for *firm power allocated by
> PLN*, against a bar of **1,200 MW**. No MW figure anywhere in the thesis
> measures the contracted metric. A6 stayed (C); the reasoning below is sound,
> its evidence sweep was merely narrower than the corpus.

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

### Slice 5 — Q3 recorded; Q4–Q6 inputs measured, 2026-08-31

#### Q3 — settled by VISION, recorded so it stops being re-opened

**The posture is `challenger`** — neither a passive finder nor an autonomous
judge. Verified against `VISION.md` directly rather than taken from this
packet's own earlier summary:

- **§3** — *"an AI-assisted Investment Committee that tracks your theses,
  **challenges your assumptions** with cited evidence and explicit uncertainty"*.
  A passive finder does not challenge.
- **§5.2** — *"**Alternative Views:** Presenting the strongest argument *for* the
  opposing position to ensure intellectual honesty"*. A finder does not argue
  the other side.
- **§7** — *"The product does not present every headline. It **prioritizes**
  information tied to user-defined theses and assumptions"*, and *"The user makes
  every investment decision"*. An autonomous judge is excluded by the same
  section.

Q3 is closed. It is not a user decision and should not be asked again.

**Two further §7/§6 clauses bear directly on Q5 and Q6 and were not cited in
this packet's original framing.** Both were found while verifying the three
above, and both mean Slice 4's findings are not merely interesting — they name
obligations already in VISION:

- **§7** — *"Missing a relevant source, change, or risk is a possible product
  failure that must be **visible and reviewable, not hidden behind confidence
  language**."* This is exactly the exposure measured above: a verdict that can
  read `HOLDING` off one of six assumptions while four are permanently
  untestable, with nothing in the output saying so. Under §7 that is not a
  preference to calibrate — it is a stated product failure mode.
- **§6.2** — *"Show uncertainty and coverage limits: the system must distinguish
  verified facts, sourced claims, inferences, unresolved conflicts, stale
  information, and **unavailable data**."* Class (C) *is* "unavailable data".
  The vocabulary Slice 4 needed is already required by the constitution; what is
  missing is any surface that expresses it.

#### Measured inputs for Q4, Q5 and Q6 — read 2026-08-31 from the live database

These are the facts the three remaining questions turn on. The questions
themselves are the user's and are not answered here.

| Measure | Value |
|---|---:|
| TLKM evidence rows, total | **191** |
| …on 2026-08-29, after the live run | 158 |
| Rows added since, by the unattended daily cron | **+33** (19 on 8/30, 14 on 8/31) |
| Rows whose polarity is `inconclusive` | **191 — all of them** |
| Rows `supports` or `contradicts` | **0** |
| Distinct source documents feeding those rows | 72 |
| `exact_verified` / `secondary_issuer` / `secondary_news` | 85 / 80 / 26 |
| Job attempts per assumption | **22–25 each** |

**The arrival rate is the Q4 input, and it is not hypothetical.** The corpus grew
158 → 191 in two days with nobody running anything; the scheduled refresh did
it. At that rate a weekly review cycle — the "Sunday Evening Ritual" of
`VISION.md` §4 — presents on the order of 100 new passages. Applying R-025's
measured 88.9% irrelevance rate to them leaves roughly a dozen worth reading,
undifferentiated from the rest.

**Zero directional polarity across 191 rows is the Q5 input**, alongside Slice
4's distribution. Nothing has ever been supported or contradicted on this
thesis, and four of six assumptions can never be — three for lack of any
identified source, one for lack of any metric. Two can. So the question Q5 puts
to the user is not whether to accept a pessimistic verdict; it is whether to
accept a **positive** one computed from at most a third of a thesis.

**The Q6 input is the distribution itself.** This packet's §4 stated the test in
advance: *"If (C) dominates, the honest product need is a way to state 'this
assumption cannot be evidenced by any public source' — a materially smaller
change than either (b) or (c)."* Measured: **(C) is the largest class, 3 of 6**,
and a fourth assumption is unmeasurable for a different reason. By the packet's
own criterion the smaller change is the indicated one. The scope decision
remains the user's.

**One measured behaviour belongs to R-028 rather than to any of the three
questions:** the jobs for A2, A5 and A6 — the three (C) assumptions — have run
22 to 25 times each and are still being re-queued daily. They cannot succeed as
worded. This is R-028's "searches indefinitely and reports 'no evidence yet'"
happening in the live database, now with a count attached.

#### Q5 and Q6 — decided by the user, 2026-08-31

- **Q5 — accepted, with mandatory disclosure.** A positive verdict may still be
  reached from a supported minority, **but the output must state how many
  assumptions are permanently untestable and why**. Recorded as the user's
  decision, and note it is arguably not optional anyway: `VISION.md` §7 requires
  a missing source or risk to be *"visible and reviewable, not hidden behind
  confidence language"*, which makes this a debt to pay rather than a preference
  to hold.
- **Q6 — the smaller scope.** The follow-on packet gives the system a way to
  express *"this assumption cannot be evidenced by any public source"* and stops
  retrying jobs that cannot succeed (A2/A5/A6, 22–25 attempts each). Chosen on
  this packet's own §4 criterion, stated in advance and measured to apply: (C)
  is the largest class. The `PassageCandidate`/`Evidence` split (remedy c) and
  stop-word hygiene (remedy a) are not in it.
- **Q4 — closed 2026-09-02, on shape rather than volume.** The user asked for
  the trade-offs first, then proposed a variant not among the three offered:
  **Option 3 plus a summary layer** — every passage kept and labelled with why it
  surfaced, presented as a summary first with detail reachable on demand. Worked
  through in §"Slice 5 completed" below: it is adopted as the specification, but
  no number is set, because measurement showed volume is not the binding
  constraint and nothing persisted today can feed a summary. `AC-M013-04` is
  met.

### Discovery was dead while Slice 4 was classified — found 2026-08-31 evening

Investigating an unrelated cron symptom the user reported surfaced a standing
failure that bears directly on the classifications above.

**`discovery_quota_exhausted` — Tavily HTTP 432, "monthly credit allowance
exhausted" — has fired ~14 times a day, every day, since 2026-08-06.** For 25
days the pipeline discovered no new sources at all; it only re-crawled documents
it already knew. The code handles the condition correctly
([`tavily.ts:91`](../../lib/research/discovery/tavily.ts#L91) returns
`unavailable`) and logs it to `logs/outbound.log`. **Nothing surfaces it.**
`discoverySummary` ([`contracts.ts:531`](../../lib/domain/contracts.ts#L531))
distinguishes "never ran" from "ran and found nothing" — there is no state for
"ran and failed", so the panel shows stale candidates as if discovery were
healthy. That is the §7 failure mode in the product itself, not in a thesis.

**What this costs Slice 4.** The (C) classifications' *reasoning* is independent
of discovery — A2 needs competitor MW that private operators do not publish, A5
needs tenant-level contracted MW under NDA, A6's bar is firm MW and the climate
report's OCR found none. Those are arguments about what gets published. But the
*empirical leg* — "across N retrieved rows there is no…" — was measured over a
retrieval set narrower than it should have been, for 25 days.

**And the sweep was wrong in one concrete place.** Querying every TLKM evidence
row containing MW/GW shows the corpus does hold the relevant figures — all
attached to the wrong assumption:

| Quote | Attached to |
|---|---|
| "Ekspansi ini akan meningkatkan kapasitas data center NeutraDC hingga mencapai **200 MW**" | **A2** |
| "NeutraDC **berkolaborasi dengan PT PLN** dalam memastikan kesiapan pasokan energi" | **A2** |
| "NeutraDC operates one Hyperscale Data Center … current IT load capacity of **10 MW**" (20-F, official) | **A2** |
| "capacity expansion of **18MW** for the hyperscale data center in Cikarang" | **A2** |
| "35 data centers with a total capacity of **38 MW**" | **A3** |
| "**42 MW** in 33 data centers" | **A4** |

A6 — the assumption literally about PLN power capacity — received four rows of
related-party accounting boilerplate that merely contain the string "PLN". The
single most relevant document in the corpus for A6 was filed under market share.
This is R-025 in its purest observed form, and it is a **different** failure from
"no source exists": the material was retrieved, persisted, and misfiled.

**The amended (C) label earned itself here.** Under the packet's original
absolute wording — "no public document would settle this claim, at any point on
the ladder" — the A6 entry would now be plainly false. Under
"no public source *identified* for the current measurement contract" it remains
accurate, and correctly signals that identification, not the world, was the
limit.

**Two further cron faults, recorded for the repair that follows:** the scheduled
task is being killed mid-run (`LastTaskResult` `0xC000013A`,
`STATUS_CONTROL_C_EXIT`; `StopIfGoingOnBatteries = True` is the leading
hypothesis, unproven), leaving A5 in `running` with an expired lease and
**A3 and A6 never processed at all** — they sit last in the queue and the run
dies first, which is why their attempt counts are 22 against 24–25 and their
evidence rows 14–16 against 37–43. Their thin corpora are therefore partly a
scheduling artifact, not purely a source-availability signal. Separately,
`cnbcindonesia.com/market/rss` times out on every attempt, and one 20-F PDF took
229 seconds to download, consuming much of the run's life before it was killed.

### Slice 5 completed — A6 settled, Q4 closed, 2026-09-02

Every figure below was read from the live database on 2026-09-02, after two
unattended cron runs (9/1, 9/2) the 8/31 entry could not have seen. Corpus at
time of reading: **238 evidence rows, 90 distinct source documents** (was
191 / 72). Backup taken first — `db-before-m013-slice5-20260902T210037.sqlite`,
written through the SQLite online backup API and verified row-for-row across all
23 tables.

#### A6 — settled as (C), and the 8/31 correction was itself incomplete

The 8/31 evening block reopened A6 on the grounds that the corpus "does hold the
figures A6 needs, all filed against the wrong assumption." **Read against the
contract, it does not.** Two things that block did not account for:

**1. The bar is 1,200 MW, not merely "firm MW".** The contract reads `gte 1200`,
`definition_variant`: *"Snapshot MW firm (bukan LoI/studi kelayakan) vs benchmark
BDx 1,2 GW (1200 MW)"*. The 8/31 block framed the remaining question as
aspirational-vs-firm alone. Even granting "akan… hingga mencapai 200 MW" as both
firm and PLN-sourced, it sits **6× below the threshold**.

**2. No MW figure anywhere in the thesis measures the contracted metric.** All
nine MW/GW-bearing rows are data-centre IT load capacity or self-generated
solar — never a firm power allocation from PLN:

| Figure | What it measures | Filed under |
|---|---|---|
| 200 MW | target DC capacity expansion ("akan… hingga mencapai") | A2 |
| 75 MW ×2 | hyperscale total capacity, final stage | A4 |
| 42 MW | 33 data centres, to 3Q24 | A4 |
| 38 MW | 35 data centres | A3 |
| 22.5 MW | first-stage capacity, end 2021 | A4 |
| 18 MW | Cikarang expansion | A2 |
| 10 MW | current IT load, Cikarang (20-F, official) | A2 |
| 14 / 20 MWp | Telkom's own solar PV to 2030 | A2 |

IT load capacity is what a facility can host; a firm supply contract is a
separate commercial instrument. The solar figures are the inverse of the metric —
own generation, not PLN supply. **The only PLN-supply row in the entire thesis**
(press release 2026-08-14, filed under A2) reads *"NeutraDC berkolaborasi dengan
PT PLN (Persero) dalam memastikan kesiapan pasokan energi… secara bertahap"* — no
MW, no term, no allocation. It sits in the same document as the 200 MW sentence
(`5adc8a8f1ffa`), which is why the two were easy to read as one finding.

A6's own 19 rows contain **zero** power figures; every "PLN" occurrence in them
is related-party accounting boilerplate, and the three rows the 9/1 run added are
more of the same.

**The misfiling observation stands; the inference drawn from it does not.** The
200 MW and PLN-collaboration rows are indeed filed under A2 rather than A6.
Calling them "the figures A6 needs" repeated — for the third time in this
packet — the error it has already named twice: **judging by the assumption's
topic instead of by its measurement contract.** A row containing "MW" and
"NeutraDC" is not automatically the metric, and a row containing "PLN" is not
automatically PLN firm capacity.

**User's decision, 2026-09-02: A6 is (C)** — no public source identified for the
current measurement contract. Basis: across 90 documents and 238 rows, including
the 20-F and the 41-page climate report read end-to-end by OCR, no firm PLN power
figure in MW/MVA/GW has ever appeared; PLN occurs only as related-party
accounting and as Scope 2 methodology. Final distribution unchanged:
**A = 1 (A4); B = 2 (A1, A3); C = 3 (A2, A5, A6).**

#### The threshold is flagged as defective, and deliberately left in place

At `gte 1200` benchmarked to BDx's 1.2 GW, against a NeutraDC whose own publicly
stated ambition is 200 MW, **A6 cannot be satisfied at any realistic scale** — its
outcome is fixed negative regardless of how good disclosure becomes. That makes
its class nearly inert: it labels "no source found" for a question already
answered in the negative by arithmetic.

There may also be a denominator mismatch structurally identical to the A2 error
Terra caught: BDx's 1.2 GW may be a cross-market commitment, while the contract
asks NeutraDC for an Indonesia-only PLN allocation. *No verified evidence was
gathered on what the BDx figure covers — this is a question to check, not a
claim.*

**User's decision: keep the contract as written, record the defect, defer the
revision.** This follows the precedent this packet set for A2 and A5 — re-framing
before recording would delete the finding the packet exists to produce — and
keeps any future change an explicit decision rather than a silent one
(`DEC-0018`). Data-quality nit for whoever revises it: `unit` holds `"count"`
while `definition_variant` says MW.

#### Q4 — closed: the shape is decided, the number is deferred

Q4 asked how many candidates per review cycle are acceptable. Measured on
2026-09-02, **volume is not the binding constraint — the absence of any
differentiator is.**

| Measure | Value |
|---|---|
| Arrival, 11–28 Aug (discovery dead, official degraded) | ~14 rows/week |
| Arrival, 27 Aug–2 Sep (healthy, incl. one manual run) | **118 rows/week** |
| `polarity` | **236 / 236 `inconclusive`** |
| `polarity_method` | 216 `no_observed_value`, 20 `not_measurable` |
| `delta_vs_threshold` | **0 populated** |
| `impact_summary` | populated on 236, but **only 3 distinct values** |

The earlier estimate ("on the order of 100 new passages") is confirmed at the top
of the range — but the rate swings **8×** with pipeline health, which no
user-set number can track.

Those three `impact_summary` values are *"Exact source passage matched
deterministically. Interpretation remains pending."* (106×) and two secondary
variants. They record which **class of source** a passage came from, never what
it says. Setting N here would therefore cap an undifferentiated stream: a random
N of ~118 equally uninformative rows, of which R-025's measured 88.9%
irrelevance leaves roughly a dozen worth reading either way.

**This is what the user's own proposal ran into.** *Option 3 + a summary layer* —
keep every passage, label why it surfaced, present a summary first with detail on
demand — is sound, but nothing persisted today can feed the summary:
three-valued boilerplate carries no signal, polarity is uniform, and no relevance
score is stored at all. The natural remaining route, a model-generated summary,
is **remedy option (d)**, which §3 places explicitly out of scope. The proposal
does not fail; it precedes its prerequisite.

**User's decision, 2026-09-02: Q4 closes on shape, not on volume.** The review
surface is Option 3 + a summary layer, recorded here as the specification. No
number is set, because a number is meaningless before a differentiator exists.
Building that differentiator, and the summary above it, belongs to the Q6
follow-on packet.

#### A second failure mode for Q6, worse than the one that motivated it

Q6's scope was chosen against the quota outage recorded above. A wider read of
the same table shows a second failure the panel is equally blind to: **every
discovery candidate ever produced has been rejected — all 65 of them, since the
feature went live 2026-07-26.** Sixty `domain_not_allowlisted` (43 ISAT, 17
TLKM) and five `not_an_article`. Zero promotions in the feature's lifetime; every
Tavily credit spent since 26 July produced no evidence.

The panel renders those candidates as though they were progress. Nothing
distinguishes *"ran, found things, rejected every one"* from *"ran and found
nothing yet"* — the same `VISION.md` §7 blind spot as the quota case, reached by
a different route. It argues for the Q6 remedy covering discovery **outcome**
states, not only the "ran and failed" state named above.

Two operational changes made the same day, recorded because they alter the
figures any later run produces:

- **ISAT archived** (`theses.status` → `archived`, the user's decision). It was
  `active` with **no allowlist entry at all** — the real cause of the standing
  `issuer_source_unavailable` that the 8/31 entry called "pre-existing,
  unrelated", and of its 43 rejected candidates. Refresh now processes 6 jobs per
  run instead of 14. ISAT had contributed only 2 evidence rows in its lifetime.
- **The Tavily quota theory is disproved.** Measured from `logs/outbound.log`:
  steady state is 12–14 calls/day (~420/month against a 1,000/month free tier),
  while 3–8 August ran 385–470/day during manual M008 testing. The daily cron
  never exhausted anything, so the cadence was left unchanged deliberately —
  lowering it would have masked the 0-for-65 defect above.

> **⚠ CORRECTED 2026-09-03 — the paragraph below was wrong, and is kept only
> because it was committed.** It framed `idx.co.id` as a governance question
> about widening what counts as official. It is not one: **IDX is already the
> primary official source adapter for the ID market**, with the issuer adapter
> only as its fallback, and `idx.co.id` is already an accepted host inside
> `normalizeIdxAttachmentUrl`. Nothing needed widening. The real finding is a
> parser bug — see §"The IDX official path never worked" below.

**Parked by explicit user decision, to be taken up once this packet closes:
whether `idx.co.id` is an official source.** Allowlisting an exchange widens what
counts as official beyond `DEC-0015`'s Class A (*"direct company press releases
and investor relations announcements"*), exactly the silent change to "what
counts as support" that `DEC-0018` forbids. It needs its own recorded decision —
and it is the live counter-argument to A6's class: if IDX carries a PLN supply
agreement, A6 is (B), not (C).

#### The IDX official path never worked — found and fixed 2026-09-03

`IdxAdapter` is wired as the ID market's official adapter, with `IssuerAdapter`
(telkom.co.id) only as its fallback. **It has never produced a single document.**

| Measure | Value |
|---|---|
| Calls to `www.idx.id` since 2026-07-05 (`logs/outbound.log`) | **67, every one HTTP 200** |
| `source_snapshots` from IDX | **0** |
| `evidence` rows from IDX | **0** |

Every official row on the TLKM thesis — all 106 — came from the fallback.

**Cause: one comparison.** The live API returns `Kode_Emiten` as fixed-width
`CHAR(100)` — `"TLKM"` followed by 96 spaces — so the exact `!==` check
discarded every announcement before it reached the title-term filter. Measured
against the real endpoint on 2026-09-03: **100 announcements in the two-year
window, all with attachments, 11 titles matching the adapter's own
`REPORT_TERMS`, every attachment URL valid — and 100 of 100 dropped at that
first gate.** `discover()` then fell through to the fallback without surfacing
anything, so the failure never appeared as an error: 67 successful calls whose
results were silently thrown away.

Every existing fixture used an unpadded code and stayed green. **This is the
same fixture-green/live-failing shape Slice 1 recorded**, on the same official
path, three weeks later. Fixed in `831941e` with a test that fails before the
fix (returns `[]`) and passes after; suite 427 passed, typecheck and lint clean.
The pipeline has **not** been re-run.

**What it does and does not mean for this packet's classifications.** Read
against the six measurement contracts, the missing IDX corpus does not overturn
the distribution:

- **A1 (B)** is the one assumption with a real path to change. Its contract asks
  for TLKM's post-divestment ownership percentage in NeutraDC (`gte 30`), which
  is exactly what a material-transaction disclosure carries — and
  *"Transaksi Material Tanpa Persetujuan RUPS"* appears among the live
  announcement titles. If the re-run reaches it, A1 moves (B) → (A).
- **That is (B) working as defined, not a falsified finding.** (B) means the
  source exists but is blocked by a named blocker; this bug *is* that blocker,
  now named. Identifying it is what the classification predicted.
- **A2, A5 and A6 (C) are untouched.** Their gaps are at the metric level, not
  retrieval: competitor MW share for a set of private operators, hyperscaler
  contracted MW at 1,200, and firm PLN MW at 1,200. TLKM's own IDX filings carry
  none of those. The A6 counter-argument asserted in the corrected block above
  does not survive contact with A6's contract.
- **A3 cannot move meaningfully** — its `resolution` is `not_measurable`, so no
  document changes what can be computed.
- **A4** is already (A).

So sign-off is not blocked by this on the evidence available; the open question
is whether to re-run before signing, which is the user's call and is recorded as
open in `SESSION_CHECKPOINT.md`.

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

### Status against the criteria, read 2026-09-02

| | Criterion | Status | Evidence |
|---|---|---|---|
| 01 | Official document retrieved and persisted | **met** | Slices 1–3; 106 `exact_verified` TLKM rows, no job at `source_too_large` |
| 02 | Corpus composition recorded before/after | **met** | Slice 3 table; baselines 51 → 191 → 238 rows, each read from the live DB |
| 03 | All six assumptions classified with reasoning | **met** | Slice 4 plus §"Slice 5 completed"; A = 1, B = 2, C = 3 |
| 04 | Q3 recorded; Q4–Q6 each explicitly closed | **met** | Q3 recorded 8/31; Q5 and Q6 decided 8/31; **Q4 decided 2026-09-02** |
| 05 | No historical row retroactively relabelled | **met** | All 236 TLKM rows remain `inconclusive` / `interpretation_status = pending`; nothing was ever relabelled |

Sign-off is the user's (**Approval authority: user**); this table records that the
criteria are satisfied, not that the packet has been accepted.

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
