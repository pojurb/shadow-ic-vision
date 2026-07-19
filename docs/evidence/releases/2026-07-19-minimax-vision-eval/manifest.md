# MiniMax M3 OCR/Vision Eligibility Eval Evidence

Date: 2026-07-19

Branch: `main`

Outcome: `live minimax-m3:cloud eval successfully executed with zero hard gate failures; both real-image vision cases passed`

## Scope

- M005 OCR/vision provider eligibility eval, following the fallback path
  named in the M005 packet's "Options Considered" after the primary
  candidate (`gemini-3-flash-preview`) was found retired (see the sibling
  `2026-07-19-gemini-vision-eval` evidence directory).
- Exercises the new real image-attachment path (`ProjectMessage.attachments`,
  `lib/ai/adapters/ollama.ts`) against two genuine, Playwright-rendered image
  fixtures under `docs/evals/M001/fixtures/vision/` — not JSON-described
  synthetic fixtures.

## Commands And Results

| Check | Result |
|---|---|
| `npm run eval:m001:provider -- --mode deterministic --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/01-deterministic-report.json` | Pass; deterministic baseline loaded, 16 base cases, 18 multimodal cases, 6 provider-boundary cases passed |
| `npm run eval:m001:provider -- --mode live --model minimax-m3:cloud --output docs/evidence/releases/2026-07-19-minimax-vision-eval/02-live-report.json` | Pass; 14/37 cases passed, 0 hard-gate failures, 0% citation hallucination rate, ~90% assumption extraction completeness |

## Real-Image Case Results

| Case | Fixture | Result |
|---|---|---|
| `MM-017` | `pltr-gross-margin-scan.png` (English filing excerpt) | Pass — transcription matched candidate quote exactly |
| `MM-018` | `bbri-nim-scan.png` (Indonesian filing excerpt) | Pass — transcription matched candidate quote exactly |

## Artifacts

- [`01-deterministic-report.json`](01-deterministic-report.json)
- [`02-live-report.json`](02-live-report.json)

## Live-Run Status

- `LLM_PROVIDER_TYPE` was set to `ollama` for the local POC run.
- `OLLAMA_API_KEY` was supplied via local environment.
- Live provider calls completed successfully with zero schema validation
  errors on the vision-specific cases.
- Transcript artifacts (including base64 image payloads) were generated and
  stored only in gitignored local provider-eval transcript folders.

## Transcript Retention Rule

Full prompt/response transcripts, including attached image bytes, are
retained only under the gitignored local provider-eval transcript directory
referenced by the eval report. They are not copied into outbound logs,
tracked docs, or learning artifacts.

## Known Limits

- [`DEC-0012`](../../decisions/DEC-0012-ocr-vision-provider-eligibility.md)
  is now `accepted`. `minimax-m3:cloud` is approved for POC OCR/vision
  workflow use only.
- `modelEligibility` remains `not_evaluated` for production. This evidence
  does not approve `minimax-m3:cloud`, Ollama Cloud, or any other model for
  production confidential processing.
- `extractVisionOcrCandidate` (`lib/research/extractors/ocr.ts`) is not yet
  wired into `CitationPipeline`'s automatic extraction-recovery path.
