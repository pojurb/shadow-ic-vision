# Product Strategy - AI Investment Committee

## Final Product Definition

This product is an AI Investment Committee for serious self-directed investors.

It is not another AI research chatbot. It is a decision-quality system that remembers the user's investment theses, tracks what changed, challenges assumptions, surfaces risk, and helps decide what deserves attention or capital.

The winning product is:

> Watchlist IC Dashboard + Thesis Memory + Evidence Locker + Decision Ledger + Change Detection.

The current single-asset analysis cockpit should become the thesis detail page inside this broader system.

## Source Documents Synthesized

This strategy consolidates the following documents:

- `AI_Investment_Committee_ICP_v1.md`
- `ai_investment_assistant_prd.md`
- `ANALYST_PRD_v1.0.docx`
- `investment_brain_plans.md`
- `investment_brain_v1_prd.md`

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
- Data trust policy: cited facts only before locking valuation figures.
- Initial target: serious self-directed investors, not institutions.
- MVP data source policy: free, reliable-enough hybrid.
- Current analysis workspace evolves into a thesis detail page.
- Build on the current Next.js app before starting a new Python/PostgreSQL system.

## What The Product Is Not

- Not a generic stock analyzer.
- Not a PDF Q&A app.
- Not a trading bot.
- Not a research-volume machine.
- Not a traditional chunk-based RAG product.
- Not a chatbot with finance prompts.

## Product Pillars

### Thesis Memory

The product remembers what the user believed, what evidence supported the thesis, what would break it, and when it was last reviewed.

### Evidence Locker

The product stores filings, articles, notes, transcripts, market data, and user insights as evidence. Evidence should be linked to theses as supporting, contradictory, neutral, or unresolved.

### Investment Committee Logic

The product behaves like a committee with distinct roles:

- Analyst: facts, valuation, and model.
- Portfolio Manager: fit, sizing, opportunity cost, and capital allocation.
- Risk Officer: downside, exposure, and assumptions.
- Devil's Advocate: why the user may be wrong.
- IC Chair: decision quality and next action.

### Change Detection

The product surfaces what changed since the last thesis update, including price moves, earnings changes, valuation changes, news, thesis triggers, and risk triggers.

### Conviction Management

The product should not invent a black-box AI confidence score. Conviction should be managed through evidence quality, thesis freshness, uncertainty, assumption risk, and decision history.

### Decision Ledger

The product preserves what the user decided, why they decided it, and what happened afterward.

## Synthesized Product Model

The combined idea from all PRDs should be implemented as four layers:

1. Evidence
   - Filings, articles, notes, transcripts, market data, and user insights.

2. Memory
   - Entities, theses, observations, relationships, assumptions, and thesis updates.

3. Committee
   - Analyst, portfolio manager, risk officer, devil's advocate, and IC chair perspectives.

4. Decision
   - IC agenda, conviction review, action candidates, decision log, and review loop.

The UI should expose the decision layer first. The engine can contain the evidence, memory, and committee layers.

## Core Product Loop

The main product loop:

1. Add asset to watchlist.
2. Create initial thesis.
3. Attach evidence and assumptions.
4. Define thesis breakers.
5. Ingest or monitor new information.
6. Generate IC agenda.
7. Commit decision.
8. Preserve decision and thesis evolution.

This loop is stronger than opening chat, asking a question, and saving an answer.

## MVP Screens

### 1. Watchlist IC Dashboard

Shows the user's investment committee agenda:

- Names requiring attention.
- What changed.
- Stale theses.
- Risk triggers.
- Thesis-breaker alerts.
- Overconfidence warnings.
- Conviction changes.
- Capital action candidates.

### 2. Thesis Detail Page

The current analysis page should evolve into this screen.

It should show:

- Thesis summary.
- Key assumptions.
- Thesis breakers.
- Supporting evidence.
- Contradictory evidence.
- Catalysts to watch.
- Open questions.
- Narrative evolution.
- Decision history.
- Grounded bull/bear debate.

### 3. Evidence Locker

The Evidence Locker is the reframed Knowledge Library.

It should show:

- Sources.
- Notes.
- Filings.
- Active context.
- Linked theses.
- Source reliability and date.

## Trust And Data Policy

Wrong uncited data is worse than missing data.

Before a number becomes a locked valuation figure, the app must show:

- Source title.
- Source URL.
- Data timestamp or reporting period.
- Whether the value is current, delayed, TTM, annual, estimated, or user-provided.
- Confidence level.

For stock intake, auto-filled values must be auditable before locking. If the system cannot cite a value, it should ask for confirmation or leave the field empty rather than guessing.

The BBCA issue exposed a core product risk: broad web snippets can produce stale or incorrect figures. The product must not lock weakly sourced numbers into the valuation engine.

## Free Data Source Policy For Stock Intake

Use a combined free source model:

- Official-first for fundamentals.
- Fast free market data for current or delayed price.
- Web search only for source discovery, not as the direct source of lockable valuation numbers.

Practical policy:

- Fundamentals should come from company investor-relations pages, annual reports, financial statements, or IDX/company filings when available.
- Price can come from a fast free quote source if clearly labeled as third-party and delayed when applicable.
- Every auto-filled number must carry source title, source URL, date or period, and confidence.
- If a number is not cited, it should not become a locked fact.

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

## What We Keep From Prior PRDs

From `ai_investment_assistant_prd.md`:

- In-context learning and state preservation.
- Do not erase important historical thesis context.
- Markdown thesis export.
- Auditability through clean diffs.
- Idempotent thesis updates.

From `ANALYST_PRD_v1.0.docx`:

- Knowledge Library, reframed as Evidence Locker.
- Proactive relevant-source suggestion.
- Watchlist trigger.
- Analysis history, reframed as Decision Memory.
- Active context selection.
- Save insights back to the library.

From `investment_brain_plans.md`:

- Thesis structure.
- Supporting evidence.
- Contradictory evidence.
- Assumptions.
- Narrative Evolution.
- Catalysts to Watch.
- Open Questions.
- Migration mindset from simple local state to structured backend.

From `investment_brain_v1_prd.md`:

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
- Chat becomes an interface to thesis memory, not the product itself.
- Confidence percentage becomes a conviction rubric based on evidence quality, thesis freshness, and assumption risk.
- Markdown files become export/audit artifacts, not the only product surface.

## What We Deprioritize

- CLI-first user experience.
- Crypto as initial wedge.
- Generic five-mode chat interface.
- Full PostgreSQL/dual-LLM architecture before validating the loop.
- Graph database or complex worldview engine before watchlist/thesis workflow works.
- Metrics that reward research volume, such as number of sources added per session.

## Next Build Priorities

1. Fix stock intake trust.
   - Add cited, field-level provenance for auto-filled stock figures.
   - Do not lock uncited values.
   - Distinguish market price, EPS, ROE, user assumptions, and defaults.

2. Add thesis state.
   - Store thesis summary, key assumptions, thesis breakers, watch items, conviction, and review cadence.

3. Add Evidence Locker primitives.
   - Store evidence items with source, date, type, reliability, and thesis linkage.
   - Classify evidence as supporting, contradictory, neutral, or unresolved.

4. Add Watchlist IC Agenda.
   - Aggregate theses into a review queue.
   - Rank by changed facts, stale thesis, triggered risks, contradiction strength, or capital relevance.

5. Add decision review loop.
   - Compare prior decisions against later outcomes.
   - Surface whether the thesis was right for the right reason.

## Build Guardrails

- Do not build another AI research assistant.
- Do not optimize for source volume or chat volume.
- Do not lock uncited valuation figures.
- Do not treat AI as the decision-maker.
- Do not introduce black-box confidence percentages.
- Do not overbuild backend architecture before the watchlist/thesis loop works.
- Do not hide assumptions inside AI prose.

## Open Questions

- What exact free data sources should be trusted for Indonesian equities?
- Should the first IC agenda be manually refreshed, weekly, or daily?
- Should conviction be user-entered, rubric-derived, or both?
- Which action vocabulary should be supported first: watch, research, add, trim, exit, archive, or approve/hold/reject?
- How should portfolio sizing be represented before full brokerage/portfolio import exists?

