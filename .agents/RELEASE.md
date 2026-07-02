# Source Control, Release, And Operations Policy

This file defines how verified work reaches users and how it is recovered when
something fails.

## Source Control

- Use short-lived branches and intentional, reviewable commits.
- Do not push directly to a protected production branch.
- Preserve unrelated user changes and do not use destructive history-rewriting
  commands without explicit authorization.
- Each change must trace to an approved milestone slice, defect, or decision.

## Required Change Checks

Before merge, run the checks required by `.agents/QUALITY.md` and the active
milestone. Once implementation tooling exists, CI must enforce applicable:

- formatting, lint, and types
- deterministic tests and build
- Golden Dataset regression evals
- dependency, license, secret, and security scans
- browser/interface verification
- migration and backup/import checks

Instructions guide agents; CI, hooks, permissions, and branch protection enforce
non-negotiable controls.

## Environments And Promotion

Promote the same version through local, preview/staging, and production where
those environments exist. Do not rebuild different source for production.

Until the user explicitly changes this policy, production deployment requires
user approval after verification evidence is available.

## Release Package

Every release record under `docs/evidence/releases/` includes:

- version or run identifier and commit SHA
- included milestone slices and user-visible changes
- checks run, results, and artifact paths
- known risks and deferred issues
- environment/configuration changes without secret values
- rollout steps, health signals, and rollback procedure
- approving authority and release outcome

## Observability And Recovery

- Define health signals, structured errors, audit events, and privacy-safe
  telemetry before external release.
- Classify incidents by user impact and data/security impact.
- Prefer reversible migrations, feature isolation, and tested rollback paths.
- If release health is uncertain, stop rollout or roll back; do not debug by
  making unverified production changes.
- Record incidents and corrective actions as retained project evidence.
