# DEC-0017 - Terminal-First CLI Workflow, Concurrency Model, And Script Design

Status: `accepted`

Date proposed: 2026-08-05

Date accepted: 2026-08-05

Approving authority: user

Supersedes: none

Amends: none. Reuses `DEC-0009`'s existing POC provider gate and `DEC-0010`'s
model allowlist without adding a new provider, model, or data class; reuses
`ADR-0006`'s loopback-only local runtime without changing it.

## Context

`docs/drafts/cli-terminal-dashboard-draft-plan.md` (architecture review,
2026-08-03/04) proposed a second interaction surface: a terminal-based AI
agent (Claude Code, Gemini CLI, Codex, or similar — the principle is "any
terminal-based agent," not one vendor) as the primary place for free-form
research discussion, triggering jp-invest's existing deterministic evidence
pipeline via `npm run <script>` shell commands, with the Web App retained as
a Dashboard/Control Panel for the views that are genuinely better as a GUI
(`TopTenQueue`, `/portfolio` status index, and `ResearchPanel`'s verdict,
deliberately rendered outside `.panelContent` so a breach cannot be visually
buried).

That review found this needs its own governance record for three reasons the
draft plan and two independent reviews (Luna, Gemini) converged on:

1. **Concurrency was unsafe.** Two processes (browser + a terminal-triggered
   script) writing near the same moment could hit `SQLITE_BUSY`, and the
   research-job lease tracked only status and expiry, not ownership — a
   worker whose lease was reclaimed by the sweep could still clobber whatever
   a later claimant wrote, and a subprocess-backed CLI call can easily exceed
   the 60s lease.
2. **The governance-exception this needs is narrower than a full `DEC-0009`
   provider approval** (the user, `DEC-0009`'s recorded approving authority,
   already granted CLI-invoked usage an exception to the formal DEC process a
   new cloud provider would normally require) **but "no record at all" is the
   same failure shape as `R-018`'s revert** — a security-relevant change
   (`InstructionClassifier` wired in by default, 2026-07-29) shipped with no
   scoped decision behind it, was found by independent review to violate a
   Critical invariant, and was reverted rather than patched. See
   `docs/RISK_REGISTER.md` R-018.
3. **Script design has a structural confirm-gate question**: what stops an
   agent from creating durable state (a new thesis, a recorded decision) on
   its own initiative, without a human actually agreeing first.

This record covers what was actually built and verified in the same session
(2026-08-04/05), not a forward-looking proposal for unbuilt work — every claim
below was verified against the running code and, where noted, proven by an
automated test that was confirmed to fail without the fix before being
confirmed to pass with it.

## Decision Requested

Approve the CLI/Dashboard interface split described in the draft plan, the
concurrency model that makes concurrent DB access across that split safe, and
the script design pattern (stage-then-browser-confirm) that keeps durable
state creation gated on an actual human action, not a CLI flag.

## Approved Scope If Accepted

1. **Shell scripts over MCP, no embedded terminal in the Web App.** Every
   candidate CLI agent already runs shell commands natively; extending
   `scripts/research-refresh.ts`'s existing `npm run research:*` pattern needs
   no new integration mechanism. An embedded terminal/PTY inside the Next.js
   server was considered and rejected: that would be a materially worse risk
   class (remote code execution by design if ever exposed outside loopback)
   and would weaken `ADR-0006`'s loopback-only discipline in spirit. "One
   place for everything" is solved at the tooling layer (e.g. VS Code's
   `Simple Browser` docked next to the CLI agent's terminal), not in
   jp-invest's own code.

2. **The CLI agent is an external orchestrator, never a provider swap.**
   Verified in code: nothing under `lib/research/pipeline.ts` calls
   `LLMProvider`; extraction is deterministic sentence-ranking/XBRL/OCR.
   `getLLMProvider()` is called only from `generateDecisionRecommendation`
   and `app/api/chat/route.ts`, neither of which a CLI script touches. The
   terminal agent triggers the same deterministic `CitationPipeline` jp-invest
   already has and reads back what it verified; it never replaces
   `LLMProvider` inside evidence extraction.

3. **SQLite concurrency: WAL mode, `busy_timeout`, and a lease-owner gate.**
   `db/client.ts` sets `journal_mode = WAL` and `busy_timeout = 5000`
   (verified present, line 48-50). `research_jobs` gained a `lease_owner`
   column (migration `0012_add-research-job-lease-owner.sql`); every claim in
   `processResearchJobs` generates a `runId` and writes it as `leaseOwner`,
   and every final-state write (`succeeded`, `degraded`, `failed`, the
   `unchanged` short-circuit) is now conditioned on
   `eq(researchJobs.leaseOwner, runId)` rather than `eq(researchJobs.id, ...)`
   alone — so a worker whose lease was reclaimed by the sweep, and possibly
   already re-claimed by a different worker, writes nothing instead of
   clobbering the new claimant's state. A heartbeat renews the lease every 20s
   for the duration of a job's processing, so a subprocess-backed CLI call
   exceeding 60s does not lose its own lease mid-flight.
   **Proven by test** (`tests/research-service.test.ts`, "does not let a
   reclaimed worker overwrite a later claimant"): a fake pipeline reassigns
   `leaseOwner` mid-call to simulate a second worker claiming the job while
   the first is still in flight; confirmed to fail (first worker's write wins)
   before the gate was added, confirmed to pass (second worker's claim
   survives) after.

4. **One shared thesis-creation path, not three.** `confirmDraft` and
   `importThesisData` previously duplicated the same
   thesis/assumption/measurement/job insert sequence independently — a future
   CLI intake path that created theses directly would have made it a third
   independent copy to keep in sync on the clarification-gate/measurement-
   contract rules. Both now call one shared `createThesisFromValidatedDraft`.
   That function deliberately does **not** run `draftClarificationBlock`
   itself — the gate belongs to `confirmDraft` (a fresh draft becoming a
   tracked thesis for the first time) and must not apply to
   `importThesisData` (restoring a package that may be `legacy_unspecified` or
   otherwise pre-M011 — the real ISAT dogfood thesis is exactly this shape —
   which must keep importing exactly as it does today). **Proven by test**
   (`tests/decisions.test.ts`, "imports a package with an unresolved
   measurement contract without the clarification gate blocking it"):
   confirmed to fail when the gate was temporarily applied inside the shared
   function, confirmed to pass with it correctly scoped to `confirmDraft`
   only.

5. **The actual commitment gate for a new thesis is the browser, not the
   CLI.** The shipped `thesis:stage` script (`scripts/thesis-stage.ts`) does
   not insert a `theses` row at all — it validates the draft against
   `thesisDraftSchema`, runs `draftClarificationBlock` informationally, and
   writes a `conversations` + `messages` row, then prints a
   `localhost:3000/c/<id>` URL. The thesis is created only when the user opens
   that URL and clicks Confirm in the browser, which calls `confirmDraft`
   through the existing API route — the same gate a Web-UI-only user goes
   through today, unchanged. This is a stronger structural gate than a CLI
   stdin prompt (which an instructed agent could still pipe input into,
   `echo y | ...`): the terminal session cannot construct durable thesis state
   at all, regardless of what the agent is instructed or induced to do.

6. **Still open, not authorized by this record:** a `decisions:record` script
   does not exist yet. When built, `PRODUCT_STRATEGY.md` Workflow E requires
   that the recorded action never be inferable as agent-supplied — the
   mutating script itself must block on a live interactive stdin confirmation
   for the action value (e.g. `Select action [Buy/Hold/Reduce/Exit/None]:`),
   never accept it as a pre-filled flag. This is a residual, not a solved
   risk: the real backstop is a human physically present at the terminal, not
   a cryptographic guarantee, and a sufficiently instructed agent could still
   pipe stdin. Building that script requires its own review against this
   constraint before shipping, not an assumption that this record already
   covers it.

7. **Data classification is unchanged; CLI intake stays outside the blocked
   classes.** `.agents/SECURITY.md` classifies `portfolio, theses, decisions`
   as Confidential, requiring "only explicitly approved providers and
   environments" — the currently-approved list is Ollama Cloud only
   (`DEC-0010`). A generic CLI agent is not on that list and is not added to
   it by this record. No code path in this plan lets `app/api/*` construct or
   invoke a CLI agent, and no jp-invest code sends portfolio/position data or
   secrets to one. Whatever cloud backend the user's own terminal agent uses
   is a choice the user already made independently of jp-invest (their own
   flat-rate CLI subscription) — jp-invest's own `providerFetch` gate and
   `logs/outbound.log` disclosure discipline governs only calls jp-invest's
   own code initiates, which this plan adds none of.

8. **The CLI agent's own web search is never verified evidence.**
   `AGENTS.md`'s "Product Constitution for CLI Usage" (added 2026-08-04, same
   session) states this as a binding rule: a CLI agent's own browsing is
   exploration only, never jp-invest's verified evidence, and any claim
   needing verification must go through `npm run research:queue`. This closes
   the specific risk that a CLI agent's own confident-sounding web summary
   could be mistaken for jp-invest's `.includes()`-verified `CitationPipeline`
   output, since the agent never touches that pipeline directly.

## Risk Register Effects

- **R-018** (`Open`, unchanged): this record does not close, narrow, or
  reopen it. It exists specifically so this session's concurrency change does
  not repeat R-018's failure shape (a real behavior change shipped with no
  scoped decision behind it) — not because this change is itself an R-018
  instance.
- No new risk register row is opened. The concurrency defect the lease-owner
  fix addresses was an implementation gap in already-accepted `ADR-0006`
  local-runtime scope, not a new provider or data-classification risk.

## Eval And Verification Path

- `tests/research-service.test.ts`: the lease-owner race test described in
  Approved Scope item 3, confirmed to fail-then-pass across the fix.
- `tests/decisions.test.ts`: the shared-draft-creation gate-scoping test
  described in item 4, confirmed to fail-then-pass across the fix; the
  existing export/import round-trip test also still passes unchanged.
- Full suite (`npx vitest run`): 356 passed, 3 skipped, 0 failed as of this
  record. `tsc --noEmit` clean.
- Migrations `0010`-`0012` applied and verified directly against the real
  local database (`d:/jp-invest-data/db.sqlite`, outside the test suite) —
  confirmed the pre-existing 14 research-job rows (including the real TLKM
  thesis's 6 `degraded` jobs) survived intact, and the drizzle-kit-generated
  migration `0010`'s `INSERT ... SELECT` was hand-corrected before being
  applied (it referenced a `status` column on the old table shape that did
  not exist yet, causing a `SqliteError` in every test using
  `createDatabase` until fixed).

## Revocation And Incident Response

Revocation is a code + config change, not a data migration: stop invoking the
CLI scripts (they are opt-in, invoked manually via `npm run`, never
scheduled), and/or revert the lease-owner columns and gating logic. Because
`leaseOwner` and `evidenceIds`/`alternatives`/`status` columns default to
non-blocking values (`null`/`'[]'`/`'watchlist'`), no existing row requires
backfill to remain valid after a revert.

If a future CLI script is found to have created durable state without an
actual human confirmation (bypassing item 5's browser gate, e.g. a new script
that inserts directly into `theses`), that script's specific commit path is
the defect — not this record's architecture — and should be fixed or reverted
the same way `d420a33` was: independent review, then revert rather than
patch-in-place if the defect is a scope decision, not a bug.

## Acceptance Criteria

1. `db/client.ts` runs with `journal_mode = WAL` and a nonzero
   `busy_timeout`. *(Verifiable by reading the file; already true before this
   record.)*
2. Every final-state write in `processResearchJobs` is conditioned on the
   claiming worker's own `leaseOwner`, not merely the job `id`. *(Proven by
   test.)*
3. `createThesisFromValidatedDraft` is the only place either `confirmDraft` or
   `importThesisData` inserts a `theses`/`assumptions`/
   `assumptionMeasurements`/`researchJobs` row, and `draftClarificationBlock`
   is invoked by `confirmDraft` only. *(Verifiable by grep; proven by test for
   the import non-gating behavior.)*
4. `thesis:stage` never inserts a `theses` row; only the browser-side
   `confirmDraft` call does. *(Verifiable by reading `scripts/thesis-stage.ts`
   and `confirmDraft`.)*
5. No code path under `app/api/*` constructs or invokes a CLI agent process.
   *(Verifiable by grep.)*

## Options Considered

1. **Record this now, after the concurrency fix and refactor are built and
   tested, rather than before (adopted).** The draft plan's own §7.1 already
   established the sequencing this record follows: ship the hardening first
   (WAL/lease-owner), since everything else depends on concurrent access
   being safe, then record it — rather than writing speculative acceptance
   criteria for work not yet done. Every claim above was verified against
   running code and tests in the same session, not asserted from the design
   document alone.
2. **Fold this into an amendment of `DEC-0009` or `ADR-0006` instead of a new
   record (rejected).** Neither document's own scope covers interface
   architecture or a job-processing concurrency model; `PRODUCT_STRATEGY.md`
   and `VISION.md` both explicitly disclaim authority here too. A new,
   narrowly scoped record is more honest about what it actually governs than
   stretching an existing one to cover it.
3. **Skip a record entirely, arguing the user already granted a governance
   exception for CLI usage in §7.1 (rejected).** The exception covers *not
   requiring a new `DEC-0009`-style provider approval* for CLI-invoked
   processing; it does not cover *no record at all* for a real concurrency
   and data-integrity change to `research_jobs`, which is exactly the failure
   shape R-018's revert exists to warn against repeating.

## Consequences If Accepted

- The lease-owner concurrency model and shared thesis-creation path become
  the accepted baseline; any future change to `processResearchJobs`'s
  claim/write logic or to thesis-creation inserts should be checked against
  this record's Acceptance Criteria, not re-derived from scratch.
- `decisions:record`'s interactive-stdin-confirmation requirement (item 6)
  remains an explicit prerequisite for that script's own future review, not
  retroactively satisfied by this record.
- The five pre-existing product-behavior gaps found during the original
  cross-check against `PRODUCT_STRATEGY.md`/`VISION.md` (§8.0 of the draft
  plan — the AI-suggested investment action in `generateDecisionRecommendation`,
  the `decisions` schema's missing evidence/alternatives fields, the
  `explorationDraftSchema`'s missing citation field and candidate-count floor,
  the missing `Owned`/`Watchlist` tag, and the Sidebar form collecting
  position value) were separately fixed in this same session, ahead of this
  record, at the user's explicit direction — not left as tracked debt.

## Affected Files If Accepted

- `db/client.ts` (WAL/`busy_timeout`, already present)
- `db/schema.ts` (`research_jobs.lease_owner`; also
  `decisions.evidence_ids`/`alternatives` and `portfolio_positions.status`
  from the same session's separate gap-fix work)
- `db/migrations/0010_gap-fixes-add-columns.sql`,
  `0011_drop-position-value-columns.sql`,
  `0012_add-research-job-lease-owner.sql`
- `lib/research/service.ts` (`processResearchJobs`'s claim/heartbeat/write
  gating; `createThesisFromValidatedDraft`; `confirmDraft`; `importThesisData`)
- `scripts/thesis-stage.ts`, `scripts/research-queue.ts`,
  `scripts/research-panel.ts` (existing CLI intake scripts, unchanged by this
  record — cited as the shipped instance of item 5's stage-then-browser-confirm
  pattern)
- `tests/research-service.test.ts`, `tests/decisions.test.ts` (the two
  fail-then-pass regression tests cited above)
- `AGENTS.md` ("Product Constitution for CLI Usage", already added
  2026-08-04)
