# DEC-0016 - Provider Boundary For The Optional Evidence Polarity Classifier

Status: `accepted`

Date proposed: 2026-08-03

Date accepted: 2026-08-03

Approving authority: user

Supersedes: none

Amends: none. Scoped strictly inside [`DEC-0009`](DEC-0009-provider-security-gate.md)'s existing POC provider gate and [`DEC-0010`](DEC-0010-ollama-cloud-poc-approval.md)'s model allowlist; it adds a new *call site*, not a new provider, model, or data class.

## Context

M011 introduces evidence **polarity** — whether a retrieved piece of evidence supports, contradicts, or is inconclusive about the assumption it was retrieved for. Before M011, evidence carried topical relevance and nothing else, so a fact that *falsified* an assumption looked identical to one that supported it. A multi-model QA audit of a TSLA thesis found exactly this: an automotive gross margin of 16.9% was retrieved against a thesis requiring above 20%, presented as the fourth of five neutral bullets, and the thesis still read as intact.

The primary mechanism M011 ships is **deterministic**: a measurement contract on each assumption states a metric, operator, threshold, unit, and time basis, and `classifyPolarity` (`lib/research/polarity.ts`) compares a structured fact against it by arithmetic. That path involves no provider call and is not the subject of this record.

Deterministic classification cannot answer for a *qualitative* assumption ("regulatory costs do not materially delay monetization"), which the measurement contract marks `not_measurable` by construction. Such assumptions would remain permanently `inconclusive`. M011 therefore also ships an **optional, off-by-default** `PolarityClassifier` seam (`lib/research/polarity-classifier.ts`) that could supply a direction for those, via a real provider call over evidence text.

This record exists because of a specific prior incident rather than as a formality. On 2026-07-29 an analogous optional classifier (`InstructionClassifier`, R-018's multilingual mitigation) was wired in by default. Independent review found it did not gate on `getResearchSourceMode()`, so deterministic mock research would have made live provider calls wherever `LLM_PROVIDER_TYPE=ollama` was configured — violating the invariant that mock research stays fully offline — with no test coverage of the default-wiring path and **no scoped decision behind it**. It was reverted (`git revert d420a33`) rather than patched. See `docs/RISK_REGISTER.md` R-018.

M009 and M010 both argued, correctly, that they needed no new decision record because they changed no product boundary, evidence class, trust tier, provider, or data classification. M011 clears that same bar on everything **except** this seam, which is a new provider call over document-derived text. Shipping it without a record would repeat precisely the omission that caused the 2026-07-29 revert.

## Decision Requested

Approve a narrowly scoped provider boundary for an optional evidence-polarity classifier: what it may be sent, what it may influence, when it is permitted to run at all, and what must remain true whether or not it is ever enabled.

## Approved Scope If Accepted

1. **Off by default, and constructed by nothing.** No code path in this repository builds a `PolarityClassifier`. A caller must call `createPolarityClassifier` explicitly and pass it through `ServiceDependencies.polarityClassifier`. The running application's polarity coverage is deterministic-only.

2. **Gated on research source mode.** `resolvePolarityClassifier` returns `undefined` unless `getResearchSourceMode() === 'live'`. Mock research can never reach a provider through this path, regardless of how a caller configures it or what `LLM_PROVIDER_TYPE` is set to. This is the specific gate whose absence caused the 2026-07-29 revert, and it is proven by a test asserting `structuredExtract` is called exactly zero times during a full `processResearchJobs` run under mock mode.

3. **Deterministic answers are never overridden.** The classifier is consulted only where `classifyPolarity` returned `inconclusive` **and** the reason is one a language model could legitimately resolve — `not_measurable` (a qualitative claim) or `no_observed_value` (a resolved claim whose evidence carries no structured value). It is never consulted for:
   - `numeric_threshold`, where arithmetic has already answered;
   - `unit_mismatch` or `time_basis_mismatch`, which are **structural refusals**. Letting a model talk the system out of the balance-versus-flow refusal would reopen the exact defect that gate closes.

4. **A model judgment can never masquerade as a measurement.** A classifier-supplied polarity is persisted with `polarity_method = 'model_classified'` and `delta_vs_threshold = null`. The deterministic verdict (`lib/research/verdict.ts`) escalates a thesis to `breached` **only** on `numeric_threshold` evidence; a model-classified contradiction can raise a thesis to `at_risk` and be counted, but can never produce a quantified breach headline or a number.

5. **Data classification is unchanged.** The classifier is sent an assumption statement and one evidence quote, under `dataClass: 'poc_workflow_confidential'` — the same class the existing `generateDecisionRecommendation` and chat-intake calls already use, permitted by DEC-0009 through the project-owned provider boundary. Portfolio and position data, recorded decision outcomes (DEC-0011), and every other blocked class remain blocked; nothing in this seam reads them.

6. **Fails closed to no verdict.** Any error — thrown, rejected, or a soft `structuredExtract` failure — yields `inconclusive`. This is deliberately the opposite direction from `createInstructionClassifier`, which fails closed to *flagged*: there, a missed injection is worse than a spurious banner; here, a fabricated "supports" on a thesis the evidence actually undermines is the precise harm M011 exists to prevent.

7. **The prompt treats evidence as untrusted data.** The classifier's system prompt instructs it to report direction only, never to follow directives inside the passage, never to evaluate whether the assumption is wise, and never to recommend buying, selling, holding, reducing, or exiting — matching the persona constraint every other prompt in this application carries.

## Risk Register Effects

- **R-027** (new, `Open` → `Mitigated` on M011 closure): *A contradicting fact is retrieved but presented neutrally, so a breached thesis reads as intact.* This record governs only the optional model-assisted portion of that mitigation. The deterministic portion is not governed here and is not conditional on this record.
- **R-018** (`Open`, unchanged): this record does not close, narrow, or reopen it. It deliberately reuses the lesson from R-018's reverted change without claiming to resolve R-018 itself.
- **R-003** (`Open`, unchanged): the POC provider leg remains live; this adds a call site inside it, not a new leg.

## Eval And Verification Path

- `tests/polarity.test.ts`: the seam is never consulted under mock mode; never consulted once arithmetic has answered; never consulted on a structural refusal; consulted for a qualitative claim and recorded as `model_classified` with a null delta; and a declining classifier leaves the deterministic answer intact.
- `MM-025` (`docs/evals/M001/multimodal-cases.json`): confirms the **deterministic** path reports the audit's headline breach as `contradicts` with a −3.1 delta, with a hard gate that fires if it does not. Deliberately does not exercise the classifier, which is unreachable in the evaluator.
- No live model eval is required to accept this record, because accepting it enables nothing: the seam remains unconstructed. A live eval becomes required before any future change actually wires a classifier in, and that change needs its own milestone packet.

## Revocation And Incident Response

Revocation is a code deletion, not a configuration change: remove `createPolarityClassifier` and the `polarityClassifier` dependency field. Because nothing constructs one, revocation has no effect on stored data and no migration.

If a future enablement is found to have produced misleading polarity, the remedy is the same shape as M010's evidence cleanup: `polarity_method = 'model_classified'` is queryable, so every affected row can be identified exactly and reset to `inconclusive` without touching deterministically classified evidence.

## Acceptance Criteria

1. Nothing in the repository constructs a `PolarityClassifier`; the seam ships unexercised in production. *(Verifiable by grep.)*
2. A full `processResearchJobs` run under `RESEARCH_SOURCE_MODE=mock` makes zero `structuredExtract` calls even with a classifier configured and `LLM_PROVIDER_TYPE=ollama`. *(Proven by test.)*
3. A classifier-supplied polarity is distinguishable in the database from a measured one, and cannot produce a `breached` verdict. *(Proven by test.)*
4. Both structural refusals (`unit_mismatch`, `time_basis_mismatch`) remain unreachable by the classifier. *(Proven by test.)*

## Options Considered

1. **Ship the seam under a narrow decision record (adopted).** Records the boundary before the capability exists, which is the sequencing R-018's revert established as necessary. Costs one document; the alternative cost is discovering the boundary during an incident.
2. **Ship the seam with no decision record, arguing it is inert (rejected).** This is precisely the argument available on 2026-07-29 — the classifier was optional then too — and it did not survive review. "Inert today" is a property of the current call sites, not of the code.
3. **Drop the seam entirely and ship deterministic polarity only (rejected, but reasonable).** Deterministic polarity carries the whole of M011's value, and the seam ships as unexercised code. Rejected because qualitative assumptions are the majority of a real thesis, and building the boundary now — with the gate, the method distinction, and the tests — is what makes a later decision to enable it a small, reviewable change rather than a redesign. Recorded here so the trade-off is visible rather than assumed.
4. **Let the classifier override deterministic results when it disagrees (rejected).** A measured breach is arithmetic over a filed fact. There is no reading under which a model opinion improves it, and the structural refusals exist precisely because plausible-looking wrong answers are the failure mode.

## Consequences If Accepted

- One new provider call site exists in the codebase, reachable only by explicit configuration and only in live research mode.
- M011 may close with R-027 marked `Mitigated` on the strength of its deterministic mechanisms, with the model-assisted portion recorded as available-but-unexercised residual scope rather than as delivered coverage.
- Any future change that constructs a classifier by default requires its own milestone packet, live eval, and an amendment to this record — it is not authorized here.

## Affected Files If Accepted

- `lib/research/polarity-classifier.ts` (the seam, the gate, and the resolution order)
- `lib/research/polarity.ts` (`model_classified` as a distinct method)
- `lib/research/service.ts` (`ServiceDependencies.polarityClassifier`, threaded but never defaulted)
- `lib/research/verdict.ts` (escalates to `breached` only on `numeric_threshold`)
- `tests/polarity.test.ts` (the gate and ordering tests)
- `docs/RISK_REGISTER.md` (R-027)
