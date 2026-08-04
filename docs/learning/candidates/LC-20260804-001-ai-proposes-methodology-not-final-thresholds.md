# LC-20260804-001 - AI Proposes Methodology And Conventions, Never The Final Numeric Threshold

Status: `promoted`

Captured: `2026-08-04`

Milestone: `cross-cutting`

Task type: `review`

Classification: `process`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During a terminal-CLI-workflow design session (draft plan at
`docs/drafts/cli-terminal-dashboard-draft-plan.md`), the user staged a real
thesis draft (`TLKM`) with 4 of 6 assumptions flagged `ambiguous` by
`draftClarificationBlock` (`lib/domain/contracts.ts`) — each missing a
concrete metric, threshold, or time basis. When first asked to help resolve
these, the assisting agent declined to supply anything beyond "that's your
judgment," on the reasoning that supplying a number would let the model
decide what makes the thesis true or false. The user pushed back: this
overcorrected — established equity-research conventions exist for several of
these questions (e.g., SEC materiality guidance, marginal vs. total market
share, contracted-backlog/SBNB reporting used by data center REITs, PPA-status
distinctions), and an AI agent withholding that domain knowledge entirely is
not the same as protecting the user's decision authority.

The corrected position, arrived at after the pushback: an agent should
propose the *methodology* (which metric, which convention, which comparable
framework, with reasoning) freely and completely — that is domain expertise,
not a decision. It must not propose the *final calibrated number* for that
specific thesis (what % is material to *this* stock, what MW counts as
"competitive" for *this* thesis) — that step is irreducibly the user's
judgment about their own conviction.

Independently corroborating evidence was found in the user's own prior,
unrelated project (`github.com/pojurb/demo1`, `system/core.md`, "Project
Living Thesis v2.0"): the same boundary is already formalized there under
"Methodology vs. Final Thresholds" — the AI proposes formula/framework
structure (e.g., a Confidence Score Formula, stress-test scenarios) and
sizing *conventions* (Starter/Full/Max Conviction bands), explicitly labeled
as "illustrative conventions," while final calibration and deployment
thresholds remain human authority. This is the same principle, established
independently by the same user in a different project before this session,
which strengthens it from a one-off preference to a repeated, generalizable
rule.

## Evidence

- Commit, run, or evidence ID: session transcript, 2026-08-04; no code commit
  (this candidate documents a conversational/behavioral correction, not a
  code change)
- Commands or checks: direct read of `lib/domain/contracts.ts`
  (`measurementContractSchema`, `draftClarificationBlock`) to confirm the
  mechanism this lesson applies to; `WebFetch` of
  `github.com/pojurb/demo1/system/core.md` to confirm the corroborating prior
  art, quoted above
- Exact result: user explicitly confirmed the corrected framing ("kalau gw
  mau itu di bahas di Terminal..." exchange) and separately confirmed the
  `demo1` boundary matches ("kayaknya gw pernah buat sesuatu yang mirip")
- Related review finding or incident: none (not a defect; a calibration of
  assistant behavior)

Do not include confidential investment data, restricted data, or secrets.
This candidate contains none — the TLKM example is a synthetic/dogfood
scenario, no portfolio or account data.

## Proposed Reusable Lesson

When a user (or a CLI agent working on their behalf) needs to resolve an
`ambiguous` measurement contract, an `explorationDraftSchema` candidate, or
any other governed judgment call this codebase deliberately reserves for the
user:

- **Do** propose named methodologies, industry conventions, comparable
  frameworks, and the reasoning for each, as completely as domain knowledge
  allows. Cite the convention by name where one exists (e.g., "SOTP/EV
  contribution," "marginal share of new capacity," "SBNB/contracted
  backlog") rather than a vague gesture at "best practice."
- **Do not** supply the specific calibrated number, threshold, or
  action for that user's specific thesis/decision and present it as
  settled. Present it as a choice within the proposed framework, and name
  what is still open.
- This is the same shape as, but distinct from, the existing "never
  recommend Buy/Hold/Reduce/Exit" rule (`AGENTS.md`, added 2026-08-04): that
  rule blocks a *conclusion*; this one blocks a *calibration input* that
  would otherwise let the conclusion be reverse-engineered from an
  AI-chosen number.

## Scope And Risks

- Applies to: any AI-assisted step in this codebase (CLI or web) that helps
  a user fill in a measurement contract, exploration candidate threshold,
  sizing/allocation figure, or similar user-owned calibration value.
- Does not apply to: purely factual lookups (e.g., "what does TLKM's H1 2026
  filing report for segment revenue") — those have a correct answer and are
  not judgment calls; and does not apply to safety-relevant refusals (those
  stay hard blocks, not "propose a framework").
- Known failure modes: an agent could satisfy the letter of this rule while
  still steering the user toward a specific number by proposing only one
  framework whose "natural" calibration happens to match a predetermined
  conclusion. Naming multiple frameworks with different implications (as
  done in the TLKM session) mitigates this; a single-framework answer should
  be treated as a weaker instance of this lesson, not full compliance.
- Conflicting authority checked: `VISION.md` §7 ("does not treat model
  output as evidence... must remain traceable to sources, calculations, or
  clearly labeled inference"), `PRODUCT_STRATEGY.md` Workflow E (investment
  actions are user-entered) — this lesson is a narrower, related boundary
  and does not conflict with either; `AGENTS.md`'s "Product Constitution for
  CLI Usage" section (added 2026-08-04, same session) is the direct sibling
  rule this candidate extends.

## Independent Review

- Reviewer: user (direct review and approval in the same session, not a
  separate agent/reviewer pass)
- Review date: 2026-08-04
- Evidence reproduced: `yes` — the corroborating `demo1` source was fetched
  and quoted directly, not taken on the user's description alone
- Duplicate or conflict check: checked against `AGENTS.md`'s existing three
  constitution rules (added same session) — this is a distinct, narrower
  rule (calibration inputs, not conclusions), not a duplicate
- Privacy check: passed — no confidential data included
- Disposition: `validated`
- Reason: user directly requested and confirmed both the observation and the
  cross-project corroboration; per `.agents/LEARNING.md`, explicit user
  approval is the required unlock for a lesson that touches product-facing
  agent behavior (this promotes into `AGENTS.md`, not a low-risk procedural
  target), which is satisfied here even though no separate second-agent
  review occurred

## Promotion Or Supersession

- Decision authority: user
- Decision date: 2026-08-04
- Promotion target: `AGENTS.md` ("Product Constitution for CLI Usage"
  section)
- Promotion registry entry: see `docs/learning/INDEX.md` and
  `docs/learning/PROMOTIONS.md`
- Supersedes: none
- Superseded by: none
- Rollback path: revert the corresponding `AGENTS.md` edit; this candidate
  file remains as retained evidence regardless
