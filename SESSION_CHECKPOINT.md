### Session Checkpoint (2026-07-03T22:30:00+07:00)

#### 1. Current Repository State

- Branch: `shadow-ic-vision`
- Base HEAD before this checkpoint update: `624ed0e`
- Working tree has staged changes for the M001 UI and Citation Pipeline.
- **Phase: Implementation**
- Initial Next.js App Router scaffold is complete.
- SQLite + Drizzle ORM schema is in place (`db/schema.ts`) and the first migration (`0000_...sql`) is generated.
- Project-owned `LLMProvider` interface and `MockProvider` are implemented.
- **React Conversational UI** (`app/c/[id]`) is built and wired to the database.
- **Citation Pipeline** (`lib/research/pipeline.ts`) is built with SEC/IDX stubs and exact-match verifier.
- `ACTIVE_MILESTONE.md` points to M001 (Implementation phase).
- `DEC-0007-governed-builder-learning.md` is `accepted` and `.agents/LEARNING.md` is `active`.
- `docs/learning/PROMOTIONS.md` is `active` with one promoted entry (`LC-20260703-001`).
- `ACTIVE_MILESTONE.md` updated to reflect implementation phase.
- `README.md` updated to reflect implementation phase.

#### 2. Outstanding User Decisions And Stop Point

- **Cloud provider decision deferred**: `DEC-0009` (cloud provider approval) is explicitly deferred until the local mock implementation is fleshed out.
- The stop point is: review the finished Option A (UI) and Option B (Citation Pipeline) and decide if we are ready to merge or move to wiring them together into a complete end-to-end flow.

#### 3. Verified Work Completed

##### M001 Gate 4a
- Resolved the evaluation-package audit findings.
- Expanded `docs/evals/M001/cases.json` to 16 cases.
- Updated `docs/evals/M001/EVAL_GUIDE.md`.
- Accepted DEC-0005.

##### Governed Builder-Learning Activation
- User explicitly accepted DEC-0007.
- Updated status of `DEC-0007` to `accepted` and `.agents/LEARNING.md` to `active`.
- Synchronized `AGENTS.md`, `.agents/SECURITY.md`, `README.md`, and `docs/RISK_REGISTER.md` to integrate the learning loop policy.
- Retained release manifest at `docs/evidence/releases/2026-07-03-builder-learning-activation/manifest.md`.

##### Learning Promotion
- Created and validated candidate `LC-20260703-001` capturing the gap in primary agent self-reviews when drafting ADRs.
- Promoted `LC-20260703-001` into `.agents/QUALITY.md` under the new "Architecture ADR Completeness" section.
- Updated `docs/learning/PROMOTIONS.md` and `docs/learning/INDEX.md` to active and promoted statuses.

##### M001 Multimodal Amendment (DEC-0008) — ACCEPTED
- Drafted and accepted `docs/decisions/DEC-0008-m001-multimodal-amendment.md`.
- Added 16 synthetic multimodal cases covering text PDFs, OCR, tables, charts, screenshots, XBRL, provenance, degraded states, chunking, and document prompt injection.
- Added `docs/evals/M001/MULTIMODAL_EVAL_GUIDE.md` with hard gates, fixture-rendering rules, model comparison requirements, browser states, and additive reporting fields.

#### 3. Verified Work Completed

##### M001 Implementation Scaffold
- Initialized Next.js App Router cleanly over the repository root without destroying existing documentation.
- Configured `.env.example` and `next.config.ts` (Node runtime via `serverExternalPackages`).
- Created `db/client.ts`, `db/schema.ts`, and generated the initial `0000` SQL migration for SQLite using Drizzle ORM.
- Established the AI Abstraction Boundary (`lib/ai/provider.ts` and `lib/ai/adapters/mock.ts`) completely decoupled from the AI SDK native types.
- Built the **React Conversational UI** (`components/Sidebar.tsx`, `components/ChatUI.tsx`, `app/api/chat/route.ts`).
- Built the **Deterministic Citation Pipeline** (`lib/research/pipeline.ts`) with cryptographic hashing and exact-match verification.
- TypeScript compiler and Drizzle generator confirmed the schema and abstraction types are flawless.

- `AGENTS.md` remains the canonical shared playbook.
- Chat history and this checkpoint provide handoff context; they do not override accepted vision, strategy, milestone, decision, evaluation, or policy files.
- Meaningful tasks must report promoted lessons consulted and learning candidates created.
- Learning candidates are evidence, not authority. They cannot guide work until promoted with explicit user approval if they change behavior, architecture, or policy.
- Do not place confidential investment data, credentials, or restricted data in learning artifacts.
- Do not send confidential data (thesis text, assumptions, portfolio info) to any cloud LLM until `DEC-0009` is accepted.

#### 5. Exact Next Steps

1. **Option 1**: Wire the UI and the Citation Pipeline together to simulate an end-to-end "Intake -> Research -> Verify" loop.
2. **Option 2**: Revisit `DEC-0009` and select a real LLM provider (Ollama Cloud or OpenAI) to replace the `MockProvider`.

#### 6. Verification Limits

- Only typescript compilation and Drizzle schema generation have been verified.
- The Citation Pipeline logic is fully unit-tested with the deterministic `test-pipeline.ts` script.
- Live LLM calls and live web scraping are intentionally deferred/stubbed.

Promoted lessons consulted: `LC-20260703-001`

Learning candidates created: `none`
