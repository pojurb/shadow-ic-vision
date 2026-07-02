# DEC-0003 - Approve Product Strategy and V1 Wedge

Status: `proposed`

Date proposed: 2026-07-02

Approving authority: user

## Context

`docs/PRODUCT_STRATEGY.md` must pass the strategy gate before the first active milestone packet can be designed, evaluated, and implemented.

The strategy document translates the approved vision into a concrete V1 release contract:
- Narrows the scope to Indonesian and US public equities for up to 100 companies.
- Explicitly defers automated background monitoring in favor of an on-demand review loop to control risk.
- Establishes two entry paths (Existing Thesis vs Explore).
- Defines a strict sequence of 4 vertical milestones, starting with the "Existing Thesis Loop".
- Enforces strict source priority (e.g., IDX disclosures, SEC filings).

## Decision Requested

Approve `docs/PRODUCT_STRATEGY.md` as the definitive strategic boundaries and sequencing for the V1 release.

Approval authorizes the creation of the first Milestone Packet (`M001-existing-thesis-loop.md`) and updates the `ACTIVE_MILESTONE.md` pointer. It does not authorize architecture, tech stack, or product implementation.

## Options

1. Accept the strategy and unblock Milestone 1 packet creation.
2. Request targeted changes to the scope, workflows, or sequence while keeping this decision proposed.
3. Reject the direction entirely.

## Consequences If Accepted

- `docs/PRODUCT_STRATEGY.md` status changes to `accepted`.
- `ACTIVE_MILESTONE.md` gate advances to Milestone Definition.
- The Eval Engineer (AI) is authorized to draft `M001-existing-thesis-loop.md` outlining the exact data schemas and behaviors for the first vertical slice.

## Affected Files

- `docs/PRODUCT_STRATEGY.md`
- `ACTIVE_MILESTONE.md`
- `README.md`
