# Progress Tracker - AI Investment Workspace

**Goal:** Turn the investment-cockpit concept into a production-ready BYOK AI
Investment Committee workspace with saved analyses, thesis memory, evidence,
history, chat, portfolio composition, and decision review.

- **Repo:** github.com/pojurb/demo1
- **New product:** `app/` -> Next.js 16 + TypeScript + Dexie
- **Roadmap source of truth:** `BUILD_PLAN.md`
- **Data model:** `DATA_MODEL.md`
- **Documentation source of truth:** `docs/process/DOC_SOT.md`

---

## Active Handoff - 2026-06-18

M1-M6 are implemented and verified. There is no active build milestone, no M7,
and no pending P9c item in the active roadmap. The in-app browser helper repair
is deferred; product QA should continue to use the canonical fallback Edge/CDP
harness until that tooling work is explicitly reprioritized.

Verified milestone state:

| Milestone | State | Latest Evidence |
|---|---|---|
| M1 - IC Primitives + Frictionless Thesis Intake | Implemented, verified | `issues/qa/2026-06-18T04-15-23-825Z/report.json` |
| M2 - Manual Private Asset IC Entry | Implemented, verified | `issues/qa/2026-06-17T05-02-10-481Z/report.json` and full sweep `issues/qa/2026-06-17T08-58-14-514Z/report.json` |
| M3 - Stock Intake Trust + Field Provenance | Implemented, verified | Covered by canonical browser QA and milestone docs |
| M4 - Evidence Locker Primitives | Implemented, verified | Full canonical QA sweep passed on 2026-06-16 |
| M5 - Watchlist IC Agenda + Assumption Monitoring | Implemented, verified | `issues/qa/2026-06-17T08-58-14-514Z/report.json` |
| M6 - Decision Ledger + Review Loop | Implemented, verified | Browser QA, unit tests, lint, and build passed |

Latest full verification snapshot:

- `npm test` passed on 2026-06-18: 22 files / 182 tests.
- `npm run lint` passed with pre-existing warnings only:
  - `app/src/app/layout.tsx` custom font warning
  - `app/src/components/charts.tsx` unused `CYAN_STROKE`
  - `app/src/lib/ai/providers/gemini.ts` unused `_drop` and `_enum`
- `npm run build` passed.
- `node scripts/run.js qa m1` passed via fallback Edge/CDP with retained
  evidence at `issues/qa/2026-06-18T04-12-06-241Z/report.json`.
- Full canonical `node scripts/run.js qa` passed via fallback Edge/CDP across
  `m1`, `m2`, `m3`, `m4`, `m5`, and `m6`, with latest retained evidence at
  `issues/qa/2026-06-18T04-15-23-825Z/report.json`.

Current tooling note:

- The in-app browser helper remains deferred by decision.
- Browser QA for product work should use `node scripts/run.js qa` and the
  fallback Edge/CDP harness documented in `docs/qa/BROWSER_QA_HARNESS.md`.

Next exact step:

- No active build milestone; choose the next product/business priority.

---

## Archive Summary

Earlier phases built the local-first Next.js workspace from the original
single-asset cockpit into the current IC system:

- P0-P6 established the Next.js app, deterministic finance engine, Dexie data
  layer, BYOK AI providers, file/link context, web research fallback, and
  grounded chat/debate.
- P7-P8 added portfolio composition, cross-asset chat, grounding guardrails, and
  the eval harness.
- P9a-P9c completed backup/restore, UI readability/density improvements, and
  deployment handoff/cutover documentation.
- M1-M6 then verified the current product roadmap: IC thesis memory, manual
  private assets, stock provenance, Evidence Locker, IC Agenda, and Decision
  Ledger/review loop.

Durable implementation details live in `BUILD_PLAN.md`, `DATA_MODEL.md`,
`EXECUTION_PLAN.md`, milestone packets under `docs/milestones/`, and retained QA
artifacts under `issues/qa/`.
