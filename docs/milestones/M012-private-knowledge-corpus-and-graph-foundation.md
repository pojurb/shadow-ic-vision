# M012: Private Knowledge Corpus & Graph Foundation

Status: `complete`

Date drafted: 2026-08-08

Date accepted: 2026-08-08

Date completed: 2026-08-08

Approval authority: user

Depends on: [`ADR-0006`](../decisions/ADR-0006-m001-stack.md) (local SQLite
runtime), [`DEC-0014`](../decisions/DEC-0014-local-only-scope-reaffirmation.md)
(local-only boundary), [`DEC-0019`](../decisions/DEC-0019-private-knowledge-corpus-boundary.md)
(knowledge-subsystem boundary), and completed M011 conventions for governed
source provenance and deterministic verification.

## Slice outcomes — 2026-08-08

- Governance and path boundary shipped with DEC-0019, root-anchored Git ignore
  rules, and no use of `private/knowledge/originals/`.
- Intake scanned the actual corpus: 54 unique files, 0 duplicates, 0 read
  failures. Relative paths and SHA-256 hashes are persisted in the ignored
  manifest and SQLite.
- Local extraction completed for 29 PDFs, marked 1 scanned/unreadable PDF as
  `needs_ocr`, and marked 24 DOCX/XLSX files as `unsupported` without guessing
  or fabricating text.
- Batch without a provider left 29 documents in `awaiting_provider`; no live
  provider was called. Graph output remains empty until a validated source card
  is explicitly supplied through the deterministic file-backed boundary.
- Full suite: 389 passed / 3 skipped. M012 and migration tests: 13 passed.
  Typecheck, lint, build, code-index, status, and `git diff --check` passed.

## 1. Outcome

The repository has a local, reproducible foundation for turning the private
educational corpus into inspectable, provenance-linked knowledge artifacts.
Users can scan `originals/`, see deterministic hashes and duplicate status,
extract supported files locally, leave unsupported/scanned files visibly
unprocessed, validate a future strict-JSON digest without a live provider, and
inspect candidate graph data without confusing it with current market evidence.
The product purpose of this foundation is to make that corpus usable as a
source-traceable analysis substrate for user-led analysis while keeping its
candidate knowledge separate from live Evidence and automated investment
conclusions.

## 2. Current source and artifact layout

The source archive already exists and is read-only:

```text
originals/
  MODULE 1/
  MODULE 2/
```

The generated local layout is:

```text
private/knowledge/
  manifest.jsonl
  extracted/
  batches/
  reports/
  graph/
```

The implementation must not create or use `private/knowledge/originals/`.
`.gitignore` uses root-anchored `/originals/` and `/private/knowledge/` rules.

## 3. Scope

### In scope

- recursive intake limited to `originals/`;
- relative-path preservation, MIME detection, file size, SHA-256 hashing, and
  exact duplicate detection without deleting files;
- local text/HTML/PDF extraction using existing extraction and safety seams;
- visible statuses for unsupported, unreadable, encrypted, corrupt, and scanned
  files;
- Zod-validated source-card contract and a deterministic file-backed provider;
- SQLite/Drizzle persistence for knowledge documents, processing runs, claims,
  graph nodes, and graph edges;
- resume/idempotency behavior by content hash;
- ignored batch, graph, extraction, and QA-report artifacts;
- deterministic unit and migration tests.

### Out of scope

- altering `Evidence`, `SourceSnapshot`, or the live research trust hierarchy;
- current market facts, thesis verdicts, Macro Regime Lens runtime, UI, or FX
  pair functionality;
- Neo4j, vector search, embeddings, unrestricted retrieval, or fine-tuning;
- moving, copying, modifying, renaming, deleting, or flattening source files;
- OCR/vision provider calls by default;
- a Gemini or other external adapter without a separate explicit provider
  configuration and approval path;
- automatic approval of claims, frameworks, graph nodes, or graph edges;
- investment action recommendations.

## 4. Workflows and states

### Intake

1. Verify the two root-anchored Git ignore rules.
2. Recursively enumerate files under `originals/` in sorted relative-path
   order, without reading source text into logs.
3. Detect MIME type, size, and SHA-256.
4. Persist one durable document row per unique content hash.
5. Emit one deterministic manifest line per source path. A repeated hash is
   marked `duplicate` and points to the canonical hash without creating a new
   durable document row.

### Extraction

Supported local text/HTML/PDF files are extracted into ignored JSON artifacts
with page/section locators and the existing instruction-scan flag. Unsupported,
encrypted, corrupt, unreadable, and scanned files retain a visible status and
error code; no fabricated text is written.

### Batch digest

The provider-neutral boundary accepts one document at a time and only persists
Zod-valid strict JSON source cards. A missing provider leaves extracted
documents in `awaiting_provider`. The normal CLI has no live provider route.

### Graph

Only validated source cards produce graph records. Every durable claim carries a
document hash, locator, classification, and quote hash. Every graph edge carries
one or more valid source claim IDs. Model-derived nodes and edges are
`candidate` until a future human-governed approval workflow exists.

## 5. Proposed data contract

The migration adds only these tables, matching existing snake_case SQLite and
Drizzle conventions:

- `knowledge_documents`: one row per unique source hash, relative path, MIME,
  size, status, duplicate pointer, extraction/batch paths, retry/error state,
  and provider metadata.
- `knowledge_processing_runs`: stage-level status, source hash, provider/model
  metadata, retry count, timing, and error state.
- `knowledge_claims`: source hash, claim text, classification, locator, quote
  hash, and candidate/approval status.
- `knowledge_graph_nodes`: node type, label, optional description, source hash,
  optional source claim ID, and candidate/approval status.
- `knowledge_graph_edges`: source/target node IDs, edge type, source hash,
  non-empty JSON list of source claim IDs, and candidate/approval status.

The graph tables never store full extracted source text. Long extraction stays
under ignored `private/knowledge/extracted/`.

## 6. Implementation slices

1. **Governance and paths** — DEC-0019, this packet, root-anchored ignores,
   private path helpers, and no-source-mutation guards.
2. **Intake and manifest** — deterministic scan, hash deduplication, durable
   document rows, and resumable status handling.
3. **Local extraction** — PDF/HTML/text adapters, safety scanning, locator-
   preserving ignored artifacts, and visible failure states.
4. **Digest contract** — Zod source-card schemas, strict validation, deterministic
   file-backed provider, awaiting-provider behavior, and batch artifacts.
5. **Graph and reports** — provenance-checked graph persistence, ignored graph
   export, QA report, and CLI commands.
6. **Verification and close-out** — deterministic tests, migration round-trip,
   typecheck/lint/test/build/status/context checks, and a truthful handoff.

## 7. CLI surface

Add scripts consistent with existing conventions:

```text
npm run knowledge:scan
npm run knowledge:extract
npm run knowledge:batch
npm run knowledge:graph
npm run knowledge:report
```

The commands print counts, statuses, hashes, and safe error codes only. They do
not print raw document text or provider payloads.

## 8. Acceptance criteria

1. `originals/` and `private/knowledge/` are ignored by Git with root-anchored
   rules.
2. Intake preserves relative paths and deterministic SHA-256 hashes.
3. Exact duplicate hashes are detected without deleting source files.
4. Re-running intake does not duplicate durable document rows.
5. Extraction failures are visible and safely recorded.
6. No configured provider leaves documents in `awaiting_provider` and makes no
   external call.
7. Malformed or uncited provider JSON is rejected.
8. A durable claim cannot exist without source hash, locator, classification,
   and quote hash.
9. A graph edge cannot exist without valid source claim provenance.
10. Knowledge claims never enter the live `Evidence` table.
11. Unit tests, build, and normal verification make no external provider calls.
12. Completed identical hashes are skipped on resume unless explicitly forced.
13. Migration application and rollback/reversal notes are documented and the
   existing live tables remain unchanged.

## 9. Verification plan

- focused knowledge tests with temporary directories and in-memory SQLite;
- migration round-trip test for all five knowledge tables and provenance
  constraints;
- Git ignore checks for both private roots;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- `npm run context:generate` followed by `npm run context:check`;
- `npm run status:check`;
- a dry local scan of the actual `originals/` corpus reporting counts only;
- no external provider or network call during any M012 verification.

## 10. Risks and deferrals

- PDF text extraction may classify scanned PDFs as `needs_ocr`; OCR remains an
  explicit future provider path.
- Office formats without an existing local parser remain `unsupported` rather
  than being guessed or silently converted.
- The source-card contract is a foundation, not a claim of current truth.
- Candidate graph output has no approval UI in M012.
- Any future external provider needs a new explicit configuration/consent
  review; M012 does not silently enable one.

## 11. Reversal

After a database backup, a follow-up migration can remove the M012 tables. Code
can stop invoking the CLI, and generated artifacts can be removed only by an
explicit user request. Source files under `originals/` are never deleted or
modified by reversal.
