# Milestone Packets

Create immutable, versioned packets using names such as
`M001-thesis-intake.md`. `ACTIVE_MILESTONE.md` points to exactly one active
packet.

Each packet must contain:

1. Status and approval
2. User-visible outcome
3. Scope and non-goals
4. Workflows, states, validation, and recovery behavior
5. Data inputs, outputs, persistence, compatibility, deletion, and export rules
6. Implementation slices
7. Security and provider constraints
8. Deterministic tests, model evals, browser checks, and acceptance criteria
9. Assumptions, risks, and explicit deferrals
10. Closure evidence links

Do not overwrite a completed packet to hide a changed decision. Record the
change under `docs/decisions/` and create a follow-up packet when necessary.
