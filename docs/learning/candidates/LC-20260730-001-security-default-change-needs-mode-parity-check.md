# LC-20260730-001 - Security Default Change Needs Mode-Parity Check

Status: `candidate`

Captured: `2026-07-30`

Milestone: `cross-cutting`

Task type: `review`

Classification: `security`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

A same-day change (commit `d420a33`, 2026-07-29) wired the optional
`InstructionClassifier` (R-018's second-opinion injection scanner) into
`lib/research/service.ts`'s `dependencies()` block by default, and marked
R-018 `Mitigated` in `docs/RISK_REGISTER.md`. The construction was
unconditional — it did not check `getResearchSourceMode()` before deciding
whether to build a real classifier. `RESEARCH_SOURCE_MODE` (mock vs. live
sources) and `LLM_PROVIDER_TYPE` (mock vs. ollama) are independent env vars
read in unrelated modules (`lib/research/config.ts` vs. `lib/ai/factory.ts`),
and nothing else in the call chain reconciles them. Independently traced the
actual gate logic in `lib/ai/provider-gate.ts` and confirmed the call would
not be blocked there either (`runtime: { deployment: 'local' }` satisfies
`isLoopbackRuntime`). Net effect: in this repo's own `.env`
(`LLM_PROVIDER_TYPE=ollama`), a thesis run in deterministic **mock** research
mode — meant to be fully offline — would make real, billed Ollama Cloud calls
for every extracted document, violating the Critical Invariant in
`docs/CODEBASE_MAP.md` ("Mock research is the deterministic default; live
checks are opt-in" / "Unit, build, and browser tests must not make live
source or provider calls").

The change shipped with zero new tests. The pre-existing
`createInstructionClassifier` unit tests (`tests/document-extraction.test.ts`)
exercise the function in isolation and could not have caught this, since the
defect is specifically in the default-wiring call site, not the function
itself. `vitest.config.ts` hardcodes `LLM_PROVIDER_TYPE: 'mock'` for the test
environment, which is exactly why the full suite (237 tests) still passed
clean after the change — the test harness's own isolation masked the bug.

## Evidence

- Commit, run, or evidence ID: `d420a33` (introduced), `b9d3dd9` (revert)
- Commands or checks: read `lib/ai/provider-gate.ts` and `lib/ai/factory.ts`
  directly to confirm no mode reconciliation exists; read `.env` to confirm
  `LLM_PROVIDER_TYPE=ollama` is the real configured value; read
  `vitest.config.ts` to confirm why the test suite didn't surface it;
  `npx vitest run` — 237 passed both before and after, confirming the test
  suite could not distinguish the defective and reverted states
- Exact result: confirmed live-call path reachable under real repo config
  with `RESEARCH_SOURCE_MODE` unset/mock; no test asserts the default-wiring
  behavior at all
- Related review finding or incident: ad hoc code review requested by the
  user ("let's review that"), 2026-07-30, covering commit `d420a33`

Do not include confidential investment data, restricted data, or secrets.
This candidate contains none.

## Proposed Reusable Lesson

When a change flips a provider-calling code path from opt-in to on-by-default
(or otherwise widens when a real provider call happens), check it against
**every** axis this codebase already uses to distinguish deterministic/local
behavior from live/external behavior — not just the one the change happens to
be about. Concretely: `RESEARCH_SOURCE_MODE` and `LLM_PROVIDER_TYPE` are two
of at least two independent "is this call real" switches in this codebase;
a change that only reasons about one (here, whether a classifier exists at
all) can silently reintroduce a live call through the other. Before marking
a risk-register row `Mitigated` on the strength of a new default, verify the
default respects the deterministic-mode boundary, not just that the feature
technically works when explicitly enabled.

Applies whenever a change makes a previously-optional external call
automatic. Does not apply to changes that stay opt-in, or to changes that
already explicitly gate on every relevant mode flag (the pattern to follow
is `sourceMode`-gating already used elsewhere, e.g. M010's
`sourceTier === 'secondary'` gate in `rankSentenceCandidates`).

## Scope And Risks

- Applies to: any change wiring a new default provider/model call into a
  path that can also run in a deterministic/mock/offline mode
- Does not apply to: opt-in-only changes; changes to a path with no
  mock/live distinction at all
- Known failure modes: the reviewer checks "does the gate function block
  disallowed data classes/environments" (it does) without separately
  checking "is this call reachable at all in a mode meant to be fully
  offline" (a different question the gate was never designed to answer)
- Conflicting authority checked: `docs/CODEBASE_MAP.md` (Critical
  Invariants — mock research determinism), `.agents/LEARNING.md`
  (explicit-approval requirement for provider/security changes),
  `.agents/DELIVERY.md` (change must trace to a milestone/defect/decision)
  — none of these are superseded or altered by this candidate; the lesson
  reinforces the first one by naming a concrete way it can be silently
  violated

## Independent Review

- Reviewer:
- Review date:
- Evidence reproduced: `no`
- Duplicate or conflict check:
- Privacy check:
- Disposition: `needs-more-evidence`
- Reason: not yet independently reviewed by anyone other than the agent who
  captured it; per `.agents/LEARNING.md`, a security/process lesson like this
  needs an independent reviewer and, if it were to touch product behavior
  again, explicit user approval — neither has happened yet

## Promotion Or Supersession

- Decision authority:
- Decision date:
- Promotion target:
- Promotion registry entry:
- Supersedes: none
- Superseded by: none
- Rollback path: not yet promoted; nothing to roll back
