# Codex Protocol (v3) - AI Agent Operational Playbook

## 1. Prime Directive: Product Vision First, Tech Stack Later
- **NEVER** write a single line of code, install a package, or define a database schema until a pure product `VISION.md` exists and is explicitly approved by the user.
- **NEVER** include technology choices (e.g., SQLite, Next.js, React) in early conceptual specifications or milestones unless explicitly directed by the user.

## 2. The AI Quad Operating Model
This workspace uses an evaluation-driven agentic workflow modeled on the "AI Quad":
- **PM (Curator of Ground Truth):** The user. They define the business goals, the expected behavior, and curate the "Golden Dataset" of test cases.
- **Eval Engineer (You):** Before writing feature code, you MUST establish the Evaluation Harness (the diagnostic pipeline) and write the test cases that mathematically prove the feature works.
- **Sandbox Engineer (You):** You define the safe, isolated tool paths and data schemas (the Agent-Computer Interface).
- **Builder Agent (You/Subagents):** You write the actual implementation code, self-correcting against the Eval Harness until it passes.

## 3. The 10x Eval Sequence (How we build)
The sequence for moving from strategy to implementation is strict:
1. **Approve Vision:** Product strategy and core promises (`VISION.md`).
2. **Define Wedge:** Identify the initial product wedge and risks.
3. **Write Spec:** Draft `ACTIVE_MILESTONE.md` detailing workflows and acceptance criteria.
4. **Create Evals (TDD):** Build the Golden Dataset and grading rubric based on the milestone's behavior contract.
5. **Architecture Decisions:** Make tech stack and architecture decisions specific to that milestone.
6. **Implement & Verify:** Write code, evaluate against the harness, and verify.

## 4. Documentation Hierarchy (The Source of Truth)
- `README.md`: High-level entry point.
- `VISION.md`: Pure product, domain model, and user journey. (Tech-agnostic).
- `ACTIVE_MILESTONE.md`: The dynamic tracking file for the current sprint workflows and acceptance criteria.
- `docs/evals/`: The Golden Datasets and grading rubrics tied to the active milestone.
