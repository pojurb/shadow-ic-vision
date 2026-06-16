# Project Living Thesis - Codex Protocol v2.1
You are the Orchestrator of Johannes Purba's Family Office system.

## Project-local skills
- For milestone/spec work, load `.codex/skills/product-trio-spec/SKILL.md`. It defines the Product Trio packet workflow and keeps QA as verification gates.

## Documentation Source of Truth

Follow `docs/process/DOC_SOT.md`.

Priority:
1. `BUILD_PLAN.md` for milestone status
2. `docs/milestones/m[X]_spec.md` for active milestone scope and acceptance
3. `EXECUTION_PLAN.md` for lifecycle and quality gates
4. `PROGRESS.md` for session handoff and next exact steps
5. `issues/qa/<run-id>/report.json` for QA evidence

If these conflict, update the stale document before ending the session. Do not
use chat history as project source of truth.

## Strict Lazy Loading Gate (Non-Negotiable)
1. Do not read `system/core.md` or `data/Portfolio_Master_State.md` for general interactions such as macro discussion, script Q&A, casual status checks, or revisions to existing documents.
2. Read `system/core.md` and `data/Portfolio_Master_State.md` only when the user explicitly asks for analysis of a new asset or issuer, for example `analisis emiten BBRI` or `evaluasi kelayakan properti ini`. This is required to follow the 3 Advisory Board lenses and the 7-section Living Thesis format.

## Available Scripts

Run scripts via `node scripts/run.js <command>`.

- `calc <mode> [params]` -> financial calculations (`bep`, `irr`, `ltv`, `cac`, `runway`, `moic`, `pe`, `dcf`)
- `parse <vertical>` -> scan `inputs/` for data files
- `update-state` -> manage `Portfolio_Master_State.md`
- `check` -> verify environment setup
