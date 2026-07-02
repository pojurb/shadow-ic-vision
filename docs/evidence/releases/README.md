# Release And Verification Evidence

Store each verification or release package in a uniquely named directory, for
example `docs/evidence/releases/2026-07-01-M001-preview/`.

The package manifest records:

- commit SHA and environment
- milestone and acceptance criteria covered
- exact commands and checks run
- pass, fail, skipped, and blocked results
- model/provider and evaluation metadata when relevant
- browser screenshots or structured reports when required
- known risks and deferrals
- rollout, health checks, and rollback procedure
- approving authority and final outcome

Do not commit secrets, confidential user data, or unsanitized provider payloads
as evidence.
