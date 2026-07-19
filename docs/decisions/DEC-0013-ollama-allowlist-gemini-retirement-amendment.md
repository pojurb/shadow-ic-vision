# DEC-0013 - Ollama Allowlist Amendment: Retire Gemini 3 Flash Preview

Status: `accepted`

Date proposed: 2026-07-19

Date accepted: 2026-07-19

Approving authority: user

Supersedes: none

Amends: [`DEC-0010`](DEC-0010-ollama-cloud-poc-approval.md)

## Context

While drafting [`DEC-0012`](DEC-0012-ocr-vision-provider-eligibility.md) (M005
OCR/vision provider eligibility), the live provider eval against
`gemini-3-flash-preview` — one of the six models `DEC-0010` accepted for POC
use — failed uniformly (34 of 37 cases) with:

> `"gemini-3-flash-preview was retired at 2026-07-15 00:00:00 -0700 PDT"`

`DEC-0010`'s own "Revocation And Incident Response" section already names
"the configured model is retired without an approved replacement" as a
revocation trigger. This decision is the governed response: it removes
`gemini-3-flash-preview` from the approved allowlist and promotes
`deepseek-v4-flash:cloud` into its place.

`deepseek-v4-flash:cloud` requires no new vendor review — it is already
`accepted_for_poc` via the 2026-07-11 multi-model evaluation
(`docs/evidence/releases/2026-07-11-model-evals/manifest.md`), where it
recorded the best combined text-eligibility result among the five
non-gemini models: 73.3% assumption extraction completeness (tied with
`minimax-m3:cloud`), 33.3% CTA relevance (tied with the retired gemini
result), 0% citation hallucination, and zero hard-gate failures.

**Scope note:** this promotion covers text eligibility only.
`deepseek-v4-flash:cloud` has not been tested against real image input — only
`minimax-m3:cloud` has, per DEC-0012. This decision does not claim or imply
vision/OCR eligibility for `deepseek-v4-flash:cloud`.

## Decision Requested

Amend `DEC-0010`'s approved allowlist and fixed evaluation order:

1. Remove `gemini-3-flash-preview` from `OLLAMA_MODEL_IDS`,
   `OLLAMA_MODEL_EVAL_ORDER`, and `OLLAMA_MODEL_OPTIONS`
   (`lib/ai/ollama-models.ts`) and from the app's model selector.
2. The allowlist becomes five models: `kimi-k2.7-code:cloud`,
   `qwen3.5:cloud`, `deepseek-v4-pro:cloud`, `deepseek-v4-flash:cloud`,
   `minimax-m3:cloud`. All five retain their existing `accepted_for_poc`
   status from the 2026-07-11 evaluation — no re-evaluation is required by
   this decision.
3. `deepseek-v4-flash:cloud` is explicitly named as the model occupying
   gemini's former general-purpose "slot" in the roster, on the basis of its
   already-recorded text-eligibility results (no new eval run required).

This decision does not approve `gemini-3-flash-preview` for any future use —
re-approval would require confirming the provider has un-retired it or
reissued it under a new model id, plus a fresh eval. It does not extend
vision/OCR eligibility to any model beyond `minimax-m3:cloud`
(DEC-0012's scope).

## Approved Scope If Accepted

Unchanged from DEC-0010: allowed/blocked data classes, POC-only runtime
scope, and the requirement that `modelEligibility` for OCR/vision capability
specifically stays governed by DEC-0012 (not this decision). Only the model
roster and fixed eval order change.

## Eval And Verification Path

No new provider eval is required — this is a roster change over
already-recorded eligibility results. Verification is code/doc consistency:

- `lib/ai/ollama-models.ts` no longer lists `gemini-3-flash-preview`.
- `tests/ollama-models.test.ts` reflects the five-model roster and updated
  fixed eval order.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- `npm run status:check`, `npm run context:check`, `git diff --check`.
- The app's model selector (`components/ChatUI.tsx`, which maps over
  `OLLAMA_MODEL_OPTIONS`) no longer offers `gemini-3-flash-preview`.

## Current State

- Retirement finding: `docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`.
- `deepseek-v4-flash:cloud`'s existing accepted eligibility:
  `docs/evidence/releases/2026-07-11-model-evals/deepseek-flash-live.json`
  and `deepseek-flash-deterministic.json`.
- Historical evidence under `docs/evidence/releases/2026-07-11-model-evals/`
  and `docs/evidence/releases/2026-07-09-kimi-provider-eval/` is a
  point-in-time record and is not rewritten by this decision; it correctly
  reflects that `gemini-3-flash-preview` was evaluated and accepted at the
  time those records were made.

## Revocation And Incident Response

Inherits DEC-0010's triggers. Additionally: if `deepseek-v4-flash:cloud` is
itself later found retired or unavailable, that discovery must be recorded
the same way this one was — a new amendment decision, not a silent allowlist
edit.

## Acceptance Criteria

- This record is accepted by the user or remains explicitly blocked.
- `docs/decisions/INDEX.md` matches this record's status.
- `DEC-0010` carries a signpost to this decision (not a rewrite of its
  original allowlist text).
- `lib/ai/ollama-models.ts` and `tests/ollama-models.test.ts` reflect the
  five-model roster.
- `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`, and
  `docs/RISK_REGISTER.md` (R-024) no longer describe the gemini retirement as
  an unresolved follow-up.
- Full verification suite passes (typecheck, lint, test, build, e2e,
  status/context checks).
