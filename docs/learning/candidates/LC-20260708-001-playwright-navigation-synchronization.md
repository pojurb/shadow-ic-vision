# LC-20260708-001 - Playwright Navigation Synchronization

Status: `candidate`

Captured: `2026-07-08`

Milestone: `M001`

Task type: `implementation`

Classification: `quality`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During DEC-0009 provider-gate verification, `npm run verify:full` exposed an
intermittent Playwright failure in the M001 vertical-slice test. The `+ New`
button posted a new conversation, but the test asserted the `/c/<id>` URL
immediately after the click. In some runs, the assertion raced the client-side
navigation and stayed on `/`, even though the app behavior and API route were
otherwise valid.

The stable fix was to synchronize the test on the relevant repository-owned
API calls: wait for the initial `GET /api/conversations`, wait for the
`POST /api/conversations`, assert the response id, and then assert navigation
to `/c/<id>`.

## Evidence

- Commit, run, or evidence ID:
  - `89fb977e6348e0a4a2717e5e88c454c5daeb8902`
  - `docs/evidence/releases/2026-07-08-dec-0009-poc-provider-gate/manifest.md`
- Commands or checks:
  - `npm run test:e2e`
  - `npm run verify:full`
- Exact result:
  - Initial full verification exposed a `toHaveURL(/\/c\/[0-9a-f-]+$/)`
    timeout after clicking `+ New`.
  - After synchronizing on the `GET` and `POST /api/conversations` responses,
    `npm run test:e2e` passed with 3 Playwright checks and
    `npm run verify:full` passed.
- Related review finding or incident:
  - The failing Playwright context showed the home page still at `/` after the
    click, with no product-code provider-gate failure involved.

Do not include confidential investment data, restricted data, or secrets.

## Proposed Reusable Lesson

When a Playwright flow depends on client-side navigation triggered by an API
mutation, synchronize on the app-owned request and response before asserting
the destination URL. Prefer asserting the created resource id from the response
and matching the final route from that id. Do not treat a navigation timeout as
a product regression until the API response and route side effects have been
checked.

## Scope And Risks

- Applies to:
  - Repository-owned browser QA for mutation-triggered navigation.
  - M001 e2e flows where a client component posts to an app route and then
    calls `router.push`.
- Does not apply to:
  - Server redirects where the navigation is the HTTP response itself.
  - Product behavior changes where the API response fails or returns invalid
    data.
- Known failure modes:
  - Waiting on too broad a response pattern can make tests pass for the wrong
    request.
  - Hard-coded ids in browser tests can hide stale fixture assumptions.
- Conflicting authority checked:
  - `AGENTS.md`
  - `.agents/LEARNING.md`
  - `docs/CODEBASE_MAP.md`

## Independent Review

- Reviewer:
- Review date:
- Evidence reproduced: `no`
- Duplicate or conflict check:
- Privacy check:
- Disposition: `needs-more-evidence`
- Reason:

## Promotion Or Supersession

- Decision authority:
- Decision date:
- Promotion target: `.agents/QUALITY.md`
- Promotion registry entry:
- Supersedes:
- Superseded by:
- Rollback path:
  - Revert the promotion entry and any `.agents/QUALITY.md` wording if later
    browser QA evidence shows this guidance is too broad or conflicts with a
    stronger repository testing pattern.
