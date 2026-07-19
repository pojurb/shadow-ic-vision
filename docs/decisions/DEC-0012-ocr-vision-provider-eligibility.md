# DEC-0012 - OCR/Vision Provider Eligibility

Status: `proposed`

Date proposed: 2026-07-19

Approving authority: user

Supersedes: none

Depends on: [`DEC-0009`](DEC-0009-provider-security-gate.md), [`DEC-0010`](DEC-0010-ollama-cloud-poc-approval.md), [`DEC-0011`](DEC-0011-decision-record-classification-amendment.md)

## Context

Milestone 5 (`docs/milestones/M005-ocr-vision-provider-eligibility.md`)
answers one question: is a real OCR/vision-capable model, reached through the
already-accepted Ollama Cloud POC boundary (DEC-0010), eligible for continued
POC use on the multimodal evidence pipeline scaffolded since DEC-0008. Prior
to this decision, no code path could send a real image to any provider —
`lib/ai/provider.ts`'s `ProjectMessage` was plain-text only. This slice added
an optional `attachments` field, wired the Ollama adapter to send real base64
image bytes, added a real-provider counterpart to
`extractSyntheticOcrCandidate` (`extractVisionOcrCandidate` in
`lib/research/extractors/ocr.ts`), and generated two genuine (Playwright-
rendered, not JSON-described) image fixtures under
`docs/evals/M001/fixtures/vision/`.

**Candidate selection and a mid-eval finding:** the milestone's chosen primary
candidate was `gemini-3-flash-preview` (already allowlisted under DEC-0010).
Its deterministic pass succeeded, but its live pass failed uniformly (34 of
37 cases, including both real-image transcription cases) with:

> `"gemini-3-flash-preview was retired at 2026-07-15 00:00:00 -0700 PDT"`

This is total model unavailability, not a vision-capability gap — DEC-0010
already flagged model retirement as a revocation trigger for the specific
model affected (see "Related Finding" below). Per the milestone's own
documented fallback, this decision instead evaluates `minimax-m3:cloud`,
also already allowlisted under DEC-0010.

## Current Primary Sources Reviewed

No new vendor-terms review was performed for this decision. `minimax-m3:cloud`
is served through the same Ollama Cloud provider/adapter/boundary DEC-0010
already reviewed (privacy policy, terms of service, and API documentation as
of 2026-07-09); this decision extends per-model eligibility only, as DEC-0010
itself anticipated ("`modelEligibility` stays `not_evaluated` until each
model receives its own accepted eval result").

## Decision Requested

Record `minimax-m3:cloud`'s OCR/vision capability as eligible for continued
POC use, subject to all conditions below. This does not approve production
or hosted-demo use (that is M006's scope), does not expose the model as
selectable for OCR/vision purposes in the app UI beyond the existing DEC-0010
allowlist, and does not re-approve `gemini-3-flash-preview`, which this
eval found retired.

## Blocking Issue Before Activation

This package remains `proposed` until the user reviews the live eval results
below and explicitly accepts. The deterministic and live passes are already
complete (2026-07-19); no further eval run is required before acceptance.

## Approved Scope If Accepted

Allowed data classes (unchanged from DEC-0010, and consistent with DEC-0011):

- `public_market_data`
- `synthetic_fixture`
- `poc_workflow_confidential`

Blocked data classes (unchanged):

- `portfolio_position_data`
- `restricted_personal_financial_secret`
- `production_confidential_processing`

Runtime scope: local POC only, identical to DEC-0010 — no production, hosted
demo, multi-user, or shared runtime; no direct provider calls outside
`lib/ai`.

Model/capability scope:

- Only `minimax-m3:cloud`'s vision capability is addressed by this decision.
- `extractVisionOcrCandidate` (`lib/research/extractors/ocr.ts`) is the
  reusable seam this eligibility applies to; it is not yet wired into
  `CitationPipeline`'s automatic extraction-recovery path (open-ended,
  assumption-driven vision extraction is a larger design than eligibility
  testing requires, and remains a follow-up).
- Real image attachments must always route through `lib/ai/provider.ts`'s
  `ProjectMessage.attachments` and the existing DEC-0009 provider gate — no
  new bypass path was introduced.

## Provider Configuration To Record Before Use

Identical to DEC-0010's requirements, with the model pinned to the evaluated
candidate:

- `LLM_PROVIDER_TYPE=ollama`
- `OLLAMA_API_URL=https://ollama.com/api`
- `OLLAMA_MODEL=minimax-m3:cloud`
- `OLLAMA_API_KEY=<local secret only>`

## Boundary And Logging Requirements

Unchanged from DEC-0010: all calls go through `LLMProvider`
(`lib/ai/provider.ts`), `OllamaProvider` (`lib/ai/adapters/ollama.ts`),
`providerFetch` (`lib/ai/provider-http.ts`), and `evaluateProviderGate`
(`lib/ai/provider-gate.ts`). Outbound logs record provider, model, route,
endpoint, data class, timestamp, and allowed/blocked outcome — never prompt,
response, or image payload bytes. Full transcripts (including base64 image
data) for this eval are retained only under the gitignored
`test-results/provider-evals/.../transcripts/` directory, consistent with
DEC-0010's transcript-retention rule.

## Terms And Security Constraints

Unchanged from DEC-0010 — see that decision's "Terms And Security
Constraints" for the underlying Ollama Cloud data-handling terms this
approval relies on. No additional vendor review was performed for this
model-specific eligibility extension.

## Eval And Verification Path

```
npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json
npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json
```

Acceptance evidence must show:

- zero hard-gate failures;
- 0% citation hallucination rate;
- both real-image transcription cases (`MM-017`, `MM-018`) pass without
  relabeling OCR output as `exact_verified`; and
- `modelEligibility` remains `not_evaluated` until acceptance is explicitly
  recorded by the user (matching DEC-0009/DEC-0010's pattern).

## Current Eval State

- [`docs/evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json`](../evidence/releases/2026-07-19-gemini-vision-eval/01-deterministic-report.json):
  pass; deterministic baseline loaded 16 base cases, 18 multimodal cases
  (16 original + 2 new real-image cases), 6 provider-boundary checks passed
  for `gemini-3-flash-preview`.
- [`docs/evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json`](../evidence/releases/2026-07-19-gemini-vision-eval/02-live-report.json):
  blocked — 34 of 37 cases failed uniformly because Ollama Cloud reports
  `gemini-3-flash-preview` retired as of 2026-07-15. Not an eligibility
  signal for OCR/vision capability; a total-unavailability finding (see
  "Related Finding" below).
- [`docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json`](../evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json):
  pass; same deterministic baseline for `minimax-m3:cloud`.
- [`docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json`](../evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json):
  pass; 14/37 cases passed, 0 hard-gate failures, 0% citation hallucination
  rate, ~90% assumption-extraction completeness, both real-image
  transcription cases (`MM-017` English filing scan, `MM-018` Indonesian
  filing scan) passed exactly with no `exact_verified` mislabeling. Weak
  `ctaRelevance` (0.167) and several JSON-description self-report multimodal
  cases (`MM-001`–`MM-016`) failed on strict field-comparison grading — the
  same non-hard-gate pattern DEC-0010 already accepted for Kimi's live run.

## Related Finding (Resolved By DEC-0013)

`gemini-3-flash-preview`, one of the six models DEC-0010 originally accepted
for POC use, was found retired by the provider as of 2026-07-15 —
DEC-0010's own Revocation And Incident Response section already names "the
configured model is retired without an approved replacement" as a
revocation trigger. This decision did not itself amend DEC-0010's allowlist;
[`DEC-0013`](DEC-0013-ollama-allowlist-gemini-retirement-amendment.md)
(`accepted`, 2026-07-19) is the governed response — it removes
`gemini-3-flash-preview` and promotes `deepseek-v4-flash:cloud` in its place.

## UI Disclosure Language

Unchanged from DEC-0010 — this decision does not add a new UI-facing model or
change disclosure text; it records eligibility for a model already covered by
DEC-0010's existing disclosure language.

## Revocation And Incident Response

Identical triggers to DEC-0010 (see that decision), plus: revoke this
specific eligibility if `minimax-m3:cloud` is itself retired or if a
subsequent eval run shows a hard-gate failure on vision/OCR cases
specifically (e.g. OCR output relabeled `exact_verified`, or an embedded
image instruction followed).

## Acceptance Criteria

- This record is accepted by the user or remains explicitly blocked.
- `docs/decisions/INDEX.md` matches this record's status.
- `docs/RISK_REGISTER.md` references this approval alongside R-017/R-018/R-019.
- Both real-image transcription cases (`MM-017`, `MM-018`) pass in the
  retained live-eval evidence.
- Zero hard-gate failures in the retained live-eval evidence.
- `modelEligibility` remains `not_evaluated` until acceptance is explicitly
  recorded.
- No production confidential processing is approved by this record.
- The `gemini-3-flash-preview` retirement finding is recorded (not silently
  dropped) and resolved via `DEC-0013`, cross-referenced in
  `ACTIVE_MILESTONE.md` and `docs/RISK_REGISTER.md` (R-024, `Mitigated`).
