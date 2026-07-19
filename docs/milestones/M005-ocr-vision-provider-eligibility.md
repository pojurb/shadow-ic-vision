# M005: OCR/Vision Provider Eligibility

Status: `accepted`

Approval authority: user

Candidate provider/model: `gemini-3-flash-preview` (Ollama Cloud, already
allowlisted under DEC-0010), fallback `minimax-m3:cloud` if the live pass
shows hard-gate failures or fails to genuinely process real image input.

---

## 1. User-Visible Outcome

The multimodal evidence pipeline scaffolded since DEC-0008 (distinct
`exact_verified` / `ocr_matched` / `derived` evidence classes for text-layer
PDFs, scanned documents, screenshots, tables, charts, and XBRL) becomes
usable with a real OCR/vision provider instead of only synthetic fixtures.
The user sees scanned IDX filings and screenshot evidence processed with the
same trust-class labeling already visible in the Research drawer, backed by
an actual model run rather than deterministic mock output.

This milestone does **not** make that provider selectable in production. It
answers one question: is a specific OCR/vision provider/model eligible for
continued POC use, the same way DEC-0010 answered that question for
text-only Kimi.

---

## 2. Scope and Non-Goals

### In Scope
- **Provider-eligibility eval run:** Execute the existing
  `scripts/eval-m001-provider.ts` / `scripts/eval-m001-multimodal.ts`
  harnesses against a real candidate OCR/vision provider and model, using the
  same `--mode deterministic` / `--mode live` split DEC-0010 used.
- **Vision capability metadata:** Populate `modelMetadata.vision` /
  `getCapabilities().vision` (already present in the eval scaffold) for the
  candidate model.
- **Eligibility decision record:** A new decision (numbered after DEC-0011)
  recording the candidate provider/model, POC-only scope, and eval results —
  following the DEC-0010 format (provider approval requirements checklist).
- **Evidence-class regression coverage:** Confirm `ocr_matched` and `derived`
  evidence produced by the real provider still passes the existing
  never-`exact_verified` guard.

### Out of Scope
- Production or hosted-demo approval for any OCR/vision provider (M006).
- Selecting or exposing the OCR/vision provider in the app's model selector
  ahead of an accepted eligibility decision.
- New evidence classes beyond `exact_verified` / `ocr_matched` / `derived`.
- Secondary-source or general-news ingestion (M007).

---

## 3. Workflows, States, and Recovery Behavior

### Workflow 1: Candidate Selection
1. Candidate chosen: `gemini-3-flash-preview` (Ollama Cloud), already
   allowlisted under DEC-0010; fallback `minimax-m3:cloud`. See "Options
   Considered" for the resolved rationale.
2. The candidate is wired behind the existing project-owned provider
   boundary (`lib/ai/`), reusing the DEC-0009 gate and outbound logging —
   no new bypass path is introduced. **Discovered during scoping:** this
   wiring is not a no-op — no code path in `lib/ai/provider.ts` or
   `lib/ai/adapters/ollama.ts` can send a real image to any provider today.
   See new Slice 0 below.

### Workflow 2: Deterministic Eligibility Pass
1. Run `eval:m001:provider -- --mode deterministic --model <candidate>`.
2. Confirm provider-boundary cases (the six DEC-0009 cases already in the
   evaluator) pass unchanged.
3. Confirm `modelEligibility` remains `not_evaluated` until the live pass
   below also succeeds.

### Workflow 3: Live Eligibility Pass (Local, Confidential-Boundary Run)
1. Run `eval:m001:provider -- --mode live --model <candidate>` against real
   scanned-document/screenshot fixtures.
2. Record hallucination rate, extraction completeness, and hard-gate failure
   count, mirroring the Kimi live-eval report format
   (`docs/evidence/releases/2026-07-09-kimi-provider-eval/`).
3. *Failure Recovery:* Any hard-gate failure (e.g. OCR output relabeled as
   `exact_verified`, or injection-case failure) blocks eligibility; the
   candidate remains `not_evaluated` and the milestone does not close.

### Workflow 4: Decision Recording
1. On a clean live-eval pass, draft and accept a new provider-eligibility
   decision recording the checklist items from DEC-0009's "Provider Approval
   Requirements," scoped POC-only.
2. Update `ACTIVE_MILESTONE.md` and the decisions INDEX.

---

## 4. Data Inputs, Outputs, and Persistence Rules

No new persisted data model — this milestone exercises the existing
evidence/evaluator schema (`evidence.verificationStatus`:
`exact_verified` | `ocr_matched` | `derived`) already shipped under DEC-0008.
Eval reports are written to `test-results/` and retained release evidence
under `docs/evidence/releases/`, matching the existing DEC-0010 pattern. No
change to `db/schema.ts`.

---

## 5. Implementation Slices

- **Slice 0 (discovered during scoping): Image/Attachment Plumbing.**
  `lib/ai/provider.ts`'s `ProjectMessage` is plain-text only and
  `lib/ai/adapters/ollama.ts` never attaches image bytes — the existing
  "multimodal" fixtures are JSON *descriptions* of documents, not real
  image files. Before Slice 1 can mean anything, add an optional
  `attachments` field to `ProjectMessage`, wire the Ollama adapter to send
  real base64 image bytes, extend `MockProvider` to accept attachments as a
  no-op passthrough, and wire the real extraction seam already left open in
  `lib/research/extractors/document.ts` (`unsupported_visual` /
  `scanned_document` throws) to call the real provider through the existing
  `createOcrCandidate` contract. Produce 2-3 genuine (Playwright-rendered,
  not JSON-described) image fixtures since none exist in the repo today.
- **Slice 1:** Wire the candidate OCR/vision provider behind the existing
  `lib/ai/` provider boundary and adapter interface (no new bypass path).
- **Slice 2:** Run the deterministic eligibility pass; fix any fixture gaps
  the real provider surfaces that synthetic fixtures didn't.
- **Slice 3:** Run the live eligibility pass against real scanned/screenshot
  inputs under the DEC-0009 POC boundary; produce a retained evidence
  manifest.
- **Slice 4:** Draft and accept the provider-eligibility decision record;
  update `ACTIVE_MILESTONE.md`, `SESSION_CHECKPOINT.md`, and the decisions
  INDEX.

---

## 6. Security and Provider Constraints

- Stays entirely within the DEC-0009 POC gate; this milestone does not
  request or imply production approval (that is M006's scope).
- Blocked data classes are unchanged: restricted personal/financial secrets
  and portfolio/position data (per DEC-0011) never reach the OCR/vision
  provider.
- `modelEligibility` for the candidate stays `not_evaluated` until both the
  deterministic and live passes are clean, per DEC-0009 §3.
- OCR/derived output must never be relabeled `exact_verified` (R-017); the
  existing regression coverage in the multimodal evaluator must keep passing
  unchanged.
- All document content (scanned PDFs, screenshots) is treated as untrusted
  input per R-018; no instruction embedded in a document may alter
  extraction behavior or trigger tool use.

---

## 7. Evals & Acceptance Criteria

### Acceptance Criteria (AC)
1. **AC-M005-01: Deterministic Eligibility Pass** — The candidate
   OCR/vision model runs against the existing deterministic multimodal suite
   with zero hard-gate failures and `modelEligibility: not_evaluated`
   (pre-live-pass state correctly reported).
2. **AC-M005-02: Live Eligibility Pass** — A live run against real scanned
   and screenshot fixtures completes with 0% hallucination rate on
   `exact_verified`-class claims and no evidence-class mislabeling.
3. **AC-M005-03: Evidence-Class Integrity** — OCR and derived outputs from
   the real provider are persisted and rendered with correct
   `ocr_matched` / `derived` labels, never `exact_verified`.
4. **AC-M005-04: Decision Record Acceptance** — A new decision recording the
   candidate's POC eligibility is accepted, following DEC-0009's Provider
   Approval Requirements checklist.

### Deterministic Tests
- Existing `tests/` multimodal/evidence-class coverage continues to pass
  unchanged with the real provider wired in (no new evidence classes, no
  relaxed assertions).

### Model Evals (Golden Dataset)
- Reuse the existing 16 base + 16 multimodal-addendum cases
  (`docs/evals/M001/`), plus the 6 DEC-0009 provider-boundary cases.
- **Pass Thresholds** (same bar as DEC-0010's Kimi eval):
  - Hallucination rate on exact-verified claims: **0%** (hard requirement).
  - Hard-gate failures: **0**.
  - Extraction completeness: **>90%**, matching the standard already met by
    the text-only provider eval.

---

## 8. Assumptions, Risks, and Explicit Deferrals
- **Assumption:** A suitable OCR/vision-capable model is reachable through
  the same POC provider path already governed by DEC-0009 (or a comparably
  governable alternative); if not, this milestone's scope reduces to
  documenting why no candidate is currently eligible.
- **Risk:** R-017 (OCR/derived output mistaken for source-exact), R-018
  (embedded document injection), R-019 (multimodal scope/cost/latency
  creep) — all open, all directly in scope for this milestone's evals.
- **Deferral:** Production/hosted-demo approval (M006), provider selection
  in the app's UI ahead of an accepted decision, and any new evidence class
  beyond the three already defined are explicitly out of scope here.

## Options Considered

1. Reuse the existing text-only Ollama Cloud provider if it exposes a
   vision-capable model in the same allowlist family — lowest integration
   effort, reuses the already-approved DEC-0010 boundary. **Adopted:**
   `gemini-3-flash-preview` (fallback `minimax-m3:cloud`) — both already
   declare `vision: true` in `lib/ai/ollama-models.ts`, and Gemini 3 Flash
   Preview's registry description explicitly calls out "image workflows."
2. Introduce a separate, purpose-built OCR/vision provider or local engine
   — potentially better extraction quality, but requires its own
   provider-boundary wiring and a fresh DEC-0009-style adapter review.
   Rejected for this milestone: no evidence yet that Option 1 is
   insufficient, and it would duplicate governance work already done for
   the existing allowlist.
