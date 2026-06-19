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

M1-M7 are implemented and verified. There is no pending P9c item in the active
roadmap. The in-app browser helper repair is deferred; product QA should continue to use the
canonical fallback Edge/CDP harness until that tooling work is explicitly
reprioritized.

Verified milestone state:

| Milestone | State | Latest Evidence |
|---|---|---|
| M1 - IC Primitives + Frictionless Thesis Intake | Implemented, verified | `issues/qa/2026-06-18T04-15-23-825Z/report.json` |
| M2 - Manual Private Asset IC Entry | Implemented, verified | `issues/qa/2026-06-17T05-02-10-481Z/report.json` and full sweep `issues/qa/2026-06-17T08-58-14-514Z/report.json` |
| M3 - Stock Intake Trust + Field Provenance | Implemented, verified | Covered by canonical browser QA and milestone docs |
| M4 - Evidence Locker Primitives | Implemented, verified | Full canonical QA sweep passed on 2026-06-16 |
| M5 - Watchlist IC Agenda + Assumption Monitoring | Implemented, verified | `issues/qa/2026-06-17T08-58-14-514Z/report.json` |
| M6 - Decision Ledger + Review Loop | Implemented, verified | Browser QA, unit tests, lint, and build passed |
| M7 - IC Chair Triage + Intake Intent Gate | Implemented, verified | `npm test`, `npm run lint`, `npm run build`, and `node scripts/run.js qa m7` passed on 2026-06-18; evidence at `issues/qa/2026-06-18T13-53-23-771Z/report.json` |

Latest full verification snapshot:

- `npm test` passed on 2026-06-18: 23 files / 185 tests.
- `npm run lint` passed with pre-existing warnings only:
  - `app/src/app/layout.tsx` custom font warning
  - `app/src/components/charts.tsx` unused `CYAN_STROKE`
  - `app/src/lib/ai/providers/gemini.ts` unused `_drop` and `_enum`
- `npm run build` passed.
- Latest full canonical browser QA evidence remains
  `issues/qa/2026-06-18T07-07-18-098Z/report.json` for M1-M6.
- Isolated M7 browser QA passed:
  `issues/qa/2026-06-18T13-53-23-771Z/report.json`.
- The fallback browser harness now includes the M7 triage scenario and updated
  Agenda / Idea Triage creation selectors.

Current tooling note:

- The in-app browser helper remains deferred by decision.
- Browser QA for product work should use `node scripts/run.js qa` and the
  fallback Edge/CDP harness documented in `docs/qa/BROWSER_QA_HARNESS.md`.

Next exact step:

- Keep using the retained M7 browser artifact when validating triage regressions:
  `issues/qa/2026-06-18T13-53-23-771Z/report.json`.

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
- M1-M7 then implemented the current product roadmap: IC thesis memory, manual
  private assets, stock provenance, Evidence Locker, IC Agenda, Decision
  Ledger/review loop, and IC Chair triage before case files.

Durable implementation details live in `BUILD_PLAN.md`, `DATA_MODEL.md`,
`EXECUTION_PLAN.md`, milestone packets under `docs/milestones/`, and retained QA
artifacts under `issues/qa/`.
