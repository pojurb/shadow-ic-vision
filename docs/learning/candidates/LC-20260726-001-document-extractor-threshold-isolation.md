# LC-20260726-001 - Document Extractor Threshold Isolation Across Web Sources

Status: `promoted`

Captured: `2026-07-26`

Milestone: `M008`

Task type: `debugging`

Classification: `quality`

Privacy class: `public`

Proposed destination: `playbook-guidance`

## Confirmed Observation Or Failure

During the first live end-to-end run of M008 (web search discovery via Tavily on a real TLKM thesis), 15 `secondary_issuer` evidence rows were persisted. While the structural classification gate (`R-010`) held correctly (no rows mislabeled `exact_verified`), several quotes were site-wide web boilerplate (e.g. cookie policy, CSR press release, nav-menu links reused verbatim across multiple assumptions).

Root cause: `rankSentenceCandidates` (`lib/research/extractors/candidate.ts`) used a low token-overlap matching bar (`tokenMatches >= 2 && score >= 8`) originally tuned for dense, boilerplate-free official SEC/IDX filings (M001–M006). Reusing this threshold unchanged when M007/M008 opened raw web HTML into the same path allowed repeated web boilerplate to clear the filter. Furthermore, `extractHtml` (`lib/research/extractors/document.ts`) stripped `script/style/noscript/template/svg` but left `nav/header/footer/aside` in `canonicalText`.

## Evidence

- Commit, run, or evidence ID:
  - M008 live test run & `R-025` entry in `docs/RISK_REGISTER.md` (2026-07-26)
  - Milestone packet [`M009-secondary-evidence-boilerplate-filtering.md`](../../milestones/M009-secondary-evidence-boilerplate-filtering.md)
- Commands or checks:
  - Inspection of persisted evidence rows for conversation `f5f230f6-23ea-4e86-a73a-cb55b04630c3`
  - Code inspection of `lib/research/extractors/candidate.ts` and `document.ts`
- Exact result:
  - Generic company name + year + any digit in nav/footer text cleared `tokenMatches >= 2 && score >= 8` bar.
- Related review finding or incident:
  - R-025 risk identification during M008 live run (2026-07-26)

## Proposed Reusable Lesson

When expanding document extraction from formal, dense report documents (SEC/IDX filings) to raw web HTML (press releases, news articles, search results), isolate extraction thresholds and HTML DOM cleaning:
1. **Strip DOM structural boilerplate** (`nav`, `header`, `footer`, `aside`, cookie/legal banners) at HTML ingestion time before sentence splitting.
2. **Isolate thresholds across source tiers**: Do not rely solely on low token-matching thresholds tuned for clean financial filings when processing raw web HTML; apply phrase-level denylists and DOM pre-cleaning to prevent site-wide boilerplate promotion.

## Scope And Risks

- Applies to:
  - Document extraction pipelines ingesting web HTML sources alongside formal PDF/SEC filings.
- Does not apply to:
  - Structured XBRL or official SEC text-layer PDF extractions.
- Known failure modes:
  - Raising thresholds globally across all source classes risks dropping concise valid metrics from official filings.
- Conflicting authority checked:
  - `AGENTS.md`
  - `.agents/QUALITY.md`
  - `docs/RISK_REGISTER.md`

## Independent Review

- Reviewer: Antigravity (Gemini 3.6 Flash)
- Review date: 2026-07-26
- Evidence reproduced: `yes`
- Duplicate or conflict check: `clean`
- Privacy check: `clean`
- Disposition: `validated`
- Reason: Confirmed live evidence in conversation `f5f230f6-23ea-4e86-a73a-cb55b04630c3` and code path in `candidate.ts`/`document.ts`.

## Promotion Or Supersession

- Decision authority: user
- Decision date: 2026-07-26
- Promotion target: [.agents/QUALITY.md](../../.agents/QUALITY.md)
- Promotion registry entry: LC-20260726-001
- Supersedes: none
- Superseded by: none
- Rollback path: Remove section from `.agents/QUALITY.md` and mark entry superseded.
