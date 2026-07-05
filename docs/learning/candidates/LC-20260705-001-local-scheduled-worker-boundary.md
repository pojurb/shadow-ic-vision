# LC-20260705-001 - Scheduled Workers Must Share The Durable Persistence Boundary

Status: `candidate`

Captured: `2026-07-05`

Milestone: `M001`

Task type: `implementation`

Classification: `quality`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

The first periodic-ingestion implementation added Vercel Cron while M001's
accepted architecture required private research and SQLite persistence to remain
local. A Vercel worker would not share the durable local SQLite database and
would violate the deployment contract. The conflict was found during the
checkpoint consistency review, before release.

The implementation was corrected to use Windows Task Scheduler and a
server-independent local refresh command. Registration alone was insufficient:
the task's executable, arguments, and working directory were inspected to ensure
they referenced the durable user Node installation and repository. The task was
then manually executed through Task Scheduler and returned result code `0`.

## Evidence

- Commit, run, or evidence ID: implementation commit `5376c59`; checkpoint
  commit `cd8b2b0`; deterministic test-isolation fix `803330a`; M001
  live-source release manifest.
- Commands or checks: `npm run research:refresh`;
  `npm run research:install-task`; `Get-ScheduledTask`;
  `Get-ScheduledTaskInfo`; manual `Start-ScheduledTask`; `git diff --check`.
- Exact result: direct refresh succeeded; the registered action used
  `C:\Users\napst\AppData\Local\Programs\nodejs\npm.cmd`, repository working
  directory `D:\jp-invest`, and `run research:refresh`; manual scheduled-task
  execution returned result code `0`; next automatic run was retained.
- Related review finding or incident:
  [`../../evidence/releases/2026-07-04-m001-live-official-sources/manifest.md`](../../evidence/releases/2026-07-04-m001-live-official-sources/manifest.md)
  and the periodic-ingestion clarification in
  [`../../decisions/ADR-0006-m001-stack.md`](../../decisions/ADR-0006-m001-stack.md).

No credentials, private investment data, source document contents, or local
database contents are included.

## Proposed Reusable Lesson

When adding a scheduled worker, first map its execution environment to the
application's authoritative persistence and security boundary. A scheduler is
not valid merely because its trigger is reliable.

Before closure:

1. reject any worker runtime that cannot access the approved durable store or
   would cross an unauthorized deployment boundary;
2. use a scheduler located inside that boundary;
3. verify the registered executable path, arguments, working directory, and
   identity are durable rather than temporary tooling paths;
4. manually execute the registered task through the real scheduler; and
5. require a successful scheduler result plus retained next-run and application
   run-state evidence.

Do not generalize this lesson into a permanent preference for Windows Task
Scheduler. Cloud schedulers are valid when the approved architecture provides
authenticated access and durable managed persistence in the same authorized
environment.

## Scope And Risks

- Applies to: cron jobs, Windows scheduled tasks, background workers, queue
  consumers, and maintenance jobs that read or write durable application state.
- Does not apply to: stateless public-site tasks with no private or durable data,
  or architectures explicitly approved for managed cloud persistence.
- Known failure modes: a manually successful task may later fail because of
  credential rotation, machine downtime, path changes, network access, or user
  logon policy; operational monitoring is still required.
- Conflicting authority checked: `AGENTS.md`, `.agents/DELIVERY.md`,
  `.agents/QUALITY.md`, `.agents/SECURITY.md`, `.agents/LEARNING.md`, and
  `docs/decisions/ADR-0006-m001-stack.md`.

## Independent Review

- Reviewer: Antigravity (Gemini 3.1 Pro) and Antigravity (Claude Sonnet 4.6
  with extended thinking)
- Review date: 2026-07-05
- Evidence reproduced: `no` for the clean checkpoint claim; both reviewers
  reproduced the commits and architecture evidence.
- Duplicate or conflict check: clear; the lesson aligns with ADR-0006 and is
  not duplicated in the governing modules.
- Privacy check: passed; no credentials, investment data, or restricted
  information is present.
- Disposition: `needs-more-evidence`
- Reason: both reviewers found the default deterministic suite failing while
  `.env` selected live mode. Independent reproduction showed that Vitest was
  inheriting `RESEARCH_SOURCE_MODE=live`, not that the scheduler lesson was
  invalid. The default Vitest configuration now explicitly forces mock mode and
  locally passes 40 tests with 3 live-only skips, but an independent reviewer
  must reproduce the committed fix before this candidate becomes validated.

## Promotion Or Supersession

- Decision authority: user, because promotion would modify governing quality
  guidance.
- Decision date: pending
- Promotion target: proposed `.agents/QUALITY.md` operational-verification guidance
- Promotion registry entry: pending
- Supersedes: none
- Superseded by: none
- Rollback path: if promoted, remove the scheduled-worker verification guidance,
  mark this candidate and its promotion record `superseded`, and restore the
  prior operational-verification text.
