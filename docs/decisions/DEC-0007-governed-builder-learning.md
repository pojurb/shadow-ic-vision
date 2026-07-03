# DEC-0007 - Governed Builder-Learning Loop

Status: `accepted`

Date proposed: 2026-07-02
Date accepted: 2026-07-03

Approving authority: user

## Context

JP Invest is built with multiple AI coding and review models. The current
playbook preserves product decisions, milestone contracts, evaluation assets,
and release evidence, but it does not define how confirmed lessons from daily
development become reusable knowledge for future models.

Without a governed learning loop, useful procedures remain trapped in chat
history, repeated failures are not systematically converted into safeguards,
and model changes can be driven by reputation rather than retained evidence.
Uncontrolled self-modification would create the opposite risk: an agent could
promote an incorrect conclusion into policy, prompts, code, or evaluation
expectations without the required authority.

## Decision Requested

Adopt a model-neutral builder-learning loop with these boundaries:

- meaningful tasks report relevant promoted lessons consulted and learning
  candidates created, including an explicit `none` when applicable;
- confirmed reusable lessons are captured after tasks and reviewed once at the
  end of an active development day when candidates exist;
- milestone-gate reviews revalidate promoted lessons and repeated failures;
- candidate records are evidence, not authority;
- low-risk procedural lessons may be promoted by the primary agent only after
  independent review and deterministic evidence;
- changes affecting product behavior, architecture, security, providers,
  runtime prompts, model routing, approved evaluation expectations, governing
  policy, or risk acceptance require explicit user approval;
- learning may propose code changes, but code is changed only through the
  active milestone and normal authorization;
- confidential investment information and restricted data are excluded from
  learning artifacts; synthetic or redacted examples are used instead;
- model selection remains manual and advisory until a retained comparison
  satisfies the approved learning policy.

The detailed proposed controls are defined in `.agents/LEARNING.md`. They do
not become active until this decision is accepted and the canonical playbook is
synchronized.

## Options Considered

1. Keep development learning in individual chat histories and provider memory.
2. Allow agents to modify shared instructions and code automatically.
3. Use a repository-based, evidence-gated, model-neutral learning loop
   (selected proposal).

## Consequences If Accepted

- `AGENTS.md` will require task-start retrieval and task-close learning
  reporting for meaningful work.
- `.agents/LEARNING.md` will become the detailed policy owner.
- `docs/learning/` will hold candidates, the searchable index, and promotion
  records without becoming a second product authority.
- Security and risk policy will explicitly cover learning-artifact poisoning,
  stale guidance, context bloat, and confidential-data capture.
- Claude, Gemini, Codex, Ollama-backed agents, and future tools will use the
  same repository knowledge rather than provider-specific copies.
- Product-runtime learning remains outside this decision and requires its own
  milestone contract.

## Reversal Or Supersession

Supersede this decision if the learning process creates excessive overhead,
unreliable promotions, or a better model-neutral mechanism becomes available.
Reversal must preserve historical candidates and promotion evidence, mark
affected lessons as superseded, remove active loader references, and restore
the prior canonical playbook in one synchronized change.

## Affected Files If Accepted

- `AGENTS.md`
- `.agents/LEARNING.md`
- `.agents/SECURITY.md`
- `README.md`
- `docs/RISK_REGISTER.md`
- `docs/learning/`
