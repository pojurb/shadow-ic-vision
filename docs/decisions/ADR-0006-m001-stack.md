# ADR-0006: M001 Architecture Stack

Status: `accepted`

Date: 2026-07-03

Approving Authority: user

## Context

Milestone 1 (M001: Existing Thesis Loop) requires a conversational UI, a
structured local database for preserving theses and evidence, automated
background research, character-exact citation verification, and strict outbound
logging. The system is designed for a single self-directed investor on a local
machine. This ADR defines the architecture boundaries necessary before any
product code is written.

This document incorporates two independent reviews of the original draft. Their
combined findings are treated as required changes, not suggestions.

Full multimodal research is governed by
`DEC-0008-m001-multimodal-amendment.md` (accepted 2026-07-03). The capability,
evidence, and verification sections below are active and required.

---

## 1. Deployment Contract (local-only)

- The Next.js application runs exclusively on the Node.js runtime bound to
  `127.0.0.1` during M001.
- SQLite is not durable on Vercel's ephemeral filesystem and must not be the
  database for any Vercel-hosted deployment.
- Vercel is authorized only for the public documentation page and non-private
  demo content (`index.html`). No user thesis, assumption, evidence, or
  decision data may be present there.
- If remote access (LAN or cloud) becomes necessary in a future milestone, a
  new ADR must be created covering managed persistence and authentication before
  any such deployment.

---

## 2. Frontend and Backend Framework

**Decision: Next.js (App Router) using the Node.js runtime.**

- React Server Components and Route Handlers handle the conversational UI and
  all API endpoints.
- The Node runtime is required so that `better-sqlite3` runs without
  sandboxing. This must be declared via `serverExternalPackages` in
  `next.config.js`.
- All Route Handlers are internal endpoints. They are safe only while bound to
  loopback. Any LAN or cloud exposure requires authentication and authorization
  before release.

Alternative considered: Vanilla HTML/JS + Express. Rejected because Next.js
unifies routing and enables the Vercel AI SDK streaming pattern with less
boilerplate.

---

## 3. Database and Persistence

**Decision: SQLite via `better-sqlite3` with Drizzle ORM.**

### SQLite contract
- Database file lives outside the repository (e.g., `~/jp-invest-data/db.sqlite`
  or a path configured via environment variable). It must not be committed.
- `PRAGMA foreign_keys = ON` must be enabled on every connection.
- All cascade deletes (`Thesis → Assumptions → Evidence → Decisions`) use
  `ON DELETE CASCADE` with transactional boundaries.
- Backup must be taken before every migration run; migration scripts must be
  transactional.
- Export produces a valid JSON document covering all tables for the user's
  data. Import and deletion must be tested for round-trip integrity.

### Drizzle ORM and migrations
- `drizzle-orm` is the ORM layer (TypeScript-first, lightweight, SQLite-native).
- Migrations are generated using `drizzle-kit generate` and committed as SQL
  files under `db/migrations/`.
- Schema push (`drizzle-kit push`) is prohibited in any environment beyond
  local development iteration. Only committed migration files run in production.
- Every migration is applied transactionally. A pre-migration backup is created
  before each run.

### Multimodal Evidence extension

If DEC-0008 is accepted, Evidence records also store:

- `source_format`: `html`, `pdf`, `image`, or `xbrl`;
- `content_kind`: `text`, `table`, `chart`, `screenshot`, or
  `structured_fact`;
- optional `source_variant`: `text_layer`, `scanned`, `encrypted`, `corrupt`,
  or `unsupported`;
- `extraction_method`: `html_parser`, `pdf_text`, `ocr`, `vision`,
  `table_parser`, `xbrl_parser`, or `deterministic_calculation`;
- `verification_status`: `exact_verified`, `ocr_matched`, or `derived`;
- immutable `document_hash` of raw source bytes, optional
  `canonical_text_hash` for exact-text verification, retrieval timestamp, and
  source URL;
- one-based `page_number` for paginated sources;
- optional `[x_min, y_min, x_max, y_max]` `bounding_box` coordinates normalized
  to `0..1` from the page's top-left origin;
- parser and OCR versions; and
- provider, model, prompt, and settings metadata when model output contributed.

Unverified candidates are not stored as durable Evidence. They remain
diagnostic research artifacts and may be retried or reviewed without being
presented as facts.

### Conversation persistence

M001's persistent multi-turn workflow requires `Conversation` and `Message`
records in addition to the accepted thesis ledger entities. Conversation
history is normalized and stored by the application; no provider-specific
thinking trace becomes conversation history. Assistant messages retain
provider, model, prompt version, settings, and validation outcome. Draft
conversations are user-deletable and included in export; once attached to a
thesis, deletion follows the thesis cascade.

Alternative considered: raw `better-sqlite3` with manual SQL. Rejected because
it requires hand-managing migration ordering and version tracking.

---

## 4. LLM Integration — Brain

**Decision: Vercel AI SDK behind a project-owned provider interface.**

### Provider interface
- All LLM calls go through a project-owned `LLMProvider` interface defined
  in `lib/ai/provider.ts`. Application code never imports the Vercel AI SDK
  directly.
- The interface exposes `chat()`, `structuredExtract()`, `streamCompletion()`,
  and model capability metadata. Every request identifies the exact provider,
  model, prompt version, and settings used. Swapping providers changes the
  adapter implementation, not domain callsites.
- A new provider may be connected only after it passes the full M001 eval
  suite. Provider switching is not behaviorally effortless; each model must be
  independently verified against the accepted 16-case baseline and, if
  DEC-0008 is accepted, every applicable multimodal case before use.

### Capability ownership

| Capability | Owner | M001 requirement |
|---|---|---|
| SEC/IDX search and crawling | Application source adapters | Required |
| Restricted general-web discovery | Application discovery adapter | Required fallback |
| HTML and text-PDF extraction | Deterministic parsers | Required |
| Scanned PDF and image OCR | OCR pipeline | Required if DEC-0008 is accepted |
| Screenshots, tables, and charts | Vision model plus application validation | Required if DEC-0008 is accepted |
| XBRL facts and material financial calculations | Deterministic tools | Required where available |
| Exact citation, freshness, date, and source-tier checks | Application | Required |
| Conversation history and model-run provenance | Application database | Required |
| Thesis reasoning, challenge, and evidence interpretation | Model | Required |
| Investment decision | User | Always |

The model may not independently crawl arbitrary sites, treat discovery snippets
as evidence, calculate material financial values without deterministic
verification, bypass source adapters, or promote its own interpretation to
verified evidence.

### Required selectable-model capabilities

Every selectable product model must demonstrate:

- English and Bahasa Indonesia understanding;
- persistent multi-turn coherence and thesis/assumption decomposition;
- focused clarification and intellectual challenge;
- structured JSON generation that passes external schema validation;
- vision input for scans, screenshots, tables, and charts when multimodal M001
  is active;
- evidence-grounded summaries that preserve quoted text;
- contradictory-source detection and official-source priority;
- explicit uncertainty, missing-data, and stale-source reporting;
- prompt-injection resistance across user and document content;
- refusal of buy, hold, sell, execution, or autonomous-portfolio advice;
- at least 128K context with application-side document chunking;
- streaming responses; and
- reproducible provider/model/settings metadata.

Tool calling and context above 128K are preferred, not required. The
application orchestrates research. Native provider browsing, native PDF
parsing, and model-generated financial arithmetic are not trusted substitutes
for project-owned tools.

Native structured-output support is not assumed. `structuredExtract()` must
validate against a project-owned schema, use bounded repair attempts, and fail
closed when validation does not succeed.

### Ollama Cloud — provider candidate, not approved provider
- Ollama Cloud is a **candidate** for the initial provider. It is not yet
  approved.
- A separate security decision must be recorded before any data is sent to
  Ollama Cloud. That decision must cover: handling policy, data region,
  subprocessors, retention, deletion terms, and incident response.
- Ollama states that cloud prompts are processed transiently and not used for
  training. This does not replace the repository's provider-approval gate.

### Data classification boundary (enforced now, before provider approval)
- **Allowed on any unapproved cloud provider**: public filings, ticker symbols,
  public transcripts, and synthetic eval fixtures.
- **Blocked from Ollama Cloud until the security decision is accepted**:
  thesis text, assumptions, decisions, user-provided evidence, and any
  portfolio or personal investment information.
- A local Ollama instance (running on the same machine) may be used for
  confidential-class data without a cloud provider approval.

Alternative considered: Raw `fetch` calls to providers. Rejected because it
requires reimplementing streaming, retries, and structured output handling per
provider.

---

## 5. Background Research and Job Persistence

- Research jobs triggered by assumption intake must be persisted in SQLite with
  the following states: `queued`, `running`, `succeeded`, `degraded`, `failed`.
- A local worker (Next.js Route Handler or a Node.js background process) polls
  for `queued` and `running` jobs on startup and resumes interrupted jobs after
  a server restart.
- The UI reflects job state and communicates degraded or failed sources to the
  user rather than silently omitting evidence.

---

## 6. Citation And Multimodal Pipeline Architecture

The text citation branch is a strict ordered sequence. Each stage produces an
artifact that the next stage consumes. No stage may be skipped.

```
SEC/IDX Adapter
    → Source Snapshot (raw bytes, URL, retrieval timestamp, HTTP status)
        → Canonical Extracted Text (parser strips HTML; version-tagged)
            → Canonical Text Hash (SHA-256 of canonical text)
                → Exact Verifier (character-exact substring match)
                    → Evidence Record (stored only on pass)
```

- The raw document hash, canonical text hash, retrieval timestamp, URL, and
  parser version are stored alongside every exact-text Evidence record.
- Any candidate for `exact_verified` that is not a character-exact substring of
  canonical HTML or text-PDF content is blocked, logged, and surfaced to the
  user as an unverified claim.
- HTML whitespace normalization must be applied before hashing and before
  exact matching. The normalization rules are part of the versioned parser
  configuration.

### Multimodal extension

If DEC-0008 is accepted, every source follows this pipeline before evidence can
be presented:

```text
Source Adapter
  -> Immutable Source Snapshot (bytes, URL, timestamp, media type)
  -> SHA-256 Document Hash
  -> Media Classifier
       -> HTML parser
       -> text-PDF parser
       -> OCR for scanned PDF/image
       -> vision extraction for visual layout/table/chart
       -> XBRL parser for structured facts
  -> Canonical Extraction Artifact (page, section, optional bounding box)
  -> Verification or Deterministic Calculation
  -> Evidence Classification
       -> exact_verified
       -> ocr_matched
       -> derived
  -> Evidence Record or blocked diagnostic artifact
```

- HTML and text-layer PDFs alone may produce `exact_verified` quotations.
- OCR strings may produce only `ocr_matched`; matching OCR does not prove that
  the original scan contains no recognition error.
- Tables, charts, normalized XBRL facts, and material calculations are
  `derived`. Their inputs, units, formula or method, page, bounding box when
  applicable, and source provenance are retained.
- Corrupt, encrypted, unreadable, oversized, or unsupported content moves the
  job to `degraded` with a visible reason and recovery path.
- Large documents are chunked by the application. Each chunk retains document
  hash, page range, section identifier, and extraction version.
- Vision output is untrusted candidate data and cannot bypass deterministic or
  human validation.

---

## 7. Source Adapters

Separate adapters are required for each source tier. `fetch` and `cheerio` are
implementation utilities, not the adapter contracts.

### SEC Adapter (US equities)
- Primary: SEC EDGAR full-text search API and filing APIs (no HTML scraping
  where structured data is available).
- User-Agent must identify the application and a contact address as required
  by SEC fair-access policy.
- Rate limit: ≤ 10 requests per second. Implement token-bucket or leaky-bucket
  rate limiting, caching of recently fetched documents, and exponential
  backoff with jitter on 429/503 responses.
- Fallback: HTML page fetch + `cheerio` parse, only when the structured API
  returns no result for a known filing.

### IDX Adapter (Indonesian equities)
- Primary: IDX official disclosure pages and announcements.
- Same rate-limiting, caching, and backoff requirements as the SEC adapter.

### Secondary Adapter
- Activated only when official adapters return no result.
- Result is classified `secondary` and presented with a visible provenance
  label. It may not appear as a verified official source.

### Restricted discovery adapter

- General web search is used only to discover candidate source pages when
  official adapters return no suitable document.
- Search snippets are never evidence. The target page or document must be
  fetched, classified, snapshotted, and processed through the normal pipeline.
- Source-domain restrictions, outbound logging, rate limits, cache behavior,
  and failure states are explicit configuration, not model choices.

### Document processing adapters

- The HTML parser produces canonical normalized text with a parser version.
- The PDF parser distinguishes text-layer, scanned, encrypted, corrupt,
  oversized, and unsupported documents before extraction.
- OCR retains the exact OCR output and engine/version metadata.
- Vision handles screenshots, table/chart layout, and bounding boxes but does
  not determine verification status.
- The XBRL parser and calculation helpers are deterministic and retain concepts,
  periods, units, input values, and formulas.
- Media parsing and rendering treat source bytes and embedded instructions as
  untrusted input.

---

## 8. Security Boundary

- No authentication is required while the application is bound to `127.0.0.1`.
- Any exposure beyond loopback (LAN IP, cloud URL, or tunnelling service)
  requires authentication and authorization to be implemented and reviewed
  before that deployment is used with real data.
- All outbound requests to LLM providers and external web sources are logged
  to a structured local log file (`logs/outbound.log`) and optionally streamed
  to the system console, satisfying the M001 transparency requirement.
- Secrets (API keys, database paths) are injected via environment variables.
  A sanitized `.env.example` is committed; `.env` is in `.gitignore`.
- Text extracted from web pages, PDFs, images, tables, and charts is untrusted
  content. It is isolated from system instructions and cannot directly invoke
  tools, change providers, read secrets, or alter product policy.

---

## 9. Styling

**Decision: CSS Modules within Next.js.**

Each component owns a `.module.css` file. No utility-class framework. Visual
design decisions (color palette, motion, layout) are product-design concerns
and are not specified here.

---

## 10. Verification Architecture

The following test categories are required before M001 is considered
implementation-verified.

| Category | Method |
|---|---|
| Citation verifier | Pure unit tests: exact match, single-char alteration, whitespace normalization, extension — all must block |
| Database integration | Temporary SQLite file per test; cascade-delete, transaction rollback, foreign-key enforcement |
| Migration round trips | Apply all migrations on an empty database; verify schema matches ORM definition |
| Export/import round trips | Export → wipe → import → verify row counts and foreign keys |
| Provider mock | All LLM calls use a deterministic mock; no real provider in CI |
| M001 eval suite | Run all 16 cases from `docs/evals/M001/cases.json` against the provider interface |
| Multimodal eval addendum | If DEC-0008 is accepted, run every case in `docs/evals/M001/multimodal-cases.json` in addition to the original 16 |
| Fixture rendering | Deterministically render synthetic PDF/image specifications and retain SHA-256 hashes of generated artifacts |
| Evidence-class unit tests | Prevent `ocr_matched` or `derived` content from becoming `exact_verified` |
| PDF/OCR integration | Text, scanned, encrypted, corrupt, oversized, and unsupported document states |
| Visual provenance | Tables, charts, and screenshots retain page, bounding box, extraction method, inputs, and units |
| Multimodal injection | Embedded PDF/image instructions cannot alter policy, invoke tools, or produce trade advice |
| Model eligibility | A model missing required language, vision, context, streaming, safety, or eval results cannot appear as selectable |
| Browser checks | Loading, success, degraded-source, failed-source, deletion, and cascade-delete states verified in-browser |

---

## Options Considered (Summary)

| Concern | Options | Selected |
|---|---|---|
| Frontend/Backend | Vanilla JS + Express, Next.js App Router | Next.js App Router |
| Database | JSON files, SQLite | SQLite + better-sqlite3 |
| ORM/Migrations | Raw SQL, Drizzle ORM | Drizzle ORM + committed SQL migrations |
| LLM Abstraction | Raw fetch, Vercel AI SDK | Vercel AI SDK behind project interface |
| Initial Provider | Ollama Cloud, local Ollama, OpenAI | None approved yet (Ollama Cloud = candidate) |
| Document Coverage | HTML only, text PDF only, governed full multimodal | Full multimodal proposed in DEC-0008; not active until accepted |
| Deployment | Vercel-hosted, local Node server | Local Node (127.0.0.1) for M001 |
| Styling | Tailwind, Vanilla CSS, CSS Modules | CSS Modules |

---

## Consequences

- Next.js on the Node runtime enables streaming chat and `better-sqlite3`
  without sandboxing.
- SQLite is offline-first, zero-config, and trivially backed up.
- Drizzle ORM enforces type-safe queries and version-controlled migrations.
- The project-owned LLM interface prevents provider lock-in at callsites and
  enforces the eval gate before any provider switch.
- Research capabilities are separated from model capabilities: adapters fetch,
  parsers extract, deterministic tools calculate and verify, and models reason
  only over provenance-tagged artifacts.
- Full multimodal support increases implementation scope, dependencies,
  processing latency, model-evaluation cost, and recovery-state requirements.
- Exact text, OCR text, and derived visual or calculated evidence remain
  visibly distinct and cannot be promoted by model confidence.
- Ollama Cloud remains a candidate until a separate security decision is
  accepted; only public and synthetic data may be used until then.
- No auth is safe only while loopback-bound; any future remote access requires
  a new ADR.

---

## Reversal Path

If Next.js proves too heavy, decouple to Vanilla JS + Express. If SQLite
becomes a bottleneck, migrate the schema to PostgreSQL using the same Drizzle
ORM layer. If the Vercel AI SDK introduces unacceptable coupling, replace with
a narrower project-owned fetch abstraction. All reversals must retain migration
history and existing evidence records.

If full multimodal support makes M001 too large or unreliable, supersede
DEC-0008 with a text-PDF-only boundary or move OCR/vision to a follow-up
milestone. Preserve historical eval cases and results, retain evidence-class
semantics, and never relabel OCR or derived records as exact evidence.

---

## Affected Files (on implementation)

```
next.config.js                         — serverExternalPackages for better-sqlite3
.env.example                           — DB_PATH, LLM_PROVIDER, API keys (sanitized)
db/schema.ts                           — Drizzle schema (Conversation, Message, Thesis, Assumption, Evidence, Decision)
db/migrations/                         — Committed SQL migration files
db/client.ts                           — SQLite connection with PRAGMA foreign_keys=ON
lib/ai/provider.ts                     — Project-owned LLMProvider interface
lib/ai/adapters/ollama.ts              — Ollama adapter (inactive until security decision)
lib/ai/adapters/local-ollama.ts        — Local Ollama adapter
lib/research/jobs.ts                   — Research job state machine
lib/research/adapters/sec.ts           — SEC EDGAR adapter
lib/research/adapters/idx.ts           — IDX adapter
lib/research/adapters/secondary.ts     — Secondary source adapter
lib/research/citation.ts               — Citation pipeline (snapshot → hash → verifier)
lib/research/extractors/html.ts         - canonical HTML extraction
lib/research/extractors/pdf.ts          - PDF classification and text extraction
lib/research/extractors/ocr.ts          - OCR output and version retention
lib/research/extractors/vision.ts       - visual candidates and bounding boxes
lib/research/extractors/xbrl.ts         - facts with periods and units
lib/research/calculations.ts            - deterministic financial calculations
docs/evals/M001/multimodal-cases.json   - additive multimodal cases
docs/evals/M001/MULTIMODAL_EVAL_GUIDE.md - additive hard gates
logs/outbound.log                      — Outbound request log (not committed)
app/                                   — Next.js App Router pages and Route Handlers
```
