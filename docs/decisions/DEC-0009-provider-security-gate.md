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
vision model, cloud model, or confidential-data processor. ADR-0006 still
blocks thesis text, assumptions, decisions, user-provided evidence, portfolio
data, and personal investment information from unapproved cloud providers.

The next M001 decision is whether real OCR/vision work proceeds through a
cloud provider that may process confidential data, or through a local-only path
while cloud approval remains deferred.

## Decision Requested

Approve the following provider/security gate for the next M001 slice:

1. Keep all cloud providers unapproved for confidential JP Invest data until a
   separate provider-specific approval record is accepted.
2. Authorize local-only OCR/vision exploration using synthetic fixtures, public
   filings, and non-confidential test documents.
3. Keep `modelEligibility: not_evaluated` for every provider and model until
   the accepted baseline and multimodal gates are run against that exact
   provider, model, version, settings, and data boundary.
4. Require a provider-specific decision before any cloud processor receives
   confidential thesis, assumption, decision, user-provided evidence,
   portfolio, or personal investment data.

This decision does not approve Ollama Cloud, OpenAI, Google, Anthropic, AWS,
Azure, or any other cloud service for confidential data. It only defines the
gate and permits a local/synthetic next slice.

## Data Classification Gate

| Data class | Examples | Allowed before provider approval |
|---|---|---|
| Public market data | SEC/IDX filings, public issuer pages, public ticker metadata | Yes |
| Synthetic fixtures | Generated PDFs/images, fake company data, redacted test cases | Yes |
| Local confidential user data | Thesis text, assumptions, decisions, user-provided evidence, portfolio notes | Local-only engines may process it; cloud providers may not |
| Cloud confidential processing | Any confidential user data sent to a remote model, OCR API, vision API, hosted browser, or hosted parser | No |

## Provider Approval Requirements

A later provider-specific decision must record:

- provider name, product, model or engine identifier, and version pinning;
- whether processing is local-only, LAN, hosted cloud, or vendor-managed cloud;
- exact data classes allowed and blocked;
- retention, deletion, training-use, logging, subprocessors, and region terms;
- authentication, secret handling, and outbound logging behavior;
- incident response and revocation path;
- reproducible eval command and report path;
- evidence that baseline M001 and multimodal hard gates passed; and
- UI disclosure language for users when that provider is active.

Provider marketing claims are not enough. Terms and technical behavior must be
verified from current primary sources at the time of provider-specific review.

## Next Slice Authorized If Accepted

If accepted, the next implementation slice may:

- add a local OCR/vision adapter boundary behind the existing extractor
  interfaces;
- run it only on synthetic fixtures, public filings, or explicitly
  non-confidential local test documents;
- record engine/version metadata and deterministic degraded states;
- extend the evaluator to report local-engine readiness; and
- keep product model selection disabled until provider/model eligibility is
  explicitly evaluated.

The next implementation slice may not:

- send confidential user data to a cloud provider;
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
- No provider/model is marked selectable or eligible by this decision.
- No cloud provider receives confidential data before a provider-specific
  approval record is accepted.

## Options Considered

1. Approve a cloud provider now.
2. Keep all real OCR/vision work blocked until a cloud provider is selected.
3. Approve the gate and continue local-only/synthetic real-engine exploration
   while cloud confidential-data approval remains deferred.

Option 3 is the proposed path. It keeps M001 moving without weakening the
privacy and evidence boundaries already accepted in ADR-0006 and DEC-0008.

## Consequences If Accepted

- M001 can continue with local-only real-engine exploration while preserving
  the current cloud confidentiality block.
- Provider selection becomes an explicit later decision with current-source
  review rather than an implied implementation detail.
- The evaluator may record local-engine readiness, but model/provider
  eligibility remains `not_evaluated` until the full gate is run.
- Additional work is required before cloud OCR/vision can be used with real
  thesis or portfolio data.

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
