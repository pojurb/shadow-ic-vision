# Active Milestone

Status: `implementation`

Active Packet: [`docs/milestones/M001-existing-thesis-loop.md`](docs/milestones/M001-existing-thesis-loop.md)

## Current Phase

M001 implementation — verified local vertical slice.

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
- Remaining browser checks: screenshots and narrow responsive drawer blocked
  when Chrome capture/emulation commands timed out and the control channel became
  unresponsive

These results verify the local implementation and API flow. They do not close
M001 while required visual/browser checks and later milestone scope remain open.

## Next Step

1. Reconnect Chrome or add the Playwright fallback to capture screenshots and
   verify the narrow responsive Research drawer. The desktop workflow checks are
   complete.
2. Retain `MockProvider` until the local workflow is visually verified.
3. Keep DEC-0009 deferred. Do not send thesis, assumption, decision, portfolio,
   or personal investment data to a cloud model.
4. After the local slice closes, plan live SEC/IDX adapters and provider
   evaluation as separate implementation phases.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
