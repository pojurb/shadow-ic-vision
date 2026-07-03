# LC-20260703-001 - Architecture ADR First Draft Misses Deployment And Pipeline Boundaries

Status: `promoted`

Captured: `2026-07-03`

Milestone: `M001`

Task type: `review`

Classification: `quality`

Privacy class: `synthetic`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

The initial draft of ADR-0006 was produced by the primary agent and reviewed
twice independently. The draft was declared "not ready for approval" by both
reviews. The primary agent's self-review identified only 5 gaps; the two
independent reviews identified 12 substantive gaps, several of which were
blocking. The primary agent specifically missed:

1. The SQLite/Vercel ephemeral filesystem conflict (critical deployment error).
2. The full citation pipeline architecture — the agent stated "fetch + cheerio"
   as if those were sufficient; the verifier architecture requires an ordered
   sequence: adapter → snapshot → canonical text → hash → exact match → evidence.
3. The SEC rate limit (10 req/s) and the need for source-specific adapters
   with User-Agent, caching, and backoff.
4. The research job state machine (`queued / running / succeeded / degraded /
   failed`) and restart recovery.
5. The verification architecture section — missing entirely from the first draft.
6. That Ollama Cloud required a security decision before becoming an "initial
   provider" (the agent correctly flagged the data boundary but still named it
   the approved initial provider in the decision table).
7. That "provider swapping is one line" with the Vercel AI SDK is overstated —
   each provider must pass the full eval suite.

## Evidence

- ADR-0006 original draft at commit `b8700a2` (pre-revision).
- Independent review 1: user-provided, 2026-07-03, identified 10 required
  changes.
- Independent review 2: user-provided, 2026-07-03, identified 5 additional
  gaps in the primary agent's self-review and confirmed the same set of
  blocking items.
- Revised ADR-0006 produced incorporating all findings. No code changed.

## Proposed Reusable Lesson

**When drafting an architecture decision record, the primary agent must
explicitly address these categories before claiming draft completeness:**

1. **Deployment contract**: where the application runs, what runtime it uses,
   and which hosting platforms are explicitly excluded with reasons.
2. **Persistence location and durability**: where data lives and which hosting
   environments make that choice invalid.
3. **Async pipeline stages**: any multi-step async workflow must name each
   stage and its artifact, not just the entry and exit tools.
4. **Source adapter contracts**: external source access must specify adapter
   boundaries, rate limits, User-Agent policy, caching, retry/backoff, and
   fallback rules.
5. **Security provider status**: distinguish "candidate" from "approved
   provider." An unapproved provider may never be named the initial provider
   in the decision table even if a key is available.
6. **Testing architecture**: every ADR must include a table of required test
   categories covering unit, integration, migration, mock, eval, and browser
   checks.
7. Self-review that declares an ADR "acceptance-ready" with only 3-5 fixes is
   likely to be optimistic when the ADR covers a multi-layer system.

Applies to: architecture decision records for any milestone that involves
persistence, external source access, async pipelines, or LLM providers.

Does not apply to: simple policy or documentation decisions with no runtime
components.

## Scope And Risks

- Applies to: multi-layer architecture ADRs involving persistence, external
  APIs, async pipelines, and LLM provider choices.
- Does not apply to: single-concern policy or documentation decisions.
- Known failure modes: the checklist may create false confidence if sections
  are filled with placeholder text rather than explicit decisions.
- Conflicting authority checked: `AGENTS.md` Completion Reporting requirements;
  `.agents/QUALITY.md`; `docs/milestones/M001-existing-thesis-loop.md`.

## Independent Review

- Reviewer: Two independent user-provided reviews (2026-07-03).
- Review date: 2026-07-03
- Evidence reproduced: `yes` — original draft and revised ADR both retained.
- Duplicate or conflict check: No prior promoted lesson covers ADR completeness
  checklists for this project.
- Privacy check: All examples are synthetic or reference public documents. No
  confidential investment data included.
- Disposition: `validated`
- Reason: Two independent reviewers identified overlapping sets of missing
  boundaries, and the revised ADR addressed all of them.

## Promotion Or Supersession

- Decision authority: user (required — proposed destination is playbook-guidance,
  which affects future behavior).
- Decision date: 2026-07-03
- Promotion target: `.agents/QUALITY.md` — "ADR completeness checklist" section
- Promotion registry entry: docs/learning/PROMOTIONS.md
- Supersedes: none
- Superseded by: none
- Rollback path: remove checklist section from `QUALITY.md`; mark this entry
  superseded.
