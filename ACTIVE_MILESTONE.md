# Active Milestone: M1 - The CRDT Brain Transplant (Data Layer)

## 1. Outcome & Scope
The goal of this milestone is to replace the volatile browser-only IndexedDB/Dexie storage with a structured, local-first **CRDT database engine** (utilizing SQLite + Yjs or a syncing SQLite equivalent) designed for a **Probabilistic Knowledge Graph** layout.

### In Scope
- Setup of local-first SQLite/CRDT database within the Next.js `app/` structure.
- Implementation of the Node/Edge storage schema.
- Data helper APIs to create, read, update, delete, and traverse graph nodes/edges.
- Unit testing harness to prove sync integrity, concurrent edits, and schema validation.

### Out of Scope
- Visual rendering of the graph (Milestone 2).
- Autonomous agent debates (Milestone 3).

---

## 2. Technical Contract: The Graph Schema

We represent our worldview as a set of interconnected nodes.

```typescript
export type NodeID = string;
export type NodeType = "Asset" | "Thesis" | "Assumption" | "Evidence" | "MacroDriver";
export type EdgeRelationship = "SUPPORTS" | "CONTRADICTS" | "DEPENDS_ON" | "IMPACTS" | "BELONGS_TO";

export interface GraphNode {
  id: NodeID;
  type: NodeType;
  properties: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface GraphEdge {
  id: string;
  source: NodeID;
  target: NodeID;
  relationship: EdgeRelationship;
  weight: number; // Probabilistic confidence between 0.0 and 1.0
  createdAt: number;
  updatedAt: number;
}
```

---

## 3. The ACI Tool Guards
To ensure that agents do not execute malicious or syntax-broken code inside the database workspace, the database helper library must enforce:
- **Strict Schema Validation:** Every insertion is checked against Zod schemas before hitting the SQLite engine.
- **Cycle Detection:** Edges representing `DEPENDS_ON` or `BELONGS_TO` must not create circular dependencies.

---

## 4. Evaluation & Verification Criteria

A pull request for M1 is only allowed to merge if:
1. **Pass Rate:** 100% of the unit tests in `vitest` pass.
2. **Schema Test:** The database correctly rejects invalid node/edge schemas.
3. **CRDT Test:** Two parallel database sessions editing the same node resolve their conflict deterministically (last-write-wins or CRDT merger) without crashing.
4. **Traversal Test:** The database can successfully query a node and retrieve all directly connected nodes in < 10ms.

---

## 5. Implementation Task Checklist
- [ ] Initialize db configurations in `app/src/lib/db/`
- [ ] Install SQLite/CRDT package dependencies
- [ ] Write Zod schemas for `GraphNode` and `GraphEdge`
- [ ] Implement database write and query functions
- [ ] Implement strict tool guards (syntax checks + cycle detection)
- [ ] Create Vitest unit test suite to run against `docs/evals/golden_set.json` criteria
