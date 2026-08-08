# DEC-0019 - Private Knowledge Corpus Boundary

Status: `accepted`

Date proposed: 2026-08-08

Date accepted: 2026-08-08

Approving authority: user

Supersedes: none

Amends: none. This decision adds a local knowledge subsystem without changing
the live evidence hierarchy or any existing provider approval.

## Context

The user has a manually downloaded educational macro/FX corpus under the
repository-root `originals/` directory. It contains private source material
under the existing `MODULE 1/` and `MODULE 2/` hierarchy. The corpus is useful
for identifying frameworks, concepts, mechanisms, possible indicators, and
limitations, but it is not current market evidence.

The existing product has a separate ticker/date-bound research pipeline whose
`Evidence` and `SourceSnapshot` records carry the live evidence trust hierarchy.
Putting course claims into those tables would make educational material look
like verified current fact. The corpus therefore needs its own local,
source-traceable storage and processing boundary.

The product position is explicit: Private Knowledge is a source-traceable
analysis substrate for user-led analysis of the educational corpus. It helps
the user find, compare, connect, and interrogate frameworks, concepts,
mechanisms, indicators, claims, and limitations. It is not live Evidence,
current market fact, or an automatic investment-conclusion engine; a
`graph_ready` record remains candidate knowledge with provenance, not approved
truth.

## Decision

Approve M012 as a local-only Private Knowledge Corpus and Knowledge Graph
foundation. The canonical raw-source archive is `originals/`; generated
artifacts live only under the ignored `private/knowledge/` directory:

```text
originals/
  MODULE 1/
  MODULE 2/
private/knowledge/
  manifest.jsonl
  extracted/
  batches/
  reports/
  graph/
```

The implementation will use the repository's existing SQLite + Drizzle
architecture. It will content-address source files, preserve relative paths,
detect duplicates, extract locally where supported, validate batch digests with
Zod, and create provenance-linked candidate graph records.

## Non-negotiable boundaries

1. Raw documents and full extracted text remain local/private and Git-ignored.
2. Source files under `originals/` are read-only to the pipeline: no move,
   rename, copy, delete, flattening, or in-place modification.
3. Course material is educational framework, not current market evidence.
4. This subsystem remains separate from `Evidence` and `SourceSnapshot`.
5. No model output is evidence, and model-created graph nodes/edges begin as
   `candidate`, never approved truth.
6. The subsystem must not produce buy/sell, high-probability, execution-ready,
   or other trade-signal output.
7. Only human-curated, approved frameworks may later guide a Macro Regime Lens.
8. Any external provider route requires explicit provider selection, explicit
   credentials, explicit consent, and a local deterministic verification path.
9. No live external provider call occurs by default or during tests, build, or
   normal verification.

## Approved M012 scope

- deterministic intake and manifest generation;
- local extraction with page/section provenance and visible failure states;
- a provider-neutral strict-JSON digest boundary plus a deterministic
  file-backed test provider;
- the smallest SQLite/Drizzle model for documents, processing runs, claims,
  graph nodes, and graph edges;
- candidate graph export and local QA reports;
- resumable, hash-idempotent CLI commands and deterministic tests.

This decision does not approve a Gemini adapter, a hosted deployment, a vector
database, embeddings, Neo4j, unrestricted raw-document retrieval, a Macro
Regime Lens runtime, UI work, or any alteration to the live research pipeline.

## Revocation and reversal

Reversal is local and bounded: stop invoking the knowledge CLI, remove the M012
tables through a follow-up migration after backup, and delete only generated
artifacts under `private/knowledge/` if the user explicitly requests it. Raw
source files under `originals/` are never part of reversal.

## Acceptance of this decision

The user's 2026-08-08 authorization of the M012 implementation is the approval
for this bounded scope. No commit or push is authorized by this decision.
