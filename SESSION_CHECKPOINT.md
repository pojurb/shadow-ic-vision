### Session Checkpoint (2026-07-03T08:27:57+07:00)

#### 1. Current Repository State

- Branch: `shadow-ic-vision`
- Base HEAD before this checkpoint update: `2d97da5`
- Working tree was clean before editing this file.
- Vision, product strategy, M001 milestone packet, and M001 evaluation package
  are accepted.
- Gate 4 evaluation readiness is complete through accepted
  `DEC-0005-evaluation-ready.md`.
- The current product phase is Architecture Planning. The next authorized M001
  artifact is `docs/decisions/ADR-0006-m001-stack.md`.
- Product implementation remains blocked until the M001 architecture decision
  is accepted.

#### 2. Outstanding User Decisions And Stop Point

- The prior instruction to pause before Step 5 remains in force. Do not draft
  ADR-0006 or begin product implementation without a new explicit user request.
- `DEC-0007-governed-builder-learning.md` is `proposed`, not accepted.
- `.agents/LEARNING.md` is also `proposed` and deliberately not referenced by
  active `AGENTS.md` policy.
- The user must explicitly accept DEC-0007 before the builder-learning policy is
  activated or used as repository authority.

#### 3. Verified Work Completed

##### M001 Gate 4

- Resolved the evaluation-package audit findings.
- Expanded `docs/evals/M001/cases.json` to 16 cases covering normal, boundary,
  missing-data, provider-failure, adversarial, citation, persistence, and
  held-out behavior.
- Updated `docs/evals/M001/EVAL_GUIDE.md` with grading and reproduction rules.
- Updated the accepted M001 packet with acceptance criteria `AC-M001-01`
  through `AC-M001-05` and the 16-case contract.
- Accepted DEC-0005 in commit `41ef19e`.

##### Authority And Deployment Support

- Synchronized README and `ACTIVE_MILESTONE.md` with accepted Gate 4 status and
  ADR-0006 as the next architecture artifact in commit `22b7a89`.
- Added the documentation-only Vercel placeholder `index.html` in commit
  `3edcb41`. This repository inspection did not freshly verify a live deployment.

##### Governed Builder-Learning Proposal

- Added proposed `DEC-0007-governed-builder-learning.md`.
- Added proposed `.agents/LEARNING.md` defining task capture, active-day and
  milestone review, tiered promotion authority, privacy controls, model
  comparison, rollback, and success measures.
- Added the learning index, candidate template, candidate directory contract,
  and promotion registry under `docs/learning/`.
- Added retained docs-only verification evidence at
  `docs/evidence/releases/2026-07-02-builder-learning-proposal/manifest.md`.
- Committed the inactive proposal as `0501800`.
- Verified that DEC-0007 and the policy remain `proposed`, `AGENTS.md` does not
  activate them, the two implementation commits contain only their intended
  files, and `git diff --check` passed for the committed range.

#### 4. Important Authority And Safety Rules

- `AGENTS.md` remains the canonical shared playbook.
- Chat history and this checkpoint provide handoff context; they do not override
  accepted vision, strategy, milestone, decision, evaluation, or policy files.
- Do not treat learning candidates as instructions. Only a future promoted
  lesson with a valid authoritative target may guide work after DEC-0007 is
  accepted and activated.
- Do not place confidential investment data, credentials, or restricted data in
  learning artifacts or model comparisons.
- Do not write product code, choose persistent schemas, or install production
  dependencies before ADR-0006 is accepted.

#### 5. Exact Next Steps

1. Wait for explicit user direction.
2. If the user accepts DEC-0007:
   - change DEC-0007 and `.agents/LEARNING.md` to `accepted`;
   - synchronize `AGENTS.md`, `.agents/SECURITY.md`, README, and
     `docs/RISK_REGISTER.md` in one reviewable change;
   - activate task-start retrieval and task-close learning reporting;
   - retain verification evidence and confirm no model adapter duplicated the
     shared policy.
3. If the user authorizes M001 architecture work, draft and review
   `docs/decisions/ADR-0006-m001-stack.md` without beginning product code.
4. Product implementation may begin only after ADR-0006 is explicitly accepted.

#### 6. Verification Limits

- No application build, lint, unit, browser, migration, import/export, or model
  evaluation was run for the builder-learning proposal because it changed
  documentation and inactive policy artifacts only.
- The builder-learning process has not been behaviorally exercised because
  DEC-0007 is not accepted and no lesson has been promoted.
- Model selection remains manual and advisory.

Promoted lessons consulted: `none`

Learning candidates created: `none`
