# DEC-0001 - Canonical Multi-Model Playbook

Status: `accepted`

Date: 2026-07-01

Approving authority: user

## Context

The project is operated with Codex, Claude, Gemini, and Ollama-hosted open
models. Separate complete playbooks would drift and could produce conflicting
delivery, quality, security, or release behavior.

## Options Considered

1. Maintain a complete playbook for each model provider.
2. Keep one model-neutral playbook and thin provider-specific loader adapters.
3. Keep policy only under `.agents/` and require every tool to discover it
   manually.

## Decision

Use root `AGENTS.md` as the canonical shared playbook. Claude Code imports it
through `CLAUDE.md`; Gemini CLI imports it through `GEMINI.md`; Codex loads it
directly. Ollama-backed workflows inherit it through their coding-agent client
or must inject it explicitly when using a raw API or model session.

Detailed controls are partitioned by ownership under `.agents/` rather than
duplicated across model entrypoints. Every playbook change must update the
canonical file, the owning module, and any affected status, template, or
evidence file.

## Consequences

- Shared rules have one authoritative copy.
- Provider adapters remain small and auditable.
- Direct raw-model workflows require explicit context injection.
- Hard controls still require later CI, hooks, permissions, and branch
  protection; Markdown instructions alone are not enforcement.

## Reversal Or Supersession

Supersede this record if a future agent platform can load a different shared
standard more reliably. Migration must preserve one canonical source and update
all adapters and references in the same change.

## Affected Files

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.agents/*.md`
- `README.md`
- `ACTIVE_MILESTONE.md`
