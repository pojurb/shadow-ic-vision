# M001 Local Vertical Slice Verification Manifest

Date: 2026-07-04

Branch: `shadow-ic-vision`

Outcome: `verified-with-browser-blocker`

## Scope

Local deterministic Conversation → Draft → Confirmation → Research → Verified
Evidence flow for PLTR and BBRI. No cloud provider or live source was used.

## Commands And Results

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | Pass |
| ESLint `eslint .` | Pass, zero warnings/errors |
| Vitest `vitest run` | Pass, 4 files and 21 assertions |
| Next.js `next build` | Pass without a database directory |
| Live localhost PLTR journey | Pass, `exact_verified` quote persisted |
| Live localhost BBRI journey | Pass, Indonesian quote persisted |
| Duplicate confirmation | Pass, existing thesis/jobs returned |
| Altered citation | Pass, `degraded`, zero Evidence |
| Retry | Pass, job returned to `queued` |
| Refresh-state GET | Pass, succeeded state restored |
| Chrome empty workspace | Pass, empty guidance and empty Research panel visible |
| Chrome conversation creation | Pass, persistent conversation link and route visible |
| Chrome unsupported input | Pass, supported-fixture guidance visible |
| Chrome PLTR confirmation | Pass, structured assumption and explicit confirmation CTA visible |
| Chrome PLTR evidence | Pass, `succeeded`, `exact_verified`, quote, source, tier and dates visible |
| Chrome refresh persistence | Pass, PLTR evidence restored after reload |
| Chrome BBRI flow | Pass, Indonesian quote and IDX provenance visible |
| Chrome citation rejection | Pass, `degraded`, zero visible Evidence and Retry visible |
| Chrome retry | Pass, attempt advanced from 1 to 2 and remained evidence-free |
| Chrome screenshots | Blocked: `Page.captureScreenshot` timed out twice |
| Chrome responsive drawer | Blocked: viewport-emulation command timed out |
| Chrome control channel | Stopped after subsequent lightweight tab-list call became unresponsive |

## Environment And Limits

- Next.js 16.2.10, Node runtime, SQLite via `better-sqlite3` and Drizzle.
- Provider: `mock-deterministic-1`; no external model invocation.
- Source fixtures are synthetic and perform no outbound requests.
- Chrome DOM-visible checks used a dedicated temporary SQLite database and only
  synthetic PLTR/BBRI fixture text.
- No screenshots were produced because Chrome screenshot capture timed out.
- Per the approved stop rule, native-host and helper-pipe configuration were not
  changed after the Chrome control channel became unresponsive.
- `npm audit` reported six moderate dependency findings; a forced breaking upgrade
  was intentionally not applied.

## Required Follow-up

Reconnect Chrome or use a repository-owned Playwright harness to capture the
required screenshots and verify the narrow responsive Research drawer. Do not
mark the slice fully closed until those two checks pass.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
