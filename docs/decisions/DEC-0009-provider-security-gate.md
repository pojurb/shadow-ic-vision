# DEC-0009 - M001 Provider Security Gate

Status: `proposed`

Date proposed: 2026-07-07

Approving authority: user

## Context

DEC-0008 requires OCR, vision, table, chart, and XBRL handling for M001.
Commit `c08aae19a311ab44c488bc87cba759d43795b970` implemented the first
deterministic multimodal slice with fixture-backed extraction boundaries,
evidence-class preservation, persistence, export/import, UI labels, and an
M001 multimodal evaluator scaffold.

That implementation deliberately did not approve or connect a real OCR engine,
vision model, cloud model, or production confidential-data processor. ADR-0006
still blocks uncontrolled provider use and requires the application to own the
provider boundary, outbound logging, and approval record for data classes that
leave the local runtime.

The next M001 decision is whether POC development may use an externally hosted
LLM or processor for real workflow inputs even though the model is not hosted
locally. The user direction for this proposal is to make externally hosted
processing the default POC path, while keeping production use and provider
selection explicitly governed.

## Decision Requested

Approve the following provider/security gate for the next M001 slice:

1. Authorize POC external processing through the project-owned provider
   boundary as the default development path for M001.
2. Allow POC inputs, including confidential-class thesis, assumption,
   decision, conversation, and user-provided evidence text required to exercise
   the workflow, to be sent to the configured POC provider only in development
   and only through audited application adapters.
3. Keep `modelEligibility: not_evaluated` for every provider and model until
   the accepted baseline and multimodal gates are run against that exact
   provider, model, version, settings, and data boundary.
4. Require a separate production provider decision before POC permission is
   carried into production, demo, hosted, or multi-user use.
5. Keep secrets, credentials, brokerage account data, account screenshots,
   raw database exports, and personal identity documents blocked from external
   providers unless a later decision explicitly allows that narrower class.

This decision does not permanently approve Ollama Cloud, OpenAI, Google,
Anthropic, AWS, Azure, or any other cloud service for production confidential
data. It defines a POC-only processing gate and requires the active provider,
model, endpoint, settings, and outbound logs to be recorded before use.

## Data Classification Gate

| Data class | Examples | POC default before production approval |
|---|---|---|
| Public market data | SEC/IDX filings, public issuer pages, public ticker metadata | Yes |
| Synthetic fixtures | Generated PDFs/images, fake company data, redacted test cases | Yes |
| POC workflow confidential data | Thesis text, assumptions, decisions, conversation text, and user-provided evidence needed to exercise M001 | Yes, only through the configured POC provider boundary with outbound logging |
| Restricted personal or financial secrets | API keys, credentials, account numbers, brokerage screenshots, raw database exports, identity documents, and unrelated personal files | No |
| Production confidential processing | Any confidential JP Invest data sent to a remote model, OCR API, vision API, hosted browser, or hosted parser in production or hosted demo use | No until a production provider decision is accepted |

## Provider Approval Requirements

A later provider-specific decision must record:

- provider name, product, model or engine identifier, and version pinning;
- whether processing is local-only, LAN, hosted cloud, or vendor-managed cloud;
- exact data classes allowed and blocked;
- whether the approval is POC-only or production-eligible;
- retention, deletion, training-use, logging, subprocessors, and region terms;
- authentication, secret handling, and outbound logging behavior;
- for externally hosted POC providers, confirmation that all calls go through
  the project-owned provider adapter and that no unrelated `fetch` or SDK path
  can bypass the data-class gate;
- for local-only engines, confirmed zero-network-egress, no outbound
  telemetry, no auto-update checks during processing, isolated temporary files,
  cleanup behavior, and pinned engine version;
- incident response and revocation path;
- reproducible eval command and report path;
- evidence that baseline M001 and multimodal hard gates passed; and
- UI disclosure language for users when that provider is active.

Provider marketing claims are not enough. Terms and technical behavior must be
verified from current primary sources at the time of provider-specific review.

## Next Slice Authorized If Accepted

If accepted, the next implementation slice may:

- add a POC external-provider gate behind the existing project-owned provider
  and extractor interfaces;
- process public, synthetic, redacted, explicitly non-confidential, and
  POC workflow confidential inputs through the configured POC provider;
- record engine/version metadata and deterministic degraded states;
- extend the evaluator to report POC provider readiness and data-boundary
  behavior; and
- keep product model selection disabled until provider/model eligibility is
  explicitly evaluated.

The next implementation slice may not:

- send restricted personal or financial secrets to any external provider;
- treat POC external processing permission as production approval;
- expose a model as selectable based on this decision alone;
- use native provider browsing, native PDF parsing, or model-generated
  arithmetic as a substitute for application-owned verification; or
- relabel OCR, table, chart, or calculated output as `exact_verified`.

## Acceptance Criteria

- `docs/decisions/INDEX.md` lists DEC-0009 with matching `proposed` or
  accepted status.
- `ACTIVE_MILESTONE.md` and `SESSION_CHECKPOINT.md` point to this gate as the
  next M001 decision.
- `docs/RISK_REGISTER.md` references this gate for confidential cloud-provider
  risk.
- The configured POC provider, model, endpoint, settings, and allowed data
  classes are visible in local configuration or release evidence.
- Outbound provider calls are logged with provider, route, data class,
  timestamp, and allowed/blocked outcome without storing full confidential
  payloads in the log.
- Tests or evaluator output prove restricted personal or financial secrets
  fail closed for external provider routes.
- The most recent M001 multimodal evaluator report records
  `modelEligibility: not_evaluated`.
- No provider/model is marked selectable or eligible by this decision.
- No production external processing occurs before a production provider
  approval record is accepted.

## Options Considered

1. Block all external processing of confidential POC inputs.
2. Require a local self-hosted model before any real thesis workflow can be
   exercised.
3. Allow externally hosted provider processing by default for POC, with a
   controlled provider boundary, outbound logging, blocked secret classes,
   `modelEligibility: not_evaluated`, and a separate production decision.

Option 3 is the proposed path. It reflects the practical constraint that the
current POC uses an externally hosted LLM while still preventing POC permission
from silently becoming production approval.

## Consequences If Accepted

- M001 can continue with realistic externally hosted LLM behavior during POC.
- Provider selection becomes an explicit later decision with current-source
  review rather than an implied permanent implementation detail.
- The evaluator may record POC readiness, but model/provider eligibility
  remains `not_evaluated` until the full gate is run.
- Additional work is required before external OCR/vision or LLM processing can
  be used in production or hosted demo contexts.
- POC data can leave the local machine; this is an explicit accepted privacy
  and provider-risk tradeoff for development speed.

## Reversal Or Supersession

Supersede this decision if the user accepts a provider-specific security record
or if M001 reverts to deterministic-only multimodal support. Reversal must keep
historical evidence and must not retroactively approve any confidential-data
processing that occurred before an accepted provider decision.

## Affected Files If Accepted

- `ACTIVE_MILESTONE.md`
- `SESSION_CHECKPOINT.md`
- `docs/RISK_REGISTER.md`
- `docs/decisions/INDEX.md`
- local OCR/vision adapter and evaluator files in a later implementation slice
