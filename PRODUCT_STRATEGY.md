# Product Strategy - AI Investment Committee (v3 Vision)

## Final Product Definition

This product is an AI Investment Committee for serious self-directed investors.

It is not another AI research chatbot. It is a **Continuous Shadow IC** and **Probabilistic Knowledge Graph** that remembers the user's investment theses, actively challenges assumptions using autonomous background agents, surfaces risk across a unified worldview, and helps decide what deserves attention or capital.

The winning product is:
> Continuous Shadow IC + Probabilistic Knowledge Graph + Local-First Sync + Decision Ledger.

## Target User
Primary ICP: serious self-directed investors, family offices, and emerging fund managers.
Their pain is not lack of information. Their pain is lack of decision structure, memory, proactive monitoring, and risk discipline.

## Locked Strategic Decisions (v3 Pivot)

- **Continuous Shadow IC**: Shift from "static forms" to active background agents (The Analyst, Risk Officer, Devil's Advocate) that continuously monitor live data streams (SEC filings, news, macro) and debate each other. The user is only notified when the thesis is legitimately threatened.
- **Probabilistic Knowledge Graph**: Shift from "siloed theses" to a unified worldview. Assumptions (e.g., "high inflation", "AI infra spend") are central nodes. If a node is attacked by new evidence, cascading risk is instantly highlighted across the entire portfolio.
- **Multiplayer Local-First (CRDTs)**: Move away from pure browser IndexedDB. We use a Local-First Sync Engine (e.g., PowerSync, ElectricSQL, Yjs) with end-to-end encryption. It provides offline-first speed while syncing to a secure cloud for cross-device access and multiplayer collaboration (spouses, partners, advisors).
- **Separation of Church and State**: Use structured APIs (Bloomberg, FactSet, AlphaVantage) for quantitative facts (EPS, ROE, multiples). Reserve LLMs strictly for qualitative NLP (reading between the lines of transcripts and filings).
- **Skin-in-the-Game Backtesting**: Introduce Empirical Reality Checks. When a user posits an assumption (e.g., "multiple will expand"), the system backtests it against historical data and forces the user to argue against reality.

## Core Product Loop (v3)

1. **Thesis Intake**: Define the investment thesis, asset, and key assumptions.
2. **Graph Linkage**: The system links new assumptions into your existing Knowledge Graph, highlighting shared exposures immediately.
3. **Reality Check**: The system backtests the quantitative assumptions against historical regimes.
4. **Shadow IC Activation**: Background agents (Risk Officer, Devil's Advocate) are spun up for this specific thesis and begin monitoring data streams.
5. **Continuous Debate**: Agents read earnings calls, macro data, and filings in the background. They debate the impact on your thesis.
6. **IC Agenda Push**: You are only notified when the Shadow IC concludes a thesis breaker has been triggered.
7. **Decision Ledger**: You run a pre-mortem, make a decision (Buy/Hold/Exit), and log it. The loop continues.

## What We Leave Behind
- Pure IndexedDB / Dexie architecture (too fragile, single device).
- Manual "refresh" buttons for the IC Agenda (too much user burden).
- LLMs trying to extract exact EPS numbers from random websites (too brittle).

## Next Build Priorities (v3 Migration)
1. **Rip and Replace Data Layer**: Implement the Local-First CRDT engine.
2. **Knowledge Graph Primitives**: Redesign the data model so Assumptions, Theses, and Assets are interconnected nodes.
3. **Shadow IC Prototype**: Build a background Node.js/Edge worker that simulates a Risk Officer consuming a mock news feed and debating an assumption.
4. **API Integration**: Connect AlphaVantage or Financial Modeling Prep for hard quantitative data.
