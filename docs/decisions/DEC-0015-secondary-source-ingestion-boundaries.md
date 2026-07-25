# DEC-0015 - Product Boundaries And Trust Contract For Secondary-Source Ingestion

Status: `accepted`

Date proposed: 2026-07-25

Date accepted: 2026-07-25

Approving authority: user

Supersedes: none

Amends: [`DEC-0003`](DEC-0003-product-strategy.md) (expands allowable evidence sources beyond official SEC/IDX filings), [`DEC-0008`](DEC-0008-m001-multimodal-amendment.md) (extends the multimodal evidence schema with secondary trust classes)

## Context

[`ROADMAP.md`](../milestones/ROADMAP.md) sequences Milestone 7 (M007) as "Secondary-Source/General-News Ingestion" and explicitly notes:

> "Needs a preceding product-scoping decision on which secondary sources are admissible and what trust/licensing rules apply before implementation scoping can start — no existing ADR or evaluator scaffolding covers this area."

Two open risks in [`docs/RISK_REGISTER.md`](../RISK_REGISTER.md) motivate this boundary:

- **R-010** (*Secondary or user-provided evidence is mistaken for official fact*, Data Trust, High likelihood, Critical impact, `Open`): Users or models may treat news reports, press releases, or secondary analysis as authoritative facts on par with audited SEC filings or official IDX disclosures.
- **R-013** (*Web search results are treated as evidence rather than discovery pointers*, Data Trust, Medium likelihood, High impact, `Open`): Search engine text snippets or LLM web-search summaries may be cited directly as factual evidence without fetching and verifying the underlying source document.

The existing product architecture enforces a strict evidence hierarchy ([`DEC-0008`](DEC-0008-m001-multimodal-amendment.md), [`lib/research/extractors/candidate.ts`](../../lib/research/extractors/candidate.ts)):
- `exact_verified`: HTML or text-layer PDF text matching canonical source text from official SEC/IDX filings.
- `ocr_matched`: Retained OCR or visual document text from official documents, structurally blocked from `exact_verified` promotion.
- `derived`: Calculations, table normalizations, and chart interpretations with retained provenance.

M007 introduces non-official external sources (company IR press releases, financial news wires, and web search discovery). Without a clear product-scoping decision, integrating secondary sources risks degrading user trust, confusing evidence provenance, and violating [`DEC-0003`](DEC-0003-product-strategy.md)'s core promise of evidence-grounded research.

This record establishes the product boundaries, licensing rules, structural schema extensions, and search handling rules required before M007 implementation scoping can begin.

## Decision Requested

Approve the product strategy, source admissibility hierarchy, structural trust classification, and discovery-pointer rules for secondary-source ingestion in V1.

## Approved Scope If Accepted

### 1. Admissible Source Hierarchy & Licensing Rules

Not all external web sources are equal. Ingestion is restricted to four distinct source classes with explicit licensing and trust caps:

| Source Class | Description / Examples | Licensing & Fetch Rules | Max Allowed Trust Class |
|---|---|---|---|
| **Class A: Official Issuer IR Releases** | Direct company press releases and investor relations announcements fetched from allowlisted URLs ([`ISSUER_SOURCE_URLS`](../../.env.example)). | Public web access; must respect `robots.txt` and include explicit `SEC_USER_AGENT` / app identification header. | `secondary_issuer` |
| **Class B: Curated Financial News Wires** | Reputable financial news RSS/JSON feeds from allowlisted publishers (e.g. Antara News for ID, PR Newswire / BusinessWire public RSS for US). | Public RSS/syndication endpoints; no paywalled, login-gated, or scraped full-text news sites without explicit API license. | `secondary_news` |
| **Class C: Web Search Discovery** | Search engine API query results (e.g. Google / Bing Search API). | API terms of service compliance; search snippets used ONLY for URL discovery. | `discovery_pointer` (Never Evidence) |
| **Class D: Untrusted Open Web** | Unverified blogs, social media, message boards, automated aggregators, or open web crawling. | Blocked from automated ingestion. | `rejected` |

### 2. Structural Prevention of R-010 (Secondary Evidence Misclassification)

To prevent secondary evidence from ever being mistaken for official fact, the distinction is enforced **structurally by schema and type**, not merely by UI convention:

1. **Schema Extension**: [`lib/domain/contracts.ts`](../../lib/domain/contracts.ts) and [`db/schema.ts`](../../db/schema.ts) will add two new distinct enum values to `verification_status`:
   - `secondary_issuer`: Information extracted from official company press releases or IR updates.
   - `secondary_news`: Information extracted from allowlisted financial news wires.
2. **Structural Promotion Barrier**: In [`lib/research/extractors/candidate.ts`](../../lib/research/extractors/candidate.ts), `secondary_issuer` and `secondary_news` items are hard-gated by `ExtractedDocument.sourceVariant`. They are structurally forbidden from being promoted to `exact_verified` or `ocr_matched`.
3. **Pending Confirmation Gate**: Thesis assumptions supported *exclusively* by secondary evidence (`secondary_issuer` or `secondary_news`) remain in `pending_confirmation` status. They cannot mark an assumption `verified` until either:
   - An official filing (`exact_verified` or `ocr_matched` from SEC/IDX) confirms the claim, or
   - The user explicitly accepts the secondary evidence via an in-app confirmation action.
4. **Distinct UI Visual Badging**: Secondary evidence rendered in the Research Drawer, Top-10 Queue, or Portfolio Briefing must display prominent **Amber/Yellow Warning Badges** ("Secondary: Issuer PR" or "Secondary: News Wire"), visually distinct from Green (`exact_verified`), Blue (`ocr_matched`), and Purple (`derived`).

### 3. Structural Prevention of R-013 (Search Snippets as Evidence)

To prevent web search engine snippets or LLM search summaries from being cited as evidence:

1. **Discovery-Pointer Isolation**: Web search results produce candidate URLs stored as `discovery_pointer` records in a proposed `discovery_candidates` persistence table (to be added to [`db/schema.ts`](../../db/schema.ts) during M007 implementation). Search text snippets are **never** written to `SourceSnapshot` or `Evidence` tables.
2. **Mandatory Fetch-and-Classify Loop**: A search result can only generate evidence by triggering a direct, full-document HTTP fetch of the target URL. The fetched document must:
   - Pass content-addressing (SHA-256 `document_hash`),
   - Match an allowlisted domain in `Class A` or `Class B`, and
   - Undergo deterministic extraction and safety scanning ([`lib/research/extractors/document.ts`](../../lib/research/extractors/document.ts)).
3. **Snippet Discard**: If a target URL cannot be fetched, fails safety scanning, or belongs to an un-allowlisted domain (`Class D`), the discovery pointer is marked `unreachable` or `rejected`. The search snippet is discarded and never surfaced as a cited claim.

### 4. Preservation of the V1 Market Wedge (DEC-0003 Alignment)

Secondary-source ingestion remains strictly bounded by [`DEC-0003`](DEC-0003-product-strategy.md):
- Ingestion is limited to news and press releases directly related to the tracked **US (SEC) and Indonesian (IDX) public equities universe** (up to 100 companies).
- Search queries and news feed filters must be scoped explicitly by tracked company ticker symbols and official legal names.
- Does **not** expand scope to macro economy news, foreign non-US/ID exchanges, cryptocurrencies, private equity, or un-tracked equities.

### 5. Explicitly Out of Scope for V1 (R-005 Protection)

To avoid creating an oversized V1 milestone (protecting against R-005):

1. **No Open Web Crawling**: No recursive crawling or arbitrary spidering of un-allowlisted web domains.
2. **No Paywalled or Gated Content**: No automated scraping of subscription-gated news outlets (e.g. WSJ, FT, Bloomberg Terminal).
3. **No Automated Trade Triggers**: Secondary news items can generate portfolio alerts (`PortfolioAlert`), but can **never** originate automated Buy/Hold/Reduce/Exit actions or alter recorded thesis decisions (preserving [`DEC-0011`](DEC-0011-decision-record-classification-amendment.md) and R-011).
4. **No Real-Time Streaming Sockets**: News refresh uses the existing periodic scheduled ingestion lease infrastructure ([`lib/research/ingestion.ts`](../../lib/research/ingestion.ts)), not push-based WebSocket feeds.
5. **No Sentiment Scoring**: Ingested secondary text is evaluated strictly for factual claims and thesis assumption alignment, not generic sentiment analysis (bullish/bearish scores).

## Risk Register Effects

- **R-010** (*Secondary evidence mistaken for official fact*): Moves from `Open` toward `Mitigated` upon M007 implementation under this record's structural enum isolation (`secondary_issuer` / `secondary_news`), mandatory confirmation gate, and amber UI badging contract.
- **R-013** (*Search snippets treated as evidence*): Moves from `Open` toward `Mitigated` upon M007 implementation under the strict `discovery_pointer` mandatory fetch-and-classify rule.
- **R-005** (*Oversized V1 milestone*): Protected by keeping web scraping, paywalls, sentiment scoring, and real-time streaming explicitly out of scope.

## Eval And Verification Path

When M007 implementation scoping begins, verification must require:

1. **Deterministic Unit & Integration Tests**:
   - Verify `secondary_issuer` and `secondary_news` DTOs cannot be saved as `exact_verified`.
   - Verify web search API results only create `discovery_pointer` records and never directly mint `Evidence`.
   - Verify search snippet text is excluded from database persistence.
2. **Evaluator Cases**:
   - Add secondary-source test cases to `docs/evals/M001/` checking that secondary news claims are correctly surfaced with amber badges and `pending_confirmation` status.
3. **Safety & Injection Scanning**:
   - Secondary HTML/text documents must pass [`scanEmbeddedInstructions`](../../lib/research/extractors/safety.ts) before candidate extraction.

## Revocation And Incident Response

- If any pipeline change allows a secondary news source or search snippet to mint an `exact_verified` badge or alter an assumption without official filing confirmation, that is a critical data-integrity breach. Handle immediately under severity-1 bug protocols.
- This decision may be amended or expanded by a subsequent decision record if specific licensed financial news APIs are added to `Class B`.

## Acceptance Criteria

- This record is accepted by the user or remains explicitly `proposed`.
- `docs/decisions/INDEX.md` lists this record with matching status.
- `docs/milestones/ROADMAP.md` refers to this decision as the proposed product-scoping boundary for M007.
- No application code or M007 milestone packet is written until this record is accepted.
