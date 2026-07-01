# AI Investment Committee Build Plan (V3)

Source of truth: `PRODUCT_STRATEGY.md`.

This plan outlines the implementation of the V3 vision: moving from a static IndexedDB-based workflow into a **Continuous Shadow IC** powered by a Probabilistic Knowledge Graph and a **Local-First CRDT engine**.

## Latest Status

- **Legacy V2**: Archived/Deleted. The old IndexedDB (`Dexie`) web application and legacy CLI tools have been purged from the repository.
- **V3 Foundation**: The `shadow-ic-vision` branch has been established. The core product strategy and data model have been rewritten to focus on Graph nodes and autonomous Shadow IC background agents.

## V3 Milestone Pipeline

### M1 - The CRDT Brain Transplant (Data Layer)
- Initialize a fresh, clean Next.js workspace in `app/`.
- Establish the Local-First Sync engine (e.g., PowerSync / ElectricSQL / local SQLite).
- Define the base Graph tables (`nodes`, `edges`, `evidence`) and ensure they sync reliably.
- Build a headless data client (no UI yet) to verify that we can create an Assumption node and link it to a Thesis node.

### M2 - The Worldview Dashboard (UI/UX)
- Build the V3 UI on top of the CRDT engine.
- Create the visual Knowledge Graph layout to replace the old flat "Watchlist".
- Show interconnected assumptions and highlight which theses depend on them.
- Ensure the UI correctly reads the probabilistic confidence scores of the edges.

### M3 - The Shadow IC (Background Agents)
- Build the Node.js/Edge background workers for the Risk Officer and Devil's Advocate.
- Connect structured APIs (AlphaVantage, FMP) to pull live quantitative data automatically into the graph.
- Implement the LLM qualitative layer: Agents fetch new SEC filings and debate their impact on specific Assumption nodes.
- Wire the agent conclusions to update the graph weights, triggering the "IC Agenda" alerts if a thesis breaks.

### M4 - Decision Ledger & Multiplayer
- Rebuild the "pre-mortem" and Decision logging UI.
- Enable end-to-end cloud sync so multiple users (partners, advisors) can join the workspace.
- Implement "Skin-in-the-Game" backtesting (checking assumptions against historical API data).

---

## Action Items
**Next immediate step**: Run `npx create-next-app` to scaffold the fresh V3 frontend inside `app/` and commit the new clean baseline.
