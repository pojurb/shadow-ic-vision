# Codex Protocol (v3)

An AI-assisted Investment Committee for serious self-directed investors.

## What This Is
A system that tracks your investment theses, challenges your assumptions with
cited evidence and explicit uncertainty, and turns scattered conviction into
disciplined decisions through a weekly IC Briefing.

## How We Build This
This project is governed by the model-neutral operating playbook in
[`AGENTS.md`](AGENTS.md). Codex reads it directly; Claude Code and Gemini CLI
load it through thin `CLAUDE.md` and `GEMINI.md` adapters. Detailed delivery,
quality, security, and release controls live under `.agents/`. Ollama-backed
models inherit the playbook through their coding-agent client; raw model or API
sessions must inject it explicitly.

The build sequence is strict:
1. Approve Vision (`VISION.md`)
2. Define product strategy, the first wedge, and risks
3. Approve a versioned milestone packet and update `ACTIVE_MILESTONE.md`
4. Create the Golden Dataset, grading rubric, and deterministic checks
5. Record milestone-specific architecture decisions
6. Implement, independently review, verify, and retain evidence
7. Approve, release, observe, and retain rollback capability

## Current Status
> **Phase: Evaluation Ready** — The M001 Milestone Packet is formally approved.
> We are now creating the Golden Dataset and grading rubric under `docs/evals/M001/`
> to define the strict behavior contract for the first wedge.

## Artifact Standards

To keep the repository clean, all artifact formatting rules are consolidated here.

### Decision Records (`docs/decisions/`)
Record approved product and architecture decisions here using stable identifiers (`DEC-####-*.md` for product/policy/risk, `ADR-####-*.md` for architecture). Each record must include: Status, Date, Approving Authority, Context, Options, Decision/Rationale, Consequences, Reversal path, and Affected files. Vision approval must be explicit here before milestone planning.

### Milestone Packets (`docs/milestones/`)
Create immutable, versioned packets (e.g., `M001-thesis-intake.md`). `ACTIVE_MILESTONE.md` points to exactly one active packet. Packets must contain: Status, User outcome, Scope/non-goals, Workflows/states, Data rules, Implementation slices, Security constraints, Eval criteria, Risks, and Closure evidence. Do not overwrite completed packets; use decisions and new packets for changes.

### Evaluation Artifacts (`docs/evals/`)
Store milestone-specific evaluation assets under `docs/evals/M###/`. Each set includes: Acceptance criteria covered, Sanitized input fixtures, Scoring rubric/hard-failures, Pass thresholds, Edge cases (normal, adversarial, missing-data), Held-out cases (not used in builder loops), Metadata (model, prompt version), and Reproduction instructions. Evals do not replace deterministic QA.

### Release & Verification Evidence (`docs/evidence/releases/`)
Store verification/release packages in unique directories (e.g., `docs/evidence/releases/2026-07-01-M001-preview/`). Manifests must record: Commit SHA, Milestone covered, Exact commands run, Pass/fail results, Model metadata, Screenshots/reports, Known risks, Rollback procedure, and Final outcome. Never commit secrets or confidential user data here.
