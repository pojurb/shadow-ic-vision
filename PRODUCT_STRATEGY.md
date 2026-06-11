# Product Strategy - AI Investment Committee

## Final Product Definition

This product is an AI Investment Committee for serious self-directed investors.

It is not another AI research chatbot. It is a decision-quality system that remembers the user's investment theses, monitors whether assumptions remain valid, challenges assumptions, surfaces risk, and helps decide what deserves attention or capital.

The winning product is:

> Watchlist IC Dashboard + Thesis Memory + Evidence Locker + Assumption Monitoring + Decision Ledger.

The current single-asset analysis cockpit should become the thesis detail page inside this broader system.

## Source Documents Synthesized

This strategy consolidates the following documents:

- `docs/archive/ai_investment_assistant_prd.md`
- `docs/archive/ANALYST_PRD_v1.0.docx`
- `docs/archive/investment_brain_plans.md`
- `docs/archive/investment_brain_v1_prd.md`
- `docs/archive/prd.md`
- `docs/archive/PRODUCT_STRATEGY_FEEDBACK.md`

Older PRDs remain historical references. This file is the current product-strategy source of truth.

## Target User

Primary ICP: serious self-directed investors.

They typically:

- Manage their own portfolio.
- Track a watchlist of 20-100 companies.
- Read annual reports, earnings releases, market commentary, and investment content.
- Already use AI tools such as ChatGPT, Claude, Gemini, or Perplexity.
- Make several meaningful investment decisions per year.

Their pain is not lack of information. Their pain is lack of decision structure, memory, monitoring, and risk discipline.

## Locked Strategic Decisions

- Beachhead workflow: Watchlist IC Dashboard.
- Core promise: decision clarity.
- Core IC primitives are asset-class agnostic: Thesis, Assumption, Evidence, Decision, and Review.
- Data trust policy: cited facts only before locking valuation figures.
- Monitoring policy: monitor assumptions and thesis breakers, not generic stock/news noise.
- Initial target: serious self-directed investors, not institutions.
- MVP data source policy: reliable-first hybrid; use cheap dependable APIs where possible and official sources for lockable fundamentals.
- V1 private and alternative assets are manual-only IC entries with no automated data feeds.
- Current analysis workspace evolves into a thesis detail page.
- Build on the current Next.js app before starting a new Python/PostgreSQL system.

## What The Product Is Not

- Not a generic stock analyzer.
- Not a PDF Q&A app.
- Not a trading bot.
- Not a research-volume machine.
- Not a traditional chunk-based RAG product.
- Not a chatbot with finance prompts.
- Not a universal automated data-ingestion engine in V1.

## Product Pillars

### Asset-Agnostic IC Core

The core investment committee objects should not care what the asset is.

A Thesis, Assumption, Evidence item, Decision, Review, and Thesis Breaker should work for public equities, private businesses, startups, real estate, crypto, and other assets. Asset-specific data connectors can be added sequentially, but the decision discipline should be universal from V1.

### Thesis Memory

The product remembers what the user believed, what evidence supported the thesis, what would break it, and when it was last reviewed.

### Evidence Locker

The product stores filings, articles, notes, transcripts, market data, and user insights as evidence. Evidence should be linked to theses as supporting, contradictory, neutral, or unresolved.

### Investment Committee Logic

The product behaves like a committee with distinct roles. These roles can exist inside the engine, but the MVP UI should compress them into a clear IC output rather than presenting five noisy personas by default:

- Analyst: facts, valuation, and model.
- Portfolio Manager: fit, sizing, opportunity cost, and capital allocation.
- Risk Officer: downside, exposure, and assumptions.
- Devil's Advocate: why the user may be wrong.
- IC Chair: decision quality and next action.

### Assumption Monitoring

The product does not monitor the stock in a generic way. It monitors the user's explicit assumptions and thesis breakers.

News is not evidence by itself. Price movement is not evidence by itself. A new item deserves attention only when it intersects with a key assumption, thesis breaker, valuation condition, or portfolio risk.

Examples:

- If the thesis assumes NIM stays above 5.5%, flag information that suggests NIM compression.
- If the thesis depends on deposit-cost stability, flag evidence about deposit beta, funding mix, or rate pressure.
- If the thesis assumes a valuation multiple remains reasonable, flag material valuation drift even when fundamentals are intact.
- If several assets depend on the same macro condition, flag the shared exposure at portfolio level.

### Valuation Drift

The product tracks when valuation changes the investment case even if the company executes well.

A thesis can remain fundamentally correct while the investment becomes unattractive because the entry multiple, implied growth, margin of safety, or expected return has changed. Valuation drift should be monitored beside fundamental thesis drift.

### Conviction Management

The product should not invent a black-box AI confidence score. Conviction should be managed through evidence quality, thesis freshness, uncertainty, assumption risk, and decision history.

### Decision Ledger

The product preserves what the user decided, why they decided it, and what happened afterward.

Before an Add / Increase Position decision, the product should require a short pre-mortem:

> Imagine it is 12 months from now and this position is down materially. Based on the thesis, what is the most likely reason why?

This makes the Decision Ledger useful for judging whether the user was right for the right reason, wrong for the right reason, or merely lucky.

## Synthesized Product Model

The combined idea from all PRDs should be implemented as five layers:

1. Evidence
   - Filings, articles, notes, transcripts, market data, and user insights.

2. Memory
   - Entities, theses, observations, relationships, assumptions, and thesis updates.

3. Monitoring
   - Assumptions, thesis breakers, valuation drift, stale theses, and shared exposures.

4. Committee
   - Analyst, portfolio manager, risk officer, devil's advocate, and IC chair perspectives as internal reasoning roles.

5. Decision
   - IC agenda, conviction review, action candidates, decision log, and review loop.

The UI should expose the decision layer first. The engine can contain the evidence, memory, monitoring, and committee layers.

## Core Product Loop

The main product loop:

1. Add asset to IC agenda.
2. Select asset type: Public Equity, Conventional Business, Startup, Real Estate, Crypto, Macro View, or Other.
3. For public equities, optionally run stock intake with cited data.
4. For private and alternative assets, use manual-only intake with no automated data feed.
5. Paste messy intake: notes, links, bullets, article excerpts, screenshots transcribed by the user, pitch-deck notes, valuation memos, or a draft thesis.
6. AI extracts a structured thesis, assumptions, thesis breakers, watch items, and unresolved questions.
7. User verifies the extracted structure and locks only cited facts or user-provided assumptions.
8. Attach evidence and assumptions.
9. Define thesis breakers and assumption-monitoring rules.
10. Monitor new information only against assumptions, breakers, valuation drift, and portfolio exposure.
11. Generate IC agenda.
12. Run pre-mortem for Add / Increase Position decisions.
13. Commit decision.
14. Preserve decision and thesis evolution.

This loop is stronger than opening chat, asking a question, and saving an answer.

## MVP Screens

### 1. Frictionless Thesis Intake

Lets the user paste rough source material instead of filling a long form.

It should extract:

- Thesis summary.
- Key assumptions.
- Thesis breakers.
- Watch items.
- Valuation assumptions.
- Catalysts.
- Open questions.
- Evidence links.

The user must confirm the extracted structure before it becomes thesis memory. This fixes the cold-start problem for investors with 20-100 watchlist names.

### 2. Manual Private Asset IC Entry

Lets the user add non-public assets to the same IC Agenda without pretending the app has automated data coverage.

Supported V1 asset types:

- Conventional Business.
- Startup.
- Real Estate.
- Crypto.
- Macro View.
- Other.

This screen should provide:

- Manual thesis, assumptions, breakers, and watch items.
- Manual valuation, valuation date, valuation source, and pricing freshness.
- Liquidity tag and expected duration.
- Portfolio role and sizing intent.
- Evidence upload or attachment for pitch decks, memos, notes, screenshots, PDFs, and deal documents.
- Risk Officer prompts tailored to the asset type.
- Decision Ledger actions using the same IC action vocabulary as public equities.

For V1, this feature must not include automated private-company, startup, real-estate, or crypto data feeds. The goal is to prove that the Decision Ledger, Evidence Locker, and Risk Officer workflow creates value before automating connectors.

Minimum Risk Officer prompts for manual private assets:

- Illiquidity and realistic exit path.
- Stale valuation and valuation-source quality.
- Customer, supplier, or revenue concentration.
- Founder, operator, or key-person dependency.
- Balance-sheet, debt, refinancing, or cash-burn risk.
- Legal, regulatory, tax, or ownership-structure risk.
- Dilution, cap-table, or follow-on funding risk for startups.
- Vacancy, tenant, leverage, location, and refinancing risk for real estate.
- Custody, protocol, liquidity, regulatory, and smart-contract risk for crypto.
- Macro sensitivity, FX exposure, rates exposure, and hidden correlation with existing assets.

### 3. Watchlist IC Dashboard

Shows the user's investment committee agenda:

- Names requiring attention.
- Public equities and manually tracked private assets in one agenda.
- Assumptions requiring attention.
- Stale theses.
- Risk triggers.
- Thesis-breaker alerts.
- Valuation drift.
- Shared macro exposure.
- Overconfidence warnings.
- Conviction changes.
- Capital action candidates.

### 4. Thesis Detail Page

The current analysis page should evolve into this screen.

It should show:

- Asset type.
- Thesis summary.
- Key assumptions and monitoring rules.
- Thesis breakers.
- Supporting evidence.
- Contradictory evidence.
- Catalysts to watch.
- Open questions.
- Valuation drift.
- Portfolio role and sizing intent.
- Liquidity, duration, pricing freshness, and valuation source for private or manually tracked assets.
- Narrative evolution.
- Decision history.
- Grounded bull/bear debate.

### 5. Evidence Locker

The Evidence Locker is the reframed Knowledge Library.

It should show:

- Sources.
- Notes.
- Filings.
- Pitch decks, memos, PDFs, screenshots, and deal documents.
- Active context.
- Linked theses.
- Source reliability and date.

## Trust And Data Policy

Wrong uncited data is worse than missing data.

Data trust is the biggest MVP risk. If the product confidently locks a wrong EPS, ROE, price, share count, dividend, or valuation input once, trust is damaged.

Before a number becomes a locked valuation figure, the app must show:

- Source title.
- Source URL.
- Data timestamp or reporting period.
- Whether the value is current, delayed, TTM, annual, estimated, or user-provided.
- Confidence level.

For stock intake, auto-filled values must be auditable before locking. If the system is not highly confident about a scraped or extracted value, it should highlight the uncertainty, provide the source link, and ask the user to verify. If the system cannot cite a value, it should ask for confirmation or leave the field empty rather than guessing.

The BBCA issue exposed a core product risk: broad web snippets can produce stale or incorrect figures. The product must not lock weakly sourced numbers into the valuation engine.

## Free Data Source Policy For Stock Intake

Use a combined free source model:

- Official-first for fundamentals.
- Cheap dependable APIs where available for standard equities.
- Fast free market data for current or delayed price when API coverage is acceptable.
- Web search only for source discovery, not as the direct source of lockable valuation numbers.

Practical policy:

- Fundamentals should come from company investor-relations pages, annual reports, financial statements, or IDX/company filings when available.
- Price can come from a fast free quote source if clearly labeled as third-party and delayed when applicable.
- Every auto-filled number must carry source title, source URL, date or period, and confidence.
- If a number is not cited, it should not become a locked fact.
- If a scraped number is low confidence, show it as a candidate value requiring user verification.

For Indonesian equities such as BBCA:

- Normalize ticker symbols to the IDX convention, e.g. `BBCA` -> `BBCA.JK` where needed.
- Prefer official company/IDX sources for EPS and ROE.
- Use free quote data for latest/delayed share price only with freshness labeling.
- Keep `discountRate`, `terminalMult`, and `invested/buy price` as user assumptions unless explicitly provided.

Expected app behavior:

- Fetch and show sourced price, EPS, and ROE when available.
- Show source and date beside each inferred value.
- Separate sourced facts from assumptions.
- Prevent vague search snippets from creating lockable price, EPS, or ROE values.
- Leave fields blank or manual when the app cannot cite them.
- Fail gracefully when extraction confidence is low.

## What We Keep From Prior PRDs

From `docs/archive/ai_investment_assistant_prd.md`:

- In-context learning and state preservation.
- Do not erase important historical thesis context.
- Markdown thesis export.
- Auditability through clean diffs.
- Idempotent thesis updates.

From `docs/archive/ANALYST_PRD_v1.0.docx`:

- Knowledge Library, reframed as Evidence Locker.
- Proactive relevant-source suggestion.
- Watchlist trigger.
- Analysis history, reframed as Decision Memory.
- Active context selection.
- Save insights back to the library.

From `docs/archive/investment_brain_plans.md`:

- Thesis structure.
- Supporting evidence.
- Contradictory evidence.
- Assumptions.
- Narrative Evolution.
- Catalysts to Watch.
- Open Questions.
- Migration mindset from simple local state to structured backend.

From `docs/archive/investment_brain_v1_prd.md`:

- Structured memory layer.
- Entity / Thesis / Observation / Relationship primitives.
- Thesis-aware reasoning.
- Thesis evolution engine.
- Worldview snapshot.
- Avoid raw chunk-based RAG as the main primitive.

## What We Reframe

- Knowledge Library becomes Evidence Locker.
- Watchlist becomes IC Agenda.
- Analysis History becomes Decision Memory.
- AI personas become Investment Committee roles.
- Change Detection becomes Assumption Monitoring.
- Chat becomes an interface to thesis memory, not the product itself.
- Confidence percentage becomes a conviction rubric based on evidence quality, thesis freshness, and assumption risk.
- Markdown files become export/audit artifacts, not the only product surface.

## What We Deprioritize

- CLI-first user experience.
- Crypto as initial wedge.
- Generic five-mode chat interface.
- Five always-visible AI personas in the MVP UI.
- Generic stock/news monitoring that is not tied to assumptions, thesis breakers, valuation drift, or portfolio exposure.
- Full PostgreSQL/dual-LLM architecture before validating the loop.
- Graph database or complex worldview engine before watchlist/thesis workflow works.
- Automated data connectors for every asset class before the equity workflow proves retention.
- Metrics that reward research volume, such as number of sources added per session.

## Family Office Engine Direction

The comprehensive Family Office Engine remains the correct end-state.

The engine should be universal, but the connectors should be sequential. The core loop of Thesis, Evidence, Assumption, Decision, and Review can apply to public equities, private businesses, real estate, startups, crypto, and macro views.

The MVP should use public equities as the first automated data connector because they have tighter feedback loops and more accessible data. At the same time, V1 should support manual private and alternative assets in the same IC Agenda to prove that the workflow is truly asset-agnostic.

For V1, non-equity assets are deliberately dumb/manual entries:

- Upload pitch decks, notes, valuation memos, or deal documents.
- Log thesis, assumptions, breakers, sizing intent, and decisions.
- Avoid pretending there is reliable automated pricing when there is not.
- Provide no automated data feeds for conventional businesses, startups, real estate, crypto, or other private/alternative assets.

Every asset should eventually carry:

- Liquidity tag.
- Duration tag.
- Pricing freshness.
- Valuation source.
- Portfolio role.
- Sizing intent.
- Macro dependencies.

Macro should not behave like another isolated asset class. It should act as the environment across theses. The Risk Officer should compare the user's macro worldview against asset-level assumptions and flag contradictions, crowded exposures, and hidden shared bets.

## Next Build Priorities

1. Add asset-agnostic IC primitives.
   - Model Thesis, Assumption, Thesis Breaker, Evidence, Decision, Review, and IC Agenda independent of asset class.
   - Add asset type to every thesis: Public Equity, Conventional Business, Startup, Real Estate, Crypto, Macro View, or Other.
   - Ensure public equities and manually tracked private assets can appear in the same IC Agenda.

2. Add frictionless thesis intake.
   - Let users paste messy notes, links, bullets, and draft reasoning.
   - Extract thesis summary, key assumptions, thesis breakers, watch items, open questions, and evidence candidates.
   - Require user confirmation before saving extracted thesis memory.
   - Support equity research notes, pitch-deck notes, deal memos, business notes, and other asset-specific source material.

3. Add manual private asset IC entry.
   - Let users add Conventional Business, Startup, Real Estate, Crypto, Macro View, or Other assets without automated feeds.
   - Capture manual valuation, valuation date, valuation source, pricing freshness, liquidity, duration, portfolio role, and sizing intent.
   - Attach pitch decks, memos, PDFs, screenshots, notes, and deal documents to the Evidence Locker.
   - Generate Risk Officer prompts for illiquidity, stale valuation, concentration, key-person risk, funding risk, legal/regulatory risk, exit path, and macro exposure.
   - Use the same Decision Ledger and IC action vocabulary as public equities.

4. Fix stock intake trust.
   - Add cited, field-level provenance for auto-filled stock figures.
   - Do not lock uncited values.
   - Distinguish market price, EPS, ROE, user assumptions, and defaults.
   - Use dependable APIs where possible for standard equities.
   - Send low-confidence scraped values to user verification.

5. Add thesis state.
   - Store thesis summary, key assumptions, thesis breakers, watch items, valuation assumptions, conviction, portfolio role, sizing intent, and review cadence.

6. Add Evidence Locker primitives.
   - Store evidence items with source, date, type, reliability, and thesis linkage.
   - Classify evidence as supporting, contradictory, neutral, or unresolved.
   - Support uploaded/manual evidence for private assets before building automated connectors.

7. Add Assumption Monitoring.
   - Convert each key assumption into monitorable conditions where possible.
   - Flag new information only when it intersects with assumptions, thesis breakers, valuation drift, or portfolio risk.
   - Avoid generic alerts based only on news volume or small price movement.
   - For manual private assets, rely on user-added evidence and scheduled review prompts rather than automated external monitoring.

8. Add Watchlist IC Agenda.
   - Aggregate theses into a review queue.
   - Rank by assumption pressure, stale thesis, triggered risks, contradiction strength, valuation drift, shared macro exposure, or capital relevance.
   - Show public equities and manual private assets together while clearly labeling data freshness and liquidity.

9. Add decision review loop.
   - Require pre-mortem for Add / Increase Position decisions.
   - Compare prior decisions against later outcomes.
   - Surface whether the thesis was right for the right reason.

## Build Guardrails

- Do not build another AI research assistant.
- Do not optimize for source volume or chat volume.
- Do not make the core thesis, assumption, evidence, or decision schema equity-only.
- Do not lock uncited valuation figures.
- Do not monitor news or prices unless they intersect with assumptions, thesis breakers, valuation drift, or portfolio exposure.
- Do not build automated private-asset data feeds in V1.
- Do not treat AI as the decision-maker.
- Do not introduce black-box confidence percentages.
- Do not make five AI personas the primary MVP interface.
- Do not overbuild backend architecture before the watchlist/thesis loop works.
- Do not hide assumptions inside AI prose.
- Do not mix live public prices and stale private valuations without clear freshness, liquidity, and duration labels.

## Answered Product Decisions

### Manual Private Asset MVP Scope

Include dumb/manual private and alternative assets in V1.

Supported manual asset types:

- Conventional Business
- Startup
- Real Estate
- Crypto
- Macro View
- Other

V1 behavior:

- Add these assets to the same IC Agenda as public equities.
- Use the same Thesis, Assumption, Evidence, Decision, Review, and Decision Ledger primitives.
- Provide Evidence Locker attachment for pitch decks, memos, PDFs, screenshots, deal documents, and notes.
- Provide Risk Officer prompts, pre-mortems, and decision review.
- Require manual valuation, valuation date, valuation source, pricing freshness, liquidity, duration, portfolio role, and sizing intent.
- Provide no automated data feed, pricing sync, cap-table sync, deal-room sync, property feed, wallet sync, or startup database connector.

The goal is to prove that the IC workflow creates value across asset classes before automating private-market connectors.

### Indonesian Equities Data Sources

Use a free, source-tiered policy.

Tier 1: official issuer and exchange documents.

- Use company investor-relations pages, annual reports, financial statements, financial highlights, and official IDX/company filings for fundamentals.
- For BBCA, the canonical source path starts from BCA investor relations, including annual reports and stock information pages.
- EPS, ROE, revenue, net profit, dividends, and capital metrics should prefer official filings or issuer disclosures.

Tier 2: free third-party market quote sources.

- Use free quote data only for latest or delayed market price.
- Treat quote data as third-party, timestamped, and potentially delayed.
- Do not use third-party quote pages as the primary source for fundamentals when official filings are available.

Tier 3: search/discovery tools.

- Tavily or web search can find relevant source URLs.
- Search snippets must not create lockable valuation numbers.
- Any value discovered through search must be traced back to a source page or document before it can be locked.

Implementation default:

- Fundamentals: official issuer/IDX documents.
- Price: free quote source with timestamp and delay label.
- Discovery: Tavily/web search only as source finder.
- Fallback: if no cited source is available, leave the field blank or mark it as manual.

### IC Agenda Refresh Cadence

MVP should use manual refresh with a weekly default review cadence.

- Manual refresh keeps the first version local-first and avoids fake automation.
- Each thesis should have `lastReviewedAt`, `nextReviewDue`, and `reviewCadence`.
- Default cadence: weekly for active watchlist names.
- Stale threshold: 7 days past `nextReviewDue`.
- Later versions can add scheduled daily/weekly monitoring once backend sync and reliable data fetch are in place.

### Conviction Model

Use both user-owned conviction and rubric-derived diagnostics.

- User owns the final conviction label: Low, Medium, or High.
- The system computes supporting diagnostics, not a black-box confidence score.
- Diagnostics should include evidence quality, thesis freshness, contradiction pressure, assumption risk, and portfolio fit.
- The UI should show why conviction may need review, but the user must explicitly confirm conviction changes.

Avoid percentage confidence scores in the MVP. They create false precision.

### First Action Vocabulary

Use investment-committee action language, not generic approve/hold/reject only.

MVP actions:

- No Action
- Watch
- Research More
- Increase Conviction
- Decrease Conviction
- Add / Increase Position
- Trim / Reduce Position
- Exit
- Archive

Legacy approve/hold/reject can remain internally or as a simplified label, but the user-facing workflow should move toward IC actions.

### Portfolio Sizing Before Brokerage Import

Use manual position metadata and sizing bands before brokerage integration.

MVP fields:

- Current position: none, small, medium, large, or custom capital amount.
- Target weight: optional percentage.
- Max weight: optional percentage.
- Portfolio role: core compounder, tactical, hedge, income, optionality, or watchlist only.
- Sizing band: starter, standard, high conviction, or max allocation.

The product should not pretend to know the live portfolio before brokerage/import exists. It should support decision discipline by asking: what role should this asset play, what is the intended size, and what would justify increasing or reducing it?

### Source References For Data Policy

- BCA official investor relations includes annual-report access, including a 2025 annual report entry.
- BCA official stock information page exposes stock-information navigation such as share performance, shareholder composition, listing chronology, and dividends.
- Alpha Vantage documents free API key access and global equity time-series / quote-style APIs, making it an acceptable optional fallback for a documented quote provider if Indonesian symbols validate in implementation.
