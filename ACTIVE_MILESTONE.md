# Active Milestone

Status: `implementation`

Active Packet: [`docs/milestones/M001-existing-thesis-loop.md`](docs/milestones/M001-existing-thesis-loop.md)

## Current Phase

M001 implementation — browser-verified local vertical slice.

All product, evaluation, multimodal-amendment, and architecture gates through
ADR-0006 are accepted. The local implementation now supports this deterministic
mock workflow:

1. create a persistent conversation;
2. extract a typed PLTR or BBRI thesis draft;
3. require explicit user confirmation;
4. transactionally store the thesis, assumptions, and queued research jobs;
5. process synthetic official-source fixtures locally;
6. persist only character-exact verified evidence; and
7. expose verified, degraded, failed, and retry states through the research API
   and right-side panel.

## Fresh Verification

- TypeScript: pass
- ESLint: pass
- Vitest: 21 assertions pass
- Next.js production build without a pre-existing database: pass
- Live localhost API journeys: PLTR success, BBRI success, duplicate-confirmation
  idempotency, degraded citation rejection, retry, and refresh persistence pass
- Chrome browser verification: desktop empty, creation, unsupported input, PLTR,
  BBRI, degraded/retry, and refresh flows pass
- Playwright Edge verification: desktop three-column geometry, narrow fixed
  Research drawer, close/reopen behavior, and retained screenshots pass

These results close the deterministic local vertical slice. They do not close
M001 while live-source, Decision Library, export/import, multimodal, provider,
and final-evaluation scope remains open.

## Next Step

1. Plan live official-source adapters as the next implementation phase, keeping
   deterministic fallback and verification boundaries explicit.
2. Retain `MockProvider` for local tests and browser QA.
3. Keep DEC-0009 deferred. Do not send thesis, assumption, decision, portfolio,
   or personal investment data to a cloud model.
4. Treat provider evaluation and remaining M001 product scope as separate gates.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
