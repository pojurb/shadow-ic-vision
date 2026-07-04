# LC-20260704-001 - Required Browser Gates Need A Repository-Owned Harness

Status: `candidate`

Captured: `2026-07-04`

Milestone: `M001`

Task type: `tooling`

Classification: `quality`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

Chrome extension control completed the M001 desktop workflows, but its screenshot
command timed out twice. Viewport emulation then timed out, and the control
channel became unresponsive. This blocked the required retained screenshots and
narrow-drawer verification even though no JP Invest defect had been found.

A repository-owned Playwright harness using installed Microsoft Edge, an
isolated SQLite database, and synthetic PLTR data subsequently reproduced the
verified desktop flow, asserted three-column geometry, asserted the fixed narrow
Research drawer and its close/reopen behavior, and retained both screenshots.

## Evidence

- Commit, run, or evidence ID: Chrome result commit `33d0222`; Playwright closure
  commit `d66638f`.
- Commands or checks: `npm run test:e2e`; `npm run typecheck`; `npm run lint`;
  `npm test`; `npm run build`.
- Exact result: Playwright passed 1 browser test using Edge; TypeScript and lint
  passed; Vitest passed 4 files and 21 tests; the production build passed.
- Related review finding or incident:
  [`../../evidence/releases/2026-07-04-m001-local-vertical-slice/manifest.md`](../../evidence/releases/2026-07-04-m001-local-vertical-slice/manifest.md),
  including retained desktop and 800 x 900 screenshots.

No confidential investment data, credentials, or live provider data is present.
All browser evidence uses deterministic synthetic fixtures.

## Proposed Reusable Lesson

When browser behavior is a required milestone or release gate, implement the
acceptance checks in a repository-owned, repeatable browser harness. The harness
should:

1. start the application with isolated synthetic state;
2. assert required behavior and layout rather than relying only on screenshots;
3. retain the minimum screenshots or reports required by the gate;
4. run through a documented repository command; and
5. classify interactive-browser failures as tooling failures before changing
   product code or local browser registration.

Interactive Chrome or in-app browser control remains useful for exploration and
manual inspection, but it should be supplementary evidence rather than the sole
mechanism for a required closure gate.

## Scope And Risks

- Applies to: milestones and releases with required browser workflows,
  responsive behavior, refresh persistence, or retained visual evidence.
- Does not apply to: exploratory design review where no repeatable acceptance
  gate exists, or usability research requiring human judgment.
- Known failure modes: browser-channel assumptions may reduce portability;
  screenshot-only checks can become brittle; synthetic fixtures may miss live
  integration failures; an automated pass does not replace accessibility or
  human usability review.
- Conflicting authority checked: `AGENTS.md`, `.agents/LEARNING.md`,
  `.agents/QUALITY.md`, `docs/milestones/M001-existing-thesis-loop.md`, and
  `docs/decisions/DEC-0007-governed-builder-learning.md`.

## Independent Review

- Reviewer: pending independent reviewer
- Review date: pending
- Evidence reproduced: `no`
- Duplicate or conflict check: pending; prior Edge/CDP fallback experience is
  supporting recurrence evidence, not an authoritative duplicate.
- Privacy check: pending independent confirmation; candidate contains synthetic
  fixture names and repository-local evidence only.
- Disposition: `needs-more-evidence`
- Reason: deterministic evidence exists, but the candidate has not yet received
  the independent review required for validation or promotion.

## Promotion Or Supersession

- Decision authority: user, because the proposed target is governing playbook
  guidance in `.agents/QUALITY.md`.
- Decision date: pending
- Promotion target: proposed `.agents/QUALITY.md` browser-verification guidance
- Promotion registry entry: pending
- Supersedes: none
- Superseded by: none
- Rollback path: if promoted, remove the added browser-verification guidance,
  mark this candidate and registry entry `superseded`, and restore the prior
  quality procedure.
