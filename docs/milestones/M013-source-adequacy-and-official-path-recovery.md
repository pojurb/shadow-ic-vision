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
