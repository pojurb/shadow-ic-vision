# Codex Protocol (v3) - Multi-Model Operational Playbook

This is the canonical operating contract for every AI or human contributor in
this repository. It applies to Codex, Claude Code, Gemini CLI, Ollama-backed
agents, and future tools.

Model-specific entrypoints may import this file and add loader-specific notes,
but they must not duplicate or redefine shared policy. If guidance conflicts,
explicit user instructions and platform safety rules take precedence, followed
by this file and then the supporting policy files under `.agents/`.

## Prime Directive

- Product vision comes before product strategy, architecture, stack, and code.
- Do not write product code, install production dependencies, or define a
  persistent schema until `VISION.md` is explicitly approved and an active
  milestone has passed its readiness gates.
- Technology choices must follow approved product requirements. They may not be
  inserted into vision or early product decisions as hidden assumptions.
- Work only inside the approved milestone. Do not silently expand scope.

## Required Read Order

Before substantive work, read:

1. `AGENTS.md`
2. `VISION.md`
3. `README.md`
4. `ACTIVE_MILESTONE.md`
5. The active packet under `docs/milestones/`, if one exists
6. The policy relevant to the task:
   - `.agents/DELIVERY.md` for planning and status changes
   - `.agents/QUALITY.md` for implementation, evaluation, and closure
   - `.agents/SECURITY.md` for data, providers, dependencies, and external access
   - `.agents/RELEASE.md` for source control, deployment, and rollback
   - `.agents/LEARNING.md` for task capture, active-day review, and promotion

Read only the additional documents needed for the active task. Chat history is
context, not project authority.

## Decision Rights

- The user owns vision approval, product tradeoffs, risk acceptance, and
  authorization of consequential or production changes.
- Agents may inspect, draft, implement, test, and prepare releases inside an
  approved milestone and within granted permissions.
- The primary agent remains accountable for delegated work. Subagents and
  alternate models may not broaden scope or override project policy.
- A model may not be the sole reviewer of its own high-risk output. Use
  independent model review plus deterministic checks where risk warrants it.
- Model agreement is not evidence. Resolve disagreements using approved
  requirements, primary sources, test results, and retained artifacts.

## Delivery Lifecycle

Work moves through these gates in order:

1. **Vision approved** - target user, problem, promise, boundaries, horizons,
   and success measures are explicit.
2. **Strategy ready** - first wedge, non-goals, product risks, and outcome
   measures are recorded in `docs/PRODUCT_STRATEGY.md` and
   `docs/RISK_REGISTER.md`.
3. **Milestone ready** - a versioned packet defines workflows, states, data
   rules, acceptance criteria, and deferrals; `ACTIVE_MILESTONE.md` points to it.
4. **Evaluation ready** - deterministic tests, model evals, adversarial cases,
   and required human or browser checks are defined from the milestone contract.
5. **Architecture ready** - material technical decisions and alternatives are
   recorded under `docs/decisions/`; architecture is limited to milestone needs.
6. **Implementation verified** - code, tests, evals, security checks, build, and
   user-visible verification pass with retained evidence.
7. **Release approved** - rollout, monitoring, rollback, and release authority
   satisfy `.agents/RELEASE.md`.

Detailed readiness and closure rules live in `.agents/DELIVERY.md`.

## Sources of Truth

| Concern | Authority |
|---|---|
| Product north star and boundaries | `VISION.md` |
| Wedge, sequencing, and outcome metrics | `docs/PRODUCT_STRATEGY.md` |
| Known product, technical, security, and operational risks | `docs/RISK_REGISTER.md` |
| Current work pointer and stop point | `ACTIVE_MILESTONE.md` |
| Approved milestone behavior | `docs/milestones/M###-*.md` |
| Evaluation cases and rubrics | `docs/evals/M###/` |
| Product and architecture decisions | `docs/decisions/` |
| Release and QA facts | `docs/evidence/releases/` |
| Repository orientation only | `README.md` |

Evidence establishes what happened; specifications establish what should
happen. If authorities conflict, stop, identify the stale document, and update
all affected authorities before claiming readiness or completion.

## Multi-Model Rules

- All models use this playbook and the same approved milestone contract.
- Select models using measured task performance, privacy constraints, cost, and
  latency rather than provider reputation alone.
- Record provider, model identifier, prompt or rubric version, important
  settings, and evaluation result when model output affects release evidence.
- Use a different provider or model for independent review when practical, but
  never substitute model consensus for tests or source evidence.
- Ollama Cloud and other hosted open-model services are cloud processors. Treat
  them according to `.agents/SECURITY.md`; open weights do not imply local or
  private execution.
- Direct API or `ollama run` workflows must inject this playbook into the agent
  system context. A raw model invocation does not automatically read the repo.

## Playbook Synchronization Rule

Every playbook change must remain internally consistent:

1. Update this file when shared authority, lifecycle, or non-negotiable rules
   change.
2. Update the owning `.agents/*.md` module when its detailed control changes.
3. Update `README.md` when entrypoints, build sequence, or current phase changes.
4. Update `CLAUDE.md` or `GEMINI.md` only when their loader-specific behavior
   changes; their imports automatically inherit shared policy changes.
5. Update templates and current milestone/eval/evidence files when a policy
   change alters their required shape.
6. Search the repository for stale terminology and old paths before finishing.

Do not copy shared policy into model adapters. One canonical rule plus imports
is the mechanism that prevents cross-model drift.

## Completion Reporting

At the end of meaningful work, report:

- promoted lessons consulted
- learning candidates created
- files changed
- decisions made and assumptions used
- verification actually run and exact results
- blockers or verification not run
- the next approved step

Never claim that work passed, shipped, or is production-ready without evidence.
