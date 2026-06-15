---
name: product-trio-spec
description: Create, revise, or review project milestone specs, roadmap specs, execution packets, or Product Trio planning documents. Use when drafting or updating docs/milestones/m[X]_spec.md, translating EXECUTION_PLAN.md into a milestone packet, or checking PM, Principal Engineer, and Product Designer contributions with QA verification gates.
---

# Product Trio Spec

Use this skill to produce decision-complete milestone packets for this repo.

## Operating Rules

- Treat `EXECUTION_PLAN.md` as the source of truth for milestone lifecycle, packet structure, and quality gates. Read it before drafting, revising, or reviewing a milestone spec.
- Respect the root `AGENTS.md` lazy-loading gate. Do not read `system/core.md` or `data/Portfolio_Master_State.md` unless the user explicitly asks for new investment analysis of an asset or issuer.
- Create or update the authoritative milestone packet at `docs/milestones/m[X]_spec.md`.
- Keep the trio in one shared packet. Separate PRD, TDD, and design files are scratch only unless the user explicitly requests them.

## Role Contract

- Product Manager owns outcome, sequencing, user value, scope boundaries, workflows, edge cases, and acceptance criteria.
- Principal Engineer owns data model, types, persistence, normalization, compatibility, helper logic, migration risk, and testability.
- Product Designer owns UI workflow, entry points, hierarchy, empty/active/error states, responsive behavior, and copy-sensitive interaction behavior.
- QA is represented through verification gates, browser QA scenarios, regression checks, and acceptance evidence. Do not make QA a fourth authoring role.

## Workflow

1. Identify the milestone number and title from the user request or repo roadmap context.
2. Read `EXECUTION_PLAN.md` and any existing `docs/milestones/m[X]_spec.md` before editing.
3. Use the packet structure defined in `EXECUTION_PLAN.md`:
   - `Summary`
   - `Product And UX Contract`
   - `Engineering Contract`
   - `Implementation Slices`
   - `Verification`
   - `Assumptions And Deferrals`
4. Merge PM, Principal Engineer, and Product Designer judgment into the shared sections instead of writing role-separated essays.
5. Put QA expectations in `Verification`, including unit/integration checks, browser QA paths, regression coverage, acceptance criteria, and evidence expected at close.
6. Name explicit deferrals and compatibility assumptions so implementation does not invent product or data rules later.

## Review Standard

Before considering a packet ready, verify that:

- PM can explain the user-visible behavior, non-goals, and acceptance criteria.
- Engineering can implement without inventing schema, persistence, normalization, or migration behavior.
- Design can describe each touched screen state and responsive behavior without new product decisions.
- Verification covers global quality gates from `EXECUTION_PLAN.md` plus milestone-specific checks.
- The packet is scoped to the active milestone and does not silently pull in later roadmap work.
