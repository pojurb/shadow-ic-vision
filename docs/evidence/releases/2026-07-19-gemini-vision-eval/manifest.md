# Gemini 3 Flash Preview OCR/Vision Eligibility Eval Evidence (Blocked — Model Retired)

Date: 2026-07-19

Branch: `main`

Outcome: `blocked before eligibility could be established -- provider reports gemini-3-flash-preview retired`

## Scope

- M005 OCR/vision provider eligibility eval against the packet's primary
  candidate, `gemini-3-flash-preview`.
- Deterministic pass completed normally (no live provider call). The live
  pass, which exercises real image attachments against the fixtures under
  `docs/evals/M001/fixtures/vision/`, failed uniformly.

## Commands And Results

| Check | Result |
|---|---|
| `npm run eval:m001:provider -- --mode deterministic --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json` | Pass; deterministic baseline loaded, 16 base cases, 18 multimodal cases, 6 provider-boundary cases passed |
| `npm run eval:m001:provider -- --mode live --model gemini-3-flash-preview --output docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json` | Blocked; 34 of 37 cases failed uniformly, including both real-image cases (`MM-017`, `MM-018`) |

## Finding

Every failed transcript recorded the identical provider error:

> `"gemini-3-flash-preview was retired at 2026-07-15 00:00:00 -0700 PDT"`

This is total model unavailability at the provider, confirmed via 34
identical transcript errors — not a vision-capability gap. No eligibility
conclusion can be drawn about this model's OCR/vision capability from this
run.

## Resolution

- Per the M005 packet's own documented fallback, the eval was re-run against
  `minimax-m3:cloud` (see the sibling `2026-07-19-minimax-vision-eval`
  evidence directory) — pass, 0 hard-gate failures.
- [`DEC-0013`](../../decisions/DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
  (accepted) removes `gemini-3-flash-preview` from the DEC-0010 allowlist and
  promotes `deepseek-v4-flash:cloud` for general (text) POC use.
- [`DEC-0012`](../../decisions/DEC-0012-ocr-vision-provider-eligibility.md)
  (accepted) does not re-approve `gemini-3-flash-preview` for any use.

## Artifacts

- [`01-deterministic-report.json`](01-deterministic-report.json)
- [`02-live-report.json`](02-live-report.json)

## Known Limits

- `modelEligibility` remains `not_evaluated` for `gemini-3-flash-preview` and
  always will unless the provider un-retires it or reissues it under a new
  model id, followed by a fresh eval.
- This evidence does not approve any model for production confidential
  processing.
