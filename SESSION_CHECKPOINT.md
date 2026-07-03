### Session Checkpoint (2026-07-03T21:11:00+07:00)

#### 1. Current Repository State

- Branch: `shadow-ic-vision`
- Base HEAD before this checkpoint update: `41b126e`
- Working tree was clean before editing this file.
- Vision, product strategy, M001 milestone packet, and M001 evaluation package are accepted.
- Gate 4 evaluation readiness is complete through accepted `DEC-0005-evaluation-ready.md`.
- `DEC-0007-governed-builder-learning.md` is `accepted` and the `.agents/LEARNING.md` policy is `active`.
- `docs/learning/PROMOTIONS.md` is `active` and has registered its first active promotion (`LC-20260703-001`).
- The current product phase is Architecture Planning. The next authorized M001 artifact is `docs/decisions/ADR-0006-m001-stack.md`.
- Product implementation remains blocked until the M001 architecture decision is accepted.

#### 2. Outstanding User Decisions And Stop Point

- The user has authorized M001 architecture work and requested drafting of ADR-0006.
- The revised `ADR-0006-m001-stack.md` is currently `proposed`. It requires explicit user acceptance before we can conclude the Architecture phase and unlock product implementation.
- The stop point is user acceptance of `ADR-0006-m001-stack.md`.

#### 3. Verified Work Completed

##### M001 Gate 4
- Resolved the evaluation-package audit findings.
- Expanded `docs/evals/M001/cases.json` to 16 cases.
- Updated `docs/evals/M001/EVAL_GUIDE.md`.
- Accepted DEC-0005.

##### Governed Builder-Learning Activation
- User explicitly accepted DEC-0007.
- Updated status of `DEC-0007` to `accepted` and `.agents/LEARNING.md` to `active`.
- Synchronized `AGENTS.md`, `.agents/SECURITY.md`, `README.md`, and `docs/RISK_REGISTER.md` to integrate the learning loop policy.
- Verified that model adapters `CLAUDE.md` and `GEMINI.md` did not duplicate the policy.
- Retained release manifest at `docs/evidence/releases/2026-07-03-builder-learning-activation/manifest.md`.

##### Learning Promotion
- Created and validated candidate `LC-20260703-001` capturing the gap in primary agent self-reviews when drafting ADRs.
- Promoted `LC-20260703-001` into `.agents/QUALITY.md` under the new "Architecture ADR Completeness" section.
- Updated `docs/learning/PROMOTIONS.md` and `docs/learning/INDEX.md` to active and promoted statuses.
- Committed promotion under commit `41b126e`.

##### revised M001 Stack ADR
- Drafted a fully revised `docs/decisions/ADR-0006-m001-stack.md` incorporating all independent review findings (Next.js Node server loopback-only, SQLite/better-sqlite3 local contract, Drizzle ORM + migrations, Vercel AI SDK provider interface, Ollama Cloud candidate status, research jobs state machine, citation pipeline, source adapters, and test architecture).

#### 4. Important Authority And Safety Rules

- `AGENTS.md` remains the canonical shared playbook.
- Chat history and this checkpoint provide handoff context; they do not override accepted vision, strategy, milestone, decision, evaluation, or policy files.
- Meaningful tasks must report promoted lessons consulted and learning candidates created.
- Learning candidates are evidence, not authority. They cannot guide work until promoted with explicit user approval if they change behavior, architecture, or policy.
- Do not place confidential investment data, credentials, or restricted data in learning artifacts.
- Do not write product code, choose persistent schemas, or install production dependencies before ADR-0006 is accepted.

#### 5. Exact Next Steps

1. Wait for user review and explicit acceptance of `docs/decisions/ADR-0006-m001-stack.md`.
2. Once ADR-0006 is accepted, initialize the Next.js project layout and local database schema according to the stack specification.

#### 6. Verification Limits

- Product build and testing are paused pending architectural decisions.
- Ollama Cloud is a provider candidate only; no API keys or cloud connections will be run until a separate security decision is accepted.

Promoted lessons consulted: `none`

Learning candidates created: `LC-20260703-001`
