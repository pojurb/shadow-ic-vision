# LC-20260905-004 - Cross-Surface Workflows Need A Stable Handle

Status: `promoted`

Captured: `2026-09-05`

Milestone: `cross-cutting`

Task type: `review`

Classification: `process`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

The terminal-to-browser thesis workflow begins with a conversation ID and URL
because no thesis exists at staging time. Browser confirmation later creates a
thesis ID, but the browser does not expose it. Subsequent CLI research commands
accept only the thesis ID, and the documented workflow provides no list or
resolver command. As a result, the output of one completed stage is not a usable
input to the next documented stage.

This confirms a broken handoff caused by switching entity identifiers across
surfaces without a stable user-facing handle or deterministic resolver.

## Evidence

- Commit, run, or evidence ID: CLI workflow audit against
  `0ab929500c586d97ef96cfb4e1c48ae990d9bc4f`, 2026-09-05
- Commands or checks: traced `thesis:stage`, browser confirmation response and
  UI use, and the argument contracts for queue, panel, and retry commands
- Exact result: staging outputs a conversation URL; confirmation creates but
  does not surface the thesis ID; later CLI commands require that thesis ID
- Related review finding or incident:
  `outputs/reviews/cli-workflow-review-2026-09-05.md`, browser-to-CLI handoff
  finding

No confidential investment data, restricted data, or secrets are included.

## Proposed Reusable Lesson

Before accepting a workflow that crosses CLI, browser, API, and worker
boundaries, prove that the artifact returned by each stage is directly accepted
by the next stage. Prefer one stable user-facing handle throughout the workflow.
When entity creation changes the canonical internal ID, provide a deterministic
resolver from the original handle and expose the relationship in both human and
machine-readable output.

Test the full handoff using real surface boundaries. Service-level tests of the
individual stages do not establish that a user can complete the workflow.

## Scope And Risks

- Applies to: staged drafts, approval flows, asynchronous jobs, imports,
  cleanup previews, and other workflows that cross UI or process boundaries
- Does not apply to: an atomic single-surface operation with no identifier
  handoff
- Known failure modes: returning an internal ID that does not yet exist;
  requiring a later ID without exposing it; relying on database inspection;
  using a non-unique label such as ticker as an implicit identifier
- Conflicting authority checked: `AGENTS.md`, `.agents/QUALITY.md`,
  `docs/CLI_WORKFLOW.md`, and `DEC-0017`; the candidate does not choose the
  product's final handle format

## Independent Review

- Reviewer: independent review agent (separate agent session)
- Review date: 2026-09-05
- Evidence reproduced: `yes`
- Duplicate or conflict check: no existing learning candidate covers stable
  handles across user-facing workflow boundaries
- Privacy check: public code-path observations only
- Disposition: `validated`
- Reason: independent reviewer confirmed the stage, confirmation, UI, and CLI
  identifier trace. The lesson is generalizable; an end-to-end test is still
  required before implementation is considered complete.

## Promotion Or Supersession

- Decision authority: user for adoption into a shared skill or product workflow
- Decision date: 2026-09-05
- Promotion target: `.agents/QUALITY.md`
- Promotion registry entry: `PROMOTIONS.md`, active promotion for
  `LC-20260905-004`
- Supersedes: none
- Superseded by:
- Rollback path: remove the promoted shared guidance and mark this candidate
  superseded; retain the audit evidence
