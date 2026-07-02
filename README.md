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
> **Phase: Product Strategy** — `VISION.md` has been formally approved by the user.
> `docs/PRODUCT_STRATEGY.md` is now in progress to define the first vertical
> slice (the wedge) before authorizing any architecture or implementation.
