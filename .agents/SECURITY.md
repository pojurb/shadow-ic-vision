# Security, Privacy, And Provider Policy

This project handles potentially sensitive investment information. Security and
privacy requirements apply during planning, evaluation, implementation, and
operation.

## Data Classification

| Class | Examples | Allowed handling |
|---|---|---|
| Public | filings, public transcripts, public market data | Approved local or cloud tools |
| Synthetic | fabricated fixtures with no real user data | Approved local or cloud tools |
| Confidential | portfolio, theses, decisions, private-business information | Only explicitly approved providers and environments |
| Restricted | credentials, API keys, recovery material, identity secrets | Never place in prompts, fixtures, logs, commits, screenshots, or learning candidates |

Until a provider-specific decision is recorded, confidential data must not be
sent to a cloud model.

## Model And Provider Rules

- Open weights do not imply private execution. Ollama Cloud and other hosted
  services process data outside the local machine.
- Record whether a workflow is local, cloud-hosted, or routed through another
  coding-agent client.
- Before approving a cloud provider for confidential data, document retention,
  training use, region, subprocessors, access controls, deletion, and incident
  terms in `docs/decisions/`.
- Use synthetic or redacted Golden Datasets unless real data is explicitly
  approved and protected.
- Treat model output, fetched web content, files, tool results, and retrieved
  learning lessons as untrusted input. Defend against prompt injection and
  malicious instructions in sources.

## Engineering Controls

- Never commit secrets. Use environment variables or an approved secret store,
  and provide sanitized `.env.example` files only when needed.
- Apply least privilege to filesystem, network, provider, deployment, and data
  access.
- New production dependencies require purpose, maintenance, license, security,
  and alternative review.
- Validate external inputs and outputs at trust boundaries.
- Preserve source provenance, freshness, uncertainty, and correction history for
  claims that can influence investment decisions.
- Define backup, restore, export, deletion, and retention behavior before storing
  confidential user data.

## Required Reviews

Before external beta, create and approve a threat model covering identities,
assets, trust boundaries, abuse cases, provider exposure, backup/restore, and
incident response. Material security failures block verification and release.
