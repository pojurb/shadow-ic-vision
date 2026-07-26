# LC-20260725-002 - Production Wiring Of Evaluator Safeguards

Status: `promoted`

Captured: `2026-07-25`

Milestone: `M006`

Task type: `planning`

Classification: `security`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During M006 planning, `scanEmbeddedInstructions` (`lib/research/extractors/safety.ts`) was audited and found to be referenced exclusively by `tests/multimodal-helpers.test.ts` and `scripts/eval-m001-multimodal.ts`. The actual production extraction flow (`lib/research/`) performed no prompt injection or instruction scanning on incoming document text.

The safety scanner existed solely as an evaluation check, creating a false sense of security where production ingestion remained unprotected against hostile prompt injection in retrieved document text.

## Evidence

- Commit, run, or evidence ID:
  - M006 packet planning & `SESSION_CHECKPOINT.md` (2026-07-25)
- Commands or checks:
  - Code search across `lib/research/` for `scanEmbeddedInstructions`
- Exact result:
  - Zero call sites in production research orchestration or adapter code; only called in tests and eval scripts.
- Related review finding or incident:
  - M006 security audit finding (2026-07-25)

## Proposed Reusable Lesson

Safety scanners, prompt injection filters, and input sanitizers must be wired directly into production data flow pipelines before claims of risk mitigation (e.g. Risk Register entries) are recorded. Evaluator-only checks measure safety but do not enforce it in production.

## Scope And Risks

- Applies to:
  - Ingestion pipelines handling external, untrusted, or user-controllable text and image content.
- Does not apply to:
  - Purely internal synthetic fixtures used for unit testing.
- Known failure modes:
  - Relying on passing eval metrics without verifying that the underlying filter function is wired into the application's runtime execution path.
- Conflicting authority checked:
  - `AGENTS.md`
  - `.agents/SECURITY.md`
  - `docs/RISK_REGISTER.md`

## Independent Review

- Reviewer: Antigravity (Gemini 3.6 Flash)
- Review date: 2026-07-26
- Evidence reproduced: `yes`
- Duplicate or conflict check: `clean`
- Privacy check: `clean`
- Disposition: `validated`
- Reason: M006 implementation confirmed `scanEmbeddedInstructions` is wired into `extractHtml`, `extractPdf`, `createVisionTranscriber`, and `generateDecisionRecommendation`.

## Promotion Or Supersession

- Decision authority: user
- Decision date: 2026-07-26
- Promotion target: [.agents/SECURITY.md](../../.agents/SECURITY.md)
- Promotion registry entry: LC-20260725-002
- Supersedes: none
- Superseded by: none
- Rollback path: Remove section from `.agents/SECURITY.md` and mark entry superseded.
