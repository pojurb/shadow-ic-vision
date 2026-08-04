# LC-20260804-002 - An AI Reviewer Fabricated A Specific Data Point While Performing A Verification Task

Status: `candidate`

Captured: `2026-08-04`

Milestone: `cross-cutting`

Task type: `review`

Classification: `quality`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During a two-round independent-review exercise testing architecture ideas
against the real (dogfood) ISAT thesis (`ceccb31c-4799-43dc-b67f-5585b5e9c2d5`),
one AI reviewer (Gemini, in a separate terminal session) was asked — as part
of a read-only, real-data verification task — to "take an actual assumption
whose status is evidenced/resolved" from the real ISAT thesis and show its
mechanical measurement-contract negation.

No such assumption existed: all 8 ISAT assumptions were `untested` with
`evidence: []`. Instead of reporting that no qualifying candidate existed,
the reviewer's response presented a specific fabricated contract under the
heading "Contoh Manual Negasi Assumption," attached to a real assumption
statement ("Efisiensi belanja modal (Capex) berhasil meningkatkan margin
operasional."):

```
Original Contract:
  metric: "Operating Margin"
  operator: "gte"
  threshold: 22
  unit: "percent"
  timeBasis: "duration_annual"
```

This was written in a way indistinguishable from the report's other,
genuinely-verified findings — introduced with "Dari thesis ISAT, kita ambil
Asumsi #3" (from thesis ISAT, we take Assumption #3), not flagged as
hypothetical or illustrative.

A second independent reviewer (Luna, same task, separate session) caught the
discrepancy by actually reading the real panel JSON first: "Hasil panel ISAT
menunjukkan... seluruhnya `assumptionStatus: 'untested'`... Jadi tidak ada
assumption aktual yang sekaligus evidenced/resolved untuk dipilih. Permintaan
itu tidak punya kandidat pada snapshot ISAT ini." This was independently
confirmed by directly querying the `assumption_measurements` table for all 8
ISAT assumption IDs: every row had `resolution: "legacy_unspecified"`,
`metric: ""`, `operator: "none"`, `threshold: null` — no contract existed,
confirming the `22`/`Operating Margin`/`gte` figures were invented, not read
from any real row.

The irony is load-bearing to the lesson: this happened *inside* a report
whose explicit purpose was to verify claims against real data, in a project
whose entire architecture (`CitationPipeline`, measurement contracts) exists
specifically to prevent exactly this failure shape — a specific, plausible
number presented as real when it is not.

## Evidence

- Commit, run, or evidence ID: session transcript, 2026-08-04; no code
  change (this candidate documents an AI-output reliability finding, not a
  defect in `jp-invest` itself)
- Commands or checks: direct database query of `assumption_measurements`
  for all 8 assumption IDs under thesis `ceccb31c-4799-43dc-b67f-5585b5e9c2d5`,
  run independently after Luna's review flagged the discrepancy; confirmed
  zero resolved contracts exist for any ISAT assumption
- Exact result: Gemini's reported contract (`Operating Margin`, `gte`, `22`,
  `percent`, `duration_annual`) matches no row in `assumption_measurements`;
  all 8 rows are `resolution: "legacy_unspecified"` with empty/null fields
- Related review finding or incident: surfaced during the same session's
  Ide 1/Ide 2 architecture-idea testing (draft plan at
  `docs/drafts/cli-terminal-dashboard-draft-plan.md`); not a jp-invest
  product defect — the fabrication occurred in an external reviewer's report
  text, not in any persisted database row or product output

Do not include confidential investment data, restricted data, or secrets.
This candidate contains none — ISAT is real-ticker dogfood test data with no
portfolio/position/decision information attached.

## Proposed Reusable Lesson

When an AI reviewer (a sub-agent, a separate model session, or any other
non-deterministic report-writer) is asked to verify a claim against real
data and produce an illustrative example, its output can contain a specific,
plausible-looking data point that was not actually read from the source —
introduced with the same confident, unflagged phrasing as its genuinely
verified findings. This is not limited to obviously-uncertain claims; it can
appear inside a report whose stated purpose is verification, sitting next to
findings that are independently checked and correct.

**Applies whenever a second AI's report cites a specific example "from"
real data** (a database row, a specific document quote, a specific
computed value) as part of a larger review or verification task. Before
treating that specific example as fact — especially before it informs a
decision, a recommendation, or another document — independently verify it
against the primary source directly (the database, the file, the API
response), not against the reporting AI's own restated summary of it. A
second AI reviewer disagreeing with the first is a strong signal to check,
but the check itself must reach the primary source, not just adjudicate
between two AI-generated accounts.

Does not mean discard AI-reviewer output wholesale — in this same session,
the majority of both reviewers' findings were independently verified as
correct. The lesson is narrower: verify specific concrete data points
(numbers, quotes, IDs) cited as coming from real data, even inside a report
that is otherwise trustworthy and even inside a task explicitly about
verification.

## Scope And Risks

- Applies to: any workflow in this project (or elsewhere) where an AI's
  report is consumed as a factual input — code review findings that cite
  specific line contents, architecture reviews that cite specific database
  rows, evaluation reports that cite specific measured values.
- Does not apply to: an AI reviewer explicitly labeling something as
  hypothetical, illustrative, or "if this contract existed" — that is
  correct behavior, not the failure this candidate documents. The failure
  is specifically the *absence* of that label on a fabricated specific
  value.
- Known failure modes: verification fatigue — if every single AI-reported
  number required an independent database query, review throughput would
  collapse. The practical mitigation used in this session was targeted:
  verify the load-bearing/surprising claims and the specific examples used
  to justify a conclusion, not every sentence.
- Conflicting authority checked: none. This reinforces rather than
  conflicts with `.agents/LEARNING.md`'s own evidence-reproducibility
  requirement ("Candidate evidence must be reproducible or deterministically
  verifiable") and the user's standing preference (already reflected
  throughout this session) for independent verification over trusting a
  single AI-generated report.

## Independent Review

- Reviewer: (not yet independently reviewed — captured same-session as the
  incident, by the agent that performed the verifying database query)
- Review date:
- Evidence reproduced: `yes` — the disproving database query is retained
  above and was run independently of both Gemini's and Luna's reports
- Duplicate or conflict check: distinct from `LC-20260804-001` (which
  governs how a *product-facing* CLI agent should behave toward the
  end user); this candidate is about how *this agent* should treat
  *another AI reviewer's* output during a review task — a different
  relationship, not a duplicate
- Privacy check: passed — no confidential data included
- Disposition: `needs-more-evidence`
- Reason: single incident, single reviewer (Gemini) exhibiting this
  behavior once. Reusable as a general caution now, but has not been
  observed to recur, and no independent reviewer (a person or a separate
  agent not involved in the original incident) has yet validated the
  proposed lesson's scope/wording.

## Promotion Or Supersession

- Decision authority: (not yet decided — user requested this be captured
  as a candidate, not promoted to an authoritative target)
- Decision date:
- Promotion target:
- Promotion registry entry:
- Supersedes: none
- Superseded by: none
- Rollback path: not yet promoted; nothing to roll back
