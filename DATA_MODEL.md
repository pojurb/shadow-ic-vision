# Data Model - AI Investment Workspace (v3 Vision)

The product is now a Local-First Multiplayer AI Investment Committee workspace powered by CRDTs and a Probabilistic Knowledge Graph. 

Persistence: **Local-First CRDT Engine (e.g., PowerSync / ElectricSQL / Yjs)** synced to a secure cloud backend (Postgres).

## The Knowledge Graph Architecture

In v3, we move away from flat, siloed `Analysis` records. The world is a graph.

```ts
type NodeID = string;

interface GraphNode {
  id: NodeID;
  type: "Asset" | "Thesis" | "Assumption" | "Evidence" | "MacroDriver";
  createdAt: number;
  updatedAt: number;
}

interface GraphEdge {
  id: string;
  source: NodeID;
  target: NodeID;
  relationship: "SUPPORTS" | "CONTRADICTS" | "DEPENDS_ON" | "IMPACTS" | "BELONGS_TO";
  weight: number; // 0.0 to 1.0 representing probabilistic confidence
}
```

## Assumptions as First-Class Nodes

Assumptions are no longer embedded arrays inside a thesis. They are global nodes.

```ts
interface AssumptionNode extends GraphNode {
  type: "Assumption";
  statement: string; // e.g., "NIM compression will be mild"
  state: "valid" | "under_pressure" | "broken";
  confidenceScore: number;
}
```

If "Interest Rates stay high" is an Assumption, multiple `Thesis` nodes can point to it. If the Shadow IC breaks this assumption, all dependent theses are flagged.

## The Shadow IC Worker

The background agents operate on specific nodes in the graph.

```ts
type AgentRole = "Risk_Officer" | "Devils_Advocate" | "Analyst";

interface AgentDebate {
  id: string;
  targetNodeId: NodeID; // The assumption or thesis being debated
  evidenceId: NodeID; // The new filing or transcript triggering the debate
  transcript: ChatMessage[];
  conclusion: "Hold_Thesis" | "Trigger_Review";
  timestamp: number;
}
```

## Quantitative APIs (The Truth Layer)

LLMs no longer guess metrics. We store hard data pulled from APIs.

```ts
interface QuantitativeFact {
  assetId: NodeID;
  metric: "EPS" | "ROE" | "PRICE" | "MULTIPLE";
  value: number;
  period: string;
  sourceApi: "FMP" | "AlphaVantage" | "Edgar";
  timestamp: number;
}
```

## Decision Ledger & Reality Checks

```ts
interface DecisionEntry {
  id: string;
  thesisId: NodeID;
  action: "Add_Position" | "Reduce_Position" | "Exit" | "Hold";
  rationale: string;
  preMortem: string;
  historicalBacktestRef?: string; // Link to the reality check simulation
  timestamp: number;
}
```

## Database Tables (CRDT Sync Layer)

Rather than Dexie, we use local-first SQLite tables synced via CRDTs:

| Table | Primary key | Notes |
|---|---|---|
| `nodes` | `id` | All graph nodes (Theses, Assumptions, Assets) |
| `edges` | `id` | All graph relationships |
| `evidence` | `id` | Filings, URLs, Transcripts |
| `agent_debates`| `id` | The Shadow IC background logs |
| `decisions` | `id` | The Decision Ledger |

The repository normalizes graph traversal on read. A specific Thesis Detail view is just a localized graph query: `GET Node (Asset) -> DEPENDS_ON -> Nodes (Assumptions)`.
