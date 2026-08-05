# Draft Plan: Terminal-First Research Workflow + Web App as Dashboard/Control Panel

Status: **DRAFT — partially implemented, partially still open.** No milestone
number assigned. This is a working document from an architecture review
session (2026-08-03); it does not itself govern.
[`DEC-0017`](../decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md)
(accepted 2026-08-05) now covers the pieces marked "**Done, DEC-0017**" below —
§4.2's WAL/lease-owner concurrency model and §4.3's shared
`createThesisFromValidatedDraft` path. §5 step 3's three CLI intake scripts
(`research:panel`, `research:queue`, `thesis:stage`) already exist and are
tested end-to-end — verified directly by reading each script, 2026-08-05.
§5 step 6 (hide Chat UI from navigation) is **not** done — verified directly
2026-08-05: `components/Sidebar.tsx` still renders "+ New" and the full
conversation list as primary navigation. Everything else in this document
(§5 steps 4/5/6/7, the Web App → Control Panel conversion, and the Ollama
decision) remains open and ungoverned.

## 1. Motivation

The current Web Chat UI is rigid — it forces every interaction through a
structured draft/confirm flow and doesn't support free-form research and
discussion. The user already pays for a flat-rate CLI AI subscription
(Gemini CLI / Antigravity `agy`, or others — Claude Code, Codex; the
principle is "any terminal-based agent", not one vendor) and wants that as
the primary conversational surface instead.

Desired workflow:

1. **Free exploration/discussion** in a terminal AI agent — unconstrained,
   not tied to jp-invest's structured draft schema.
2. **"Mengerucut" (narrowing down)** — user tells the agent to trigger
   jp-invest's real, deterministic research process for a specific
   thesis/assumption.
3. **Challenge the output** — discuss, question, and re-run evidence
   gathering conversationally, using the same terminal session.

Constraint carried through the whole design: **flexibility of the CLI agent
must never weaken the deterministic evidence-verification guarantee**
(`CitationPipeline`, verbatim `.includes()` matching) that is this app's
core value proposition.

## 2. Architecture (as converged on through review)

```
┌────────────────────────────┐       ┌──────────────────────────────┐
│ Terminal (Claude Code /     │       │ Browser — Next.js Web App     │
│ Codex / Gemini CLI, etc.)   │       │ (localhost:3000)              │
│ — free-form conversation    │       │ — Dashboard + Control Panel   │
│                              │       │                                │
│ Triggers deterministic work │       │ Reads the same DB, renders    │
│ via `npm run <script>`      │       │ visual/dense-data views       │
│ (shell command — no MCP,    │       │ (portfolio queue, verdict,    │
│ no new protocol needed)     │       │ evidence tables)               │
└──────────────┬───────────────┘       └───────────────┬────────────────┘
               │                                          │
               └──────────► same SQLite file ◄────────────┘
```

Key decisions made during review, and why:

- **Shell scripts over MCP.** Every candidate CLI agent already knows how to
  run shell commands — that's their core capability, zero setup per tool.
  MCP would require per-tool config and only adds value once there are many
  typed tools; not justified for the current scope. jp-invest already has
  the exact pattern (`scripts/research-refresh.ts`,
  `scripts/promote-discoveries.ts`, invoked via `npm run research:*`) —
  extend it, don't invent a new integration mechanism.
- **No embedded terminal in the Web App.** Rejected: it would mean the
  Next.js server hosts a live PTY reachable over HTTP/websocket — a
  fundamentally worse risk class than anything else discussed (remote code
  execution by design if ever exposed outside loopback), and it violates
  `ADR-0006`'s loopback-only discipline in spirit even if bound to
  `127.0.0.1` today. "One place for everything" is solved at the **tooling**
  layer instead: VS Code's built-in `Simple Browser` command
  (`Ctrl+Shift+P` → "Simple Browser: Show" → `http://localhost:3000`) docked
  next to the CLI agent's terminal/chat panel. Zero new jp-invest code.
- **CitationPipeline is not an LLM call today.** Verified in code: nothing
  under `lib/research/pipeline.ts` calls `LLMProvider`. `getLLMProvider()`
  is called only from `generateDecisionRecommendation`
  (`lib/research/service.ts:1269`) and `app/api/chat/route.ts`. This means
  the original proposal's premise ("expensive LLM extraction of thick
  documents") doesn't describe what the codebase currently does — extraction
  is deterministic sentence-ranking/XBRL/OCR. **The CLI agent is not a
  provider swap.** It's an external orchestrator that calls the same
  deterministic pipeline jp-invest already has, via scripts — it never
  replaces `LLMProvider` inside `CitationPipeline`.
- **Web App becomes Dashboard + Control Panel**, not deleted. Three things
  are genuinely better as GUI than terminal text: `TopTenQueue`/priority
  queue (glance across many holdings), `/portfolio` StatusIndex (sortable
  table), and `ResearchPanel`'s verdict (deliberately placed outside
  `.panelContent` so a breach can't be visually buried — that placement
  guarantee is much weaker as scrolling terminal text).

## 3. Explicitly dropped from the original proposal

These were part of the original ask but superseded during review — **do not
build them**:

- `lib/ai/adapters/cli-provider.ts` (`CLIProviderAdapter` implementing
  `LLMProvider` via subprocess) — not needed. No code path in
  `CitationPipeline` calls an `LLMProvider` today, so there's nothing to
  "swap" for extraction. If a CLI-narrated recommendation is wanted later,
  that's a conversational replacement for `generateDecisionRecommendation`,
  not a new `LLMProvider` implementation.
- `LLM_PROVIDER_TYPE=gemini_cli` branch in `lib/ai/factory.ts` — dropped for
  the same reason. (If revisited, the earlier finding still holds: this env
  var is currently one global switch read by both the chat route *and*
  research service — it would need to become a per-use-case parameter
  first, not a third global-switch branch.)
- Header "Web Chat Mode vs Terminal Sync Mode" toggle as an **execution**
  control — dropped. The terminal session is a fully separate OS process;
  there is nothing in the Web App for a toggle to switch. A read-only status
  indicator is a possible nice-to-have (§6), not a mode switch.
- Embedded browser/terminal inside the Web App — dropped, see §2.

## 4. Must-have changes

### 4.1 Web App / UI layer (`app/`, `components/`)

1. **Live-refresh on dashboard views.** `ResearchPanel`, `TopTenQueue`,
   `/portfolio` StatusIndex currently reflect a page-load snapshot. Once
   changes routinely come from a separate terminal process, a stale browser
   tab is a real, frequent problem. Add polling or a lightweight
   push/refresh mechanism.
2. **Audit each `app/api/*` route the CLI flow needs, per route** — verify
   whether its logic is already factored into a standalone
   `lib/research/service.ts` function (safe to reuse from a script) or still
   inline in the route handler (needs extraction first). Confirmed example
   needing extraction: see §4.3.
3. Hide Chat UI from primary navigation once §4.3/§5 are done (do **not**
   delete the route — keep `/c/[id]` as a read-only legacy view for existing
   conversations).

### 4.2 Shared backend (`db/`, `lib/research/service.ts`) — prerequisite, not UI code

**Done, `DEC-0017` (2026-08-05).** Both items below are implemented, tested,
and applied to the real local database. See `DEC-0017` Approved Scope item 3.

1. **`db/client.ts`: enable WAL + `busy_timeout`.**
   ```ts
   sqlite.pragma('journal_mode = WAL');
   sqlite.pragma('busy_timeout = 5000');
   ```
   Today only `foreign_keys = ON` is set (`db/client.ts:48`). Default
   rollback-journal mode + zero busy_timeout means two processes (browser +
   terminal) writing around the same moment can hit `SQLITE_BUSY`
   immediately.

2. **Fix the research-job lease to track ownership, not just status+id.**
   Confirmed by direct code read
   (`lib/research/service.ts:423-601`): the reclaim sweep resets any job
   `running` past a 60-second `leaseExpiresAt` back to `queued` regardless of
   whether the original worker is still alive
   (`service.ts:423-427`), and **every** final status update — success
   (`:519`), no-evidence (`:534-540`), succeeded-with-evidence
   (`:573-579`), and the catch block (`:595-601`) — filters only on
   `eq(researchJobs.id, row.job.id)`, with no lease-owner check. A
   subprocess-backed CLI call can easily exceed 60 seconds (agent cold
   start, auth, long document reads), which makes double-claim a likely
   occurrence, not a theoretical one. Minimum fix: add a `leaseOwner`/`runId`
   column, require it in every final-state `WHERE`, add heartbeat/lease
   renewal for long-running work.
   This matters for the Web App specifically because it is not a purely
   passive reader — `app/api/theses/confirm/route.ts` already triggers
   `processResearchJobs` too, so Web App and a terminal-triggered run can
   race today, not just script vs. script.

### 4.3 Shared thesis-creation logic — required before any CLI intake can create a new thesis

**Done, `DEC-0017` (2026-08-05), with one deliberate deviation from this
section's original wording.** `createThesisFromValidatedDraft` is
implemented and used by both `confirmDraft` and `importThesisData`, per the
"Required refactor" paragraph below — but it does **not** run
`draftClarificationBlock` itself, unlike what that paragraph's phrasing
originally implied. Applying the gate unconditionally to `importThesisData`
would have blocked re-importing any thesis with a `legacy_unspecified` or
otherwise unresolved measurement contract — including the real ISAT dogfood
thesis — which the import path has never gated on and must keep not gating
on. See `DEC-0017` Approved Scope item 4 for the full reasoning and the
regression test that proves both the sharing and the gate's correct scope.

Verified by direct code read: `confirmDraft` (`lib/research/service.ts:126`)
does **not** accept a draft object. It requires `conversationId` +
`messageId`, looks up an existing `messages` row, and requires
`role === 'assistant'`, `validationOutcome === 'valid'`, and a
`structuredPayload` matching `thesisDraftSchema`
(`service.ts:150-170`) before running the clarification gate and inserts.
A CLI intake script cannot call this directly with a fresh draft.

Also found: a second, independent code path already exists that creates a
thesis from a draft **without** going through `confirmDraft` — the
export/import restore function (`service.ts`, ~line 1050) inserts a
synthetic `conversations` row, a synthetic `messages` row carrying
`structuredPayload`, then inserts into `theses` directly in its own
transaction. This is pre-existing duplication, not something this plan
introduces — but adding CLI intake as a *third* independent path without
fixing it first would triple the surface that must stay in sync on
clarification-gate/measurement-contract rules.

**Required refactor:** extract a shared `createThesisFromValidatedDraft(draft, context)`
containing the clarification gate + thesis/assumption inserts + job queuing
(`service.ts:172` onward). `confirmDraft` calls it after its
message-lookup/parse step; the import path calls it instead of duplicating
the inserts; a new CLI intake script calls it after CLI-side draft
validation. All three end up enforcing identical rules by construction.

CLI intake will still need to create a `conversations` row and a synthetic
`messages` row (schema requires `theses.conversationId` and
`draftMessageId`) — mirror the pattern the import path already uses, don't
invent a new one.

## 5. Phased roadmap

1. **Backend hardening** (§4.2) — WAL/busy_timeout, lease-owner fix. Ship
   first; everything else depends on concurrent access being safe.
   **Done, `DEC-0017` (2026-08-05).**
2. **Refactor `createThesisFromValidatedDraft`** (§4.3) out of `confirmDraft`
   and the import path. **Done, `DEC-0017` (2026-08-05)** — see §4.3's note
   on the one deliberate deviation (import stays ungated).
3. **CLI intake scripts**, built on top of (1) and (2):
   - ~~`npm run thesis:create -- ...`~~ **Superseded, not built as specified.**
     What shipped instead is `npm run thesis:stage -- --draft '...'`
     (verified 2026-08-05): it validates the draft and writes only a
     `conversations`/`messages` row, printing a `localhost:3000/c/<id>` URL —
     it never inserts a `theses` row itself. The thesis is created only when
     the user opens that URL and clicks Confirm in the browser (`confirmDraft`,
     via the existing API route). This is a stronger gate than the stdin
     confirmation this step originally called for: the CLI session cannot
     construct thesis state at all, not even with a piped-in "yes". See
     `DEC-0017` Approved Scope item 5.
   - `npm run research:queue -- --thesis-id X` — **built, verified working
     2026-08-05** (reads the thesis, calls `processResearchJobs`).
   - `npm run research:panel -- --thesis-id X` — **built, verified working
     2026-08-05** (reads `getResearchPanel`, prints JSON).
   - `npm run decisions:record -- --thesis-id X ...` — **not built.** When it
     is, the interactive-stdin-confirmation requirement below still applies
     in full; nothing about `thesis:stage`'s stronger browser-gate design
     transfers to it, since recording a decision has no equivalent
     browser-confirm step today.
   Verify end-to-end from an actual terminal agent session before touching
   the Web App's navigation.
   **Mutating scripts (`thesis:create`, `decisions:record`) must require a
   live interactive stdin confirmation** (e.g. `Confirm thesis creation?
   [y/N]`, `Select action [Buy/Hold/Reduce/Exit/None]:`) typed by a human at
   the keyboard, not accepted as a CLI flag the agent can set on its own.
   Found during a second independent review (Gemini) verifying this plan
   against `PRODUCT_STRATEGY.md`: a plain two-script split
   (`thesis:draft` → `thesis:create`) does not actually stop an agent from
   calling both in the same turn with no real pause for human agreement —
   the split only helps if something in between genuinely requires a human.
   Honest caveat, not fully solved: a sufficiently instructed/autonomous
   agent could still pipe input into that stdin prompt (e.g.
   `echo y | npm run thesis:create`). The real backstop is the same one this
   whole design already depends on — a human actually present and watching
   the terminal session — not a cryptographic guarantee. Record this
   residual risk explicitly rather than presenting the stdin prompt as a
   complete fix.
4. **Web App dashboard conversion**: live-refresh (§4.1.1), move
   Generate-Recommendation / Retry-research / Refresh-sources /
   Review-evidence / Record-decision / Accept-clarification into an explicit
   control-panel surface if they aren't already separable actions.
5. **Concurrency/integration tests** — not covered by existing unit tests:
   two `DatabaseHandle`s opened on the same on-disk file (not two Drizzle
   objects sharing one connection), a lease-expiry-during-long-run test, a
   worker-crash/retry test, an idempotency/duplicate-evidence test.
6. **Hide Chat UI from navigation** (not delete). Keep `/c/[id]` as read-only
   legacy for conversations created before this change. **Not done** —
   verified 2026-08-05: `components/Sidebar.tsx` still renders "+ New" and
   the full conversation list as primary navigation.
7. **Ollama decision** (§7.2) — separate, still open.

## 6. Nice-to-have (not blocking)

- Read-only status indicator in the Web App header (e.g. "last CLI-triggered
  job: 2 min ago") — informational only, never an execution control.
- Backup retention/pruning for `db/client.ts`'s `backupExistingDatabase` —
  today every `getDatabase()` call in a fresh process (i.e. every CLI script
  invocation) copies the whole SQLite file before checking for pending
  migrations. Pre-existing behavior, not introduced by this plan, but the
  terminal-first workflow will invoke scripts far more often than the
  current Task-Scheduler-driven refresh does.

## 7. Open questions — need a decision before/alongside implementation

### 7.1 Governance exception for CLI-invoked processing

User's direction: treat CLI-invoked usage as an exception to the formal
DEC process a new cloud provider would normally require under `DEC-0009`.
Accepted as the user's call (they are `DEC-0009`'s recorded approving
authority) — but two things should still happen even without a full DEC, to
avoid recreating the R-018 "silent default-wiring, no recorded reasoning"
failure mode this codebase already reverted once
(`docs/RISK_REGISTER.md` R-018; commits `d420a33`/`b9d3dd9`/`93acdab`):

- A short written note (a few lines in this doc or the eventual
  implementation PR) stating *why* the exception is safe here: user-initiated
  from their own terminal, off by default, no code path lets `app/api/*`
  construct or invoke it.
- Even without `evaluateProviderGate` in the loop, keep its data-classification
  spirit by discipline: CLI intake should not be the path anything in the
  `DEC-0009` "No" rows (portfolio/position data, secrets) flows through.

### 7.2 Does Ollama get deprecated?

Not resolved. Confirmed usage sites: `app/api/chat/route.ts` (chat) and
`generateDecisionRecommendation` (`service.ts:1269`, exposed via
`app/api/theses/[id]/recommendation/route.ts`) — a **separate button**, not
part of the chat flow. Once Chat UI is hidden (§5 step 6), Ollama's chat
usage becomes moot on its own. The recommendation call is independent and
needs its own explicit decision: keep it as an Ollama-backed control-panel
button (single deterministic call, fits "Control Panel" well), or let the
CLI agent produce that narrative conversationally instead. Not required for
the rest of this plan to proceed — can be decided later.

### 7.3 Agentic blast radius of the chosen CLI tool

Flagged during review and not yet verified against a specific tool/version:
agentic CLI tools (Gemini CLI, Antigravity `agy`, Claude Code, Codex) can, by
default, browse the web and execute shell/file operations on their own —
capabilities well beyond what `R-018`'s existing mitigations
(`scanEmbeddedInstructions`, optional `InstructionClassifier`) were designed
to contain, since those assume the blast radius of a compromised model is
"generates bad text," not "takes real action on this machine." Before
relying on a CLI agent to read real financial documents fetched by
jp-invest, confirm it can be run in a restricted/no-tools/sandboxed mode for
that specific interaction, or accept the wider blast radius explicitly
alongside §7.1's note.

Sharpened by independent review (Gemini): this same capability creates a
direct `PRODUCT_STRATEGY.md` §5 violation, not just a security concern — §5
states *"Web search is a discovery mechanism, not evidence by itself."* An
agentic CLI tool with its own independent web-browsing capability can search
and summarize results on its own initiative when asked a question, and
present that summary conversationally in a way the user could mistake for
jp-invest's own verified evidence — even though it never touched
`CitationPipeline` and was never subject to `.includes()` verification. The
CLI agent's own instructions (§8 Gap 1's proposed constitution file) must
say explicitly: its own web search is not verified evidence, and any factual
claim that should carry jp-invest's verification status must go through
`research:queue`, not the agent's native browsing.

## 8. Cross-check against `docs/PRODUCT_STRATEGY.md` and `VISION.md`

`PRODUCT_STRATEGY.md` explicitly disclaims authority over this plan's subject
matter — line 10-11 and §6 both list architecture, implementation, and
provider selection as **out of scope** for that document. So this plan does
**not** need a strategy amendment; it only needs to keep every workflow's
specified behavior intact regardless of which interface (Web UI or CLI)
exercises it. Checked against `PRODUCT_STRATEGY.md` §4 (Workflows A-E) and
`VISION.md` §§6-7 (Moral Constitution / Product Boundaries):

**Confirmed aligned:** `VISION.md` §7 — *"the product does not treat model
output as evidence... Claims must remain traceable to sources"*. This plan's
CLI role never generates evidence text at all; it only triggers the existing
deterministic `CitationPipeline` and reads back what it verified (§2). Stricter
than required, not just compliant. A second independent review (Luna) also
confirms `processResearchJobs` still runs full deterministic verification
before persisting Evidence, and that Dashboard/Top-10 queue/status
index/verdict placement remain sound reasons to keep the Web UI, and that no
scheduled/autonomous monitoring is being added (Strategy §3 stays satisfied).

### 8.0 Pre-existing gaps — NOT introduced by this plan, found only because the
cross-check forced a direct code read

Surfaced by Luna's review and independently verified against the code below.
These predate this plan entirely — they exist in the shipped Web App today —
but this plan must not silently carry them forward unexamined into the
Control Panel (§5), and the earlier "Confirmed aligned" framing above was too
narrow: it checked the *plan*, not whether the *baseline it plans to reuse*
is itself compliant.

- **Workflow E is already violated by shipped code.**
  `generateDecisionRecommendation`'s prompt (`service.ts:1259-1265`) literally
  asks the model to *"recommend the most appropriate next action"* and
  *"Choose one optional action: 'Buy', 'Hold', 'Reduce', 'Exit', or null"*.
  `ResearchPanel.tsx:599-613` renders the result as **"AI Suggestion:"** with
  an **"Apply"** button. `tests/decisions.test.ts:192` asserts
  `rec.recommendedAction === 'Buy'` as the *expected passing* behavior — this
  isn't dormant code, there's a regression test locking it in. This directly
  contradicts `VISION.md` §7 / `PRODUCT_STRATEGY.md` Workflow E: *"must not
  preselect, recommend, vote on, or execute"* investment actions. §5's plan to
  move "Generate Recommendation" into the Control Panel would relocate this
  behavior unchanged, not fix it.
- **`decisions` schema doesn't meet `VISION.md` §7's own completeness bar.**
  `VISION.md` §7: *"Every record retains the user's reasoning, relevant
  evidence, known alternatives, and timestamp."* `db/schema.ts:206-217`'s
  `decisions` table has only `outcome`, `action`, `rationale`, `createdAt` —
  no evidence linkage, no alternatives field. `recordDecision`
  (`service.ts:934`) accepts `optionalAction` as a plain parameter and inserts
  it directly — nothing distinguishes a value a human clicked from one an
  agent (or, today, nothing) supplied.
- **`explorationDraftSchema` has no citation field and allows fewer candidates
  than Strategy requires.** `lib/domain/contracts.ts:221-231`: no
  citation/source field on a candidate at all; `candidates` is
  `.min(1).max(5)`, where `PRODUCT_STRATEGY.md` Workflow B requires 3-5.
- **No `Owned`/`Watchlist` distinction exists at the schema level.**
  `theses.status` (`db/schema.ts:38`) is `enum: ['active', 'archived']` only.
  `PRODUCT_STRATEGY.md` §3: *"Each company may be tagged `Owned` or
  `Watchlist`."*
- **The Sidebar "Track Asset" flow bypasses the thesis/status requirement, and
  collects data V1 says it shouldn't.** `components/Sidebar.tsx:104-121`
  opens a position-entry modal (ticker/shares/price) with no linked thesis or
  `Owned`/`Watchlist` choice required before submit (`:192` onward validates
  ticker/quantity/price only). The form also collects share quantity and buy
  price — `PRODUCT_STRATEGY.md` §3 states V1 *"does not collect quantity,
  cost basis, position value... or brokerage-account data."* Not fully
  verified: the product has shipped M001 through M011 since
  `PRODUCT_STRATEGY.md` was written, so this may already be covered by a
  later recorded decision this review didn't locate — needs a direct answer
  from the user before assuming it's an open gap, not just an assumption
  either way.

None of the five items above are blocking for the CLI/Control-Panel decision
itself — they're pre-existing product-behavior debt against `VISION.md`/
`PRODUCT_STRATEGY.md` that this plan happens to have surfaced by forcing a
direct read of the code it plans to reuse.

**User decision (2026-08-04): tracked separately, not a blocker.** This CLI
plan proceeds as scoped. The five items above are not resolved by this plan
and must not be assumed fixed — they need their own follow-up discussion,
outside this document. §5 step 4 ("move Generate-Recommendation... into an
explicit control-panel surface") relocates the existing
`generateDecisionRecommendation` behavior unchanged; it is still non-compliant
with Workflow E until that separate discussion resolves it.

**Follow-up discussion held and all five fixed, 2026-08-05.** In order:
`generateDecisionRecommendation`'s prompt no longer asks for or accepts an
action (`recommendedAction` removed from `decisionRecommendationSchema`
entirely, not merely nulled); `decisions` gained `evidenceIds`/`alternatives`
columns (migration `0010`); `explorationDraftSchema` gained a required
`citation` field per candidate and `candidates` now requires 3-5 per Workflow
B (was `.min(1).max(5)`); `portfolioPositions` replaced `shares`/
`averageBuyPrice` with a `status` (`owned`|`watchlist`) tag (migrations
`0010`/`0011`), and the Sidebar "Track Asset"/"Add Holding" form now collects
that tag instead of quantity/cost basis. All four verified by `tsc --noEmit`
and the full test suite (356 passed, 3 skipped) after the change, not merely
asserted. §5 step 4's "relocates unchanged" caveat above no longer applies —
the behavior it warned about was fixed at the source, not relocated.

### 8.1 New risks specific to the CLI plan (confirmed)

**Gap 1 — no mechanism carries the Moral Constitution into a CLI agent's
behavior.** Verified: `GEMINI.md` (root) redirects to `AGENTS.md`, which
routes to `.agents/{DELIVERY,QUALITY,SECURITY,LEARNING,RELEASE}.md` — all
five are engineering-process conventions; none reference `VISION.md`'s
Moral Constitution (no unsupported claims, no investment recommendations,
label uncertainty). The existing Web Chat route is presumably prompt-engineered
to follow that constitution; a general-purpose terminal agent (Gemini CLI,
Claude Code, Codex) is not, and will give ordinary opinions/rankings if asked,
which directly conflicts with `PRODUCT_STRATEGY.md` Workflow B (*"does not
identify a 'best' company"*) and Workflow E (*"must not preselect, recommend,
vote on... investment actions"*). **Action needed:** extend `AGENTS.md` (or a
new `.agents/PRODUCT_CONSTITUTION.md` it points to) with `VISION.md` §§6-7 as
binding instructions, since CLI agents already auto-load this file at session
start — cheapest available enforcement point, not a new mechanism.

**Gap 2 — no structural two-step confirm gate in the CLI scripts as sketched.**
`PRODUCT_STRATEGY.md` requires an explicit confirm step before durable state
changes in three places: Workflow A step 5, Workflow C step 5, and Workflow B
step 5 (*"No candidate enters the tracked universe until the user explicitly
selects it"*). The Web UI enforces this with two independent layers (disabled
button + server-side refusal in `confirmDraft`). A plain `thesis:draft` /
`thesis:create` script split is **necessary but not sufficient** — flagged by
a second independent review (Gemini): nothing stops an agent from calling
both scripts back-to-back in one turn with no real pause for human
agreement. **Action needed (updated, see §4.3):** the mutating script itself
must block on a live interactive stdin confirmation, not just exist as a
separate command. See §4.3 for the full requirement and its honest residual
risk (an agent can still pipe stdin input; the real backstop is a human
actually present at the terminal).

**Gap 3 — `decisions:record` can be driven entirely by CLI flags, with no
guarantee the value came from the user.** `PRODUCT_STRATEGY.md` Workflow E:
*"Investment actions are always entered by the user. The system must not
preselect, recommend, vote on, or execute them."* Verified against
`service.ts`: the decision-recording function accepts `outcome`,
`optionalAction` (`Buy`/`Hold`/`Reduce`/`Exit`), and `userReasoning` as plain
values — in the Web UI these are physically clicked by the user in a form,
but a script invoked as `npm run decisions:record -- --action Buy` cannot
tell whether `Buy` was typed by the human or inferred by the agent answering
"what should I do about TLKM?". Same fix as Gap 2: `decisions:record` must
require the action to be entered through an interactive stdin prompt inside
the script itself, never accepted as a pre-filled flag.

**Gap 4 — two additional risks found only by the independent review, not
present in this plan's first draft:**

- **Visual verdict-burial guarantee is terminal-specific, not universal.**
  `ResearchPanel` deliberately renders the verdict outside `.panelContent`
  so a breach cannot be visually buried (§2, and see `docs/CODEBASE_MAP.md`'s
  M011 notes). That guarantee is a *rendering* property — it does not carry
  over to a CLI agent relaying the same JSON as scrolling terminal text. The
  product-constitution file (Gap 1) should instruct the CLI agent to always
  lead with verdict/breach status, never bury it deep in a reply, and the
  plan should tell the user explicitly: for any thesis with a flagged
  breach, confirm it in the Web Dashboard before recording a decision, not
  from memory of what the agent said.
- **Data disclosure obligation.** `VISION.md` §6 point 4: *"Before data is
  sent to a provider, the product discloses the provider and applicable
  handling boundary."* Once thesis/assumption text is discussed in a
  terminal CLI session, and once `research:panel`'s JSON output is read back
  into that same session, that data reaches whichever cloud backend the CLI
  agent uses — which "the product" (jp-invest's own code) never initiates
  or discloses itself, unlike every other provider call in this codebase
  (`providerFetch`'s gate + `logs/outbound.log`). This is exactly what
  §7.1's governance-exception note needs to state plainly, not leave
  implicit. Sharpened by Luna's review: `.agents/SECURITY.md:13` classifies
  `portfolio, theses, decisions` as **Confidential**, requiring *"only
  explicitly approved providers and environments"* — the currently-approved
  list is Ollama Cloud only (`DEC-0010`). A generic CLI agent is not on it.
  This is a conflict with the project's own written security policy, not
  just a cautious inference — §7.1's "keep the data-classification spirit by
  discipline" line undersells it; the DEC-0017 recommended below needs to
  resolve this explicitly (either add the specific CLI tool to an approved
  list with its own terms, or explicitly scope what data classes may reach
  it), not leave it to discipline alone.

**Confirmed no conflict, but worth stating as an explicit guardrail:**
`PRODUCT_STRATEGY.md` §3 — *"Scheduled or autonomous background monitoring is
explicitly deferred."* Every CLI script in this plan is triggered inside a
live conversation turn, never a timer/watch loop. Worth writing down
explicitly so a future addition (e.g., "let the agent poll for changes")
doesn't silently cross this V1 boundary.

**Governance record needed.** Both independent reviews (Luna, Gemini)
converge on the same conclusion as §7.1: this doesn't need a
`PRODUCT_STRATEGY.md`/`VISION.md` amendment (both explicitly disclaim
authority over architecture/interface choices), but it does need a real,
lightweight **decision record** — next available number is **`DEC-0017`**
(confirmed against `docs/decisions/INDEX.md`; `DEC-0016` is already taken by
the M011 polarity-classifier boundary) — covering the interface architecture
change, the SQLite WAL/lease-owner concurrency model (§4.2), and the CLI
script design (interactive-confirmation requirement, §4.3). This is smaller
in scope than a full `DEC-0009`-style provider approval (per §7.1, the user
has already granted that exception), but "no DEC at all" is the same failure
shape as R-018's revert — a short, real record is cheap insurance against
repeating it.

**Written and accepted, 2026-08-05.**
[`DEC-0017`](../decisions/DEC-0017-cli-terminal-workflow-and-concurrency-model.md)
covers exactly this scope, written after — not before — the concurrency model
and shared-draft-creation refactor were implemented and verified, per this
paragraph's own sequencing logic. It also records that `decisions:record`'s
interactive-stdin-confirmation requirement remains an unbuilt prerequisite,
not retroactively satisfied.

## 9. References

Primary files this plan is grounded in (verified by direct read during
review, not assumed):

- `lib/ai/provider.ts`, `lib/ai/factory.ts`, `lib/ai/provider-gate.ts`,
  `lib/ai/provider-http.ts`, `lib/ai/adapters/ollama.ts`
- `db/client.ts` (SQLite pragma configuration, backup-on-every-call)
- `lib/research/service.ts` (`processResearchJobs`, `confirmDraft`,
  `generateDecisionRecommendation`, the import/restore path)
- `lib/research/pipeline.ts` (confirmed: no `LLMProvider` usage)
- `docs/decisions/DEC-0009-provider-security-gate.md`,
  `docs/decisions/DEC-0014-local-only-scope-reaffirmation.md`
- `docs/RISK_REGISTER.md` R-018 entry and its revert history
  (`d420a33`/`b9d3dd9`/`93acdab`)
- `docs/CODEBASE_MAP.md`
