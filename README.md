# JP-Invest Workspace

AI Investment Committee for serious self-directed investors.

This project is not an AI research toy. The product direction is an investment decision workspace that helps investors remember theses, monitor what changed, challenge assumptions, manage conviction, and make better portfolio decisions.

The current app is a local-first Next.js cockpit with single-asset analysis, grounded AI debate, portfolio composition, and a decision log. The strategic direction is documented in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md).

## Product Thesis

The product should help answer:

- What should I do next?
- What is my biggest risk?
- What changed?
- What am I missing?
- Where am I overconfident?
- What would break my thesis?
- What deserves more capital?
- What deserves less capital?

The first target user is the serious self-directed investor with a watchlist of 20-100 companies and recurring portfolio decisions.

## Current Capabilities

- Local-first investment workspace stored in browser IndexedDB.
- Single-asset analysis for listed equities, startups/VC, and conventional businesses.
- Deterministic financial engine for locked valuation figures.
- AI bull/bear debate and advisory lenses using Anthropic, OpenAI, or Gemini.
- BYOK provider settings stored locally in the browser.
- File and link context: PDF, image, URL fetch, and web research.
- Grounded follow-up chat after an analysis is generated.
- Decision logging with approve/hold/reject rationale.
- Portfolio composition and cross-asset analysis.

## Strategic Direction

The product should evolve from a single-analysis cockpit into a Watchlist IC Dashboard:

- Each asset has thesis memory, assumptions, break conditions, and conviction.
- The dashboard surfaces an IC agenda: what changed, what is risky, what needs attention, and what deserves capital.
- The app should preserve decision history and later review whether prior theses were right for the right reasons.
- Data trust matters: wrong uncited data is worse than missing data.

For stock intake, valuation figures should not be locked unless they are cited, labeled, and confirmed. The preferred MVP data policy is free and reliable-enough:

- Official-first for fundamentals.
- Fast free market data for current or delayed price.
- Web search for source discovery only, not as a lockable data source.

## Repository Structure

```text
jp-invest/
|-- README.md                         Current project overview
|-- PRODUCT_STRATEGY.md               Durable product strategy and decisions
|-- BUILD_PLAN.md                     Current milestone tracker
|-- PROGRESS.md                       Current implementation log
|-- DATA_MODEL.md                     Domain model and storage design
|-- docs/deployment/                  Deployment runbooks
|-- docs/archive/                     Historical PRDs and strategy inputs
|-- app/                              Main Next.js web application
|-- scripts/                          Legacy/local quantitative utilities
|-- inputs/                           Input folders for legacy parsing flows
|-- outputs/                          Generated thesis outputs
|-- system/                           Legacy orchestration/protocol docs
`-- data/                             Legacy portfolio state files
```

The production product work is primarily in `app/`.

## App Quick Start

```bash
cd app
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Build:

```bash
cd app
npm run build
```

Test:

```bash
cd app
npm test
```

## Environment

The app is BYOK for AI providers. The user enters Anthropic, OpenAI, or Gemini API keys in the app settings; those keys are stored in the browser and sent directly to the selected provider.

Server-side web search uses Tavily:

```env
TAVILY_API_KEY=...
```

This is needed for `/api/web-search` and deployed web-research fallback behavior.

## Important Product Rules

- Do not position the product as a generic stock analyzer.
- Do not lock uncited valuation numbers into the engine.
- Do not treat AI output as the decision-maker.
- Preserve the human decision log.
- Treat analysis as thesis memory, not a one-off answer.
- Optimize for decision clarity over research volume.

## Key Docs

- [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md): current product strategy, decisions, and roadmap direction.
- [BUILD_PLAN.md](BUILD_PLAN.md): current milestone tracker and next build order.
- [PROGRESS.md](PROGRESS.md): implementation log and latest saved status.
- [DATA_MODEL.md](DATA_MODEL.md): domain model, storage, and data flow.
- [app/CODE_ANATOMY.md](app/CODE_ANATOMY.md): app architecture and code map.
- [docs/deployment/VERCEL_CUTOVER.md](docs/deployment/VERCEL_CUTOVER.md): deployment handoff notes.
- [docs/archive/](docs/archive/): historical PRDs and prior strategy inputs.

## Legacy CLI Utilities

Some older command-line utilities remain available:

```bash
node scripts/run.js check
node scripts/run.js calc dcf --cashflows="100,120,144,173,207" --rate=0.15 --terminal=10
node scripts/run.js parse stocks
node scripts/run.js update-state
```

These are secondary to the current Next.js app.
