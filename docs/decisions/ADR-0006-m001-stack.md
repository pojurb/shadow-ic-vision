# ADR-0006: M001 Architecture Stack

Status: `proposed`

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

Alternative considered: raw `better-sqlite3` with manual SQL. Rejected because
it requires hand-managing migration ordering and version tracking.

---

## 4. LLM Integration — Brain

**Decision: Vercel AI SDK behind a project-owned provider interface.**

### Provider interface
- All LLM calls go through a project-owned `LLMProvider` interface defined
  in `lib/ai/provider.ts`. Application code never imports the Vercel AI SDK
  directly.
- The interface exposes: `chat()`, `structuredExtract()`, and
  `streamCompletion()`. Swapping providers changes only the adapter
  implementation, not callsites.
- A new provider may be connected only after it passes the full M001 eval
  suite. Provider switching is not behaviorally effortless; each model must be
  independently verified against the 16-case Golden Dataset before use.

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

## 6. Citation Pipeline Architecture

The citation pipeline is a strict ordered sequence. Each stage produces an
artifact that the next stage consumes. No stage may be skipped.

```
SEC/IDX Adapter
    → Source Snapshot (raw bytes, URL, retrieval timestamp, HTTP status)
        → Canonical Extracted Text (parser strips HTML; version-tagged)
            → Snapshot Hash (SHA-256 of canonical text)
                → Exact Verifier (character-exact substring match)
                    → Evidence Record (stored only on pass)
```

- The snapshot hash, retrieval timestamp, URL, and parser version are stored
  alongside every Evidence record.
- Any quote that is not a character-exact substring of the canonical extracted
  text is blocked, logged, and surfaced to the user as an unverified claim.
- HTML whitespace normalization must be applied before hashing and before
  exact matching. The normalization rules are part of the versioned parser
  configuration.

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

---

## Affected Files (on implementation)

```
next.config.js                         — serverExternalPackages for better-sqlite3
.env.example                           — DB_PATH, LLM_PROVIDER, API keys (sanitized)
db/schema.ts                           — Drizzle schema (Thesis, Assumption, Evidence, Decision)
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
logs/outbound.log                      — Outbound request log (not committed)
app/                                   — Next.js App Router pages and Route Handlers
```
