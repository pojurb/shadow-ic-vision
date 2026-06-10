# Product Strategy - AI Investment Committee

## Current Product Thesis

This product is not an AI research tool. It is an AI Investment Committee for serious investors who need better portfolio decisions, not more information.

The product should help the user answer:

- What should I do next?
- What is my biggest risk?
- What changed?
- What am I missing?
- Where am I overconfident?
- What would break my thesis?
- What deserves more capital?
- What deserves less capital?

## Target ICP

Primary ICP: serious self-directed investors.

They typically:

- Manage their own portfolio.
- Track a watchlist of 20-100 companies.
- Read annual reports and investment content.
- Already use AI tools such as ChatGPT, Claude, Gemini, or Perplexity.
- Make several meaningful investment decisions per year.

Their pain is not lack of information. Their pain is lack of decision structure, memory, monitoring, and risk discipline.

## Decisions Locked

- Beachhead workflow: Watchlist IC Dashboard.
- Core promise: decision clarity.
- Data trust policy: cited facts only before locking valuation figures.
- Initial target: serious self-directed investors, not institutions.
- Data source policy: free, reliable-enough hybrid.
- Current analysis workspace should evolve into the thesis detail page for each asset.

## Product Pillars

### Thesis Memory

The product must remember what the user believed, what evidence supported the thesis, what would break it, and when it was last reviewed.

### Investment Committee Logic

The product should behave like a committee with distinct roles:

- Analyst: facts, valuation, and model.
- Portfolio Manager: fit, sizing, opportunity cost, and capital allocation.
- Risk Officer: downside, exposure, and assumptions.
- Devil's Advocate: why the user may be wrong.
- IC Chair: decision quality and next action.

### Change Detection

The product should surface what changed since the last thesis update, including price moves, earnings changes, valuation changes, important news, thesis triggers, and risk triggers.

### Conviction Management

The product should not invent an AI confidence score. It should help the user manage conviction through evidence quality, uncertainty, thesis freshness, and decision history.

### Decision History

The product should preserve what the user decided, why they decided it, and what happened afterward.

## Trust And Data Policy

Wrong uncited data is worse than missing data.

Before a number becomes a locked valuation figure, the app should show:

- Source title.
- Source URL.
- Data timestamp or reporting period.
- Whether the value is current, delayed, TTM, annual, estimated, or user-provided.
- Confidence level.

For stock intake, auto-filled values must be auditable before locking. If the system cannot cite a value, it should ask for confirmation or leave the field empty rather than guessing.

The BBCA issue exposed a core product risk: broad web snippets can produce stale or incorrect figures. The product must not lock weakly sourced numbers into the valuation engine.

## Free Data Source Strategy

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

## Plan: Free, Reliable Data Source Policy For Stock Intake

### Summary

Use a combined source model: official-first for fundamentals and fast free market data for current or delayed price.

No paid data subscription is required for the MVP. The user should not need to manually find routine data for each stock. The app should fetch, cite, label, and ask for confirmation before locking values.

### Source Rules

- Fundamentals: use official company investor-relations pages, annual reports, financial statements, or IDX/company filings first.
- Price: use a fast free quote source for latest or delayed market price, clearly labeled as third-party and delayed if applicable.
- IDX/company filings: prefer them as evidence when available, but do not depend on one brittle page scrape.
- Web search/Tavily: use only for discovery of source URLs, not as the direct source of lockable valuation numbers.
- Lockable values must include source title, source URL, data date/period, and confidence.

### Expected App Behavior

For a ticker such as `BBCA`, the app should automatically:

- Normalize the ticker to the IDX convention, e.g. `BBCA` -> `BBCA.JK` where needed.
- Fetch latest or delayed share price from a free quote source.
- Fetch EPS and ROE from official annual report, financial statement, or financial-highlight sources when possible.
- Show all inferred values in the confirm card with provenance.
- Prevent vague search snippets from creating lockable price, EPS, or ROE values.

If the app cannot cite a value, it should leave the field blank or mark it as a manual/assumption field. It should never silently guess.

`discountRate`, `terminalMult`, and `invested/buy price` should remain user assumptions unless explicitly provided by the user.

### What The User Needs To Do

The user should not need to manually collect routine stock data.

The user does need to accept these MVP constraints:

- Free quote data can be delayed.
- Fundamentals may be latest annual, latest interim, or TTM depending on source availability, and must be labeled.
- If Tavily remains part of source discovery, the deployed app needs `TAVILY_API_KEY` configured.
- No paid market-data API key is required for MVP.

### Implementation Direction

- Add a stock data resolver route that accepts a ticker and returns normalized ticker, sourced fields, warnings, and citations.
- Run the stock resolver before LLM intake extraction for stock requests.
- Pass source-backed fields into the confirm card.
- Prevent uncited LLM-extracted numbers from becoming lockable fields.
- Update the confirm card to separate sourced facts from assumptions.

### Acceptance Tests

- `BBCA` normalizes to `BBCA.JK`.
- Sourced price, EPS, and ROE display with citations when available.
- Search snippets cannot create lockable valuation numbers.
- Missing source produces a warning/manual field instead of a bad auto-fill.
- User-provided values override fetched values.

## Session Decisions And Lessons

- The product should optimize for decision clarity, not research volume.
- The first monetizable workflow should be a Watchlist IC Dashboard.
- Current single-asset analysis should become the thesis detail page inside a broader watchlist/portfolio decision system.
- The BBCA issue is a trust failure, not just an extraction bug.
- Wrong uncited data is more damaging than missing data for this ICP.
- The app should behave like an investment committee: cite facts, challenge assumptions, preserve thesis memory, and force explicit decisions.

## MVP Direction

Build toward a Watchlist IC Dashboard.

The dashboard should produce an IC agenda:

- Names requiring attention.
- What changed.
- Biggest risks.
- Thesis-breaker alerts.
- Overconfidence warnings.
- Conviction changes.
- Capital action candidates.

The existing single-analysis workspace becomes the thesis detail page where the user can inspect source data, revise assumptions, run bull/bear debate, and commit decisions.

## Next Build Priorities

1. Fix stock intake trust.
   - Add cited, field-level provenance for auto-filled stock figures.
   - Do not lock uncited values.
   - Distinguish market price, EPS, ROE, user assumptions, and defaults.

2. Add thesis state.
   - Store thesis summary, key assumptions, break conditions, watch items, and conviction.

3. Add watchlist agenda.
   - Aggregate analyses into a daily or weekly committee queue.
   - Rank by changed facts, stale thesis, triggered risks, or capital relevance.

4. Add decision review loop.
   - Compare prior decisions against later outcomes.
   - Surface whether the thesis was right for the right reason.

## Open Questions

- What exact free data sources should be trusted for Indonesian equities?
- Should the first dashboard be daily, weekly, or manually refreshed?
- Should conviction be a user-entered field, a rubric, or both?
- Which user action vocabulary should be supported: watch, research, add, trim, sell, archive, or only approve/hold/reject?
