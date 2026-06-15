import { describe, expect, it } from "vitest";
import {
  filterEvidence,
  formatSourceRefLabel,
  formatThesisRefLabel,
  groupEvidenceByRelation,
  linkEvidenceSource,
  normalizeAnalysisEvidence,
  normalizeEvidenceItem,
  promoteEvidenceCandidate,
  unlinkEvidenceSource,
} from "./evidence";
import { emptyThesisMemory } from "./ic";
import type { ContextSource, EvidenceItem, ThesisMemory } from "./types";

describe("evidence domain helpers", () => {
  it("promotes candidates into durable evidence records", () => {
    const item = promoteEvidenceCandidate({
      id: "candidate-1",
      title: "Annual report",
      url: "https://example.com/report",
      note: "Revenue bridge",
      type: "filing",
      relation: "supporting",
      reliability: "official",
      createdAt: 123,
    }, 456);

    expect(item).toMatchObject({
      id: "candidate-1",
      title: "Annual report",
      url: "https://example.com/report",
      note: "Revenue bridge",
      type: "filing",
      relation: "supporting",
      reliability: "official",
      sourceDate: null,
      sourceRefIds: [],
      thesisRefs: [],
      createdAt: 123,
      updatedAt: 456,
    });
  });

  it("normalizes legacy thesis candidates into first-class evidence idempotently", () => {
    const thesis = emptyThesisMemory();
    thesis.evidenceCandidates = [{
      id: "ev1",
      title: "Source",
      url: "https://example.com/source",
      type: "article",
      relation: "supporting",
      reliability: "third_party",
      createdAt: 1,
    }];

    const once = normalizeAnalysisEvidence(undefined, thesis, 2);
    const twice = normalizeAnalysisEvidence(once, thesis, 3);

    expect(once).toHaveLength(1);
    expect(twice).toEqual(once);
  });

  it("dedupes by URL first and by title when no URL exists", () => {
    const thesis = emptyThesisMemory();
    thesis.evidenceCandidates = [
      { id: "c1", title: " Same title ", type: "note", relation: "neutral", reliability: "unknown", createdAt: 1 },
      { id: "c2", title: "same title", type: "note", relation: "neutral", reliability: "unknown", createdAt: 2 },
      { id: "c3", title: "Different", url: "https://example.com/a", type: "article", relation: "supporting", reliability: "third_party", createdAt: 3 },
    ];
    const persisted = [{
      id: "p1",
      title: "Persisted wins URL",
      url: " https://example.com/a ",
      type: "filing",
      relation: "contradictory",
      reliability: "official",
      createdAt: 0,
      updatedAt: 0,
    }];

    const normalized = normalizeAnalysisEvidence(persisted, thesis, 9);
    expect(normalized.map((item) => item.id)).toEqual(["p1", "c1"]);
  });

  it("normalizes unsafe or missing fields with defaults", () => {
    const item = normalizeEvidenceItem({ id: "", title: " Note ", type: "bad", relation: "bad", reliability: "bad" }, 10);
    expect(item).toMatchObject({
      title: "Note",
      type: "other",
      relation: "unresolved",
      reliability: "unknown",
      sourceDate: null,
      sourceRefIds: [],
      thesisRefs: [],
      createdAt: 10,
      updatedAt: 10,
    });
  });

  it("links and unlinks source ids without mutating sources", () => {
    const item = evidenceFixture();
    const sources: ContextSource[] = [{ id: "src1", kind: "link", url: "https://example.com", createdAt: 1 }];
    const linked = linkEvidenceSource(item, "src1", 2);
    const unlinked = unlinkEvidenceSource(linked, "src1", 3);

    expect(sources).toHaveLength(1);
    expect(linked.sourceRefIds).toEqual(["src1"]);
    expect(unlinked.sourceRefIds).toEqual([]);
  });

  it("formats thesis refs for supported targets and missing/deleted refs", () => {
    const thesis: ThesisMemory = emptyThesisMemory();
    thesis.summary = "Core thesis";
    thesis.assumptions = [{ id: "a1", text: "Margin expands", status: "active", createdAt: 1, updatedAt: 1 }];

    expect(formatThesisRefLabel({ target: "summary", id: null }, thesis)).toBe("Summary");
    expect(formatThesisRefLabel({ target: "assumption", id: "a1" }, thesis)).toContain("Margin expands");
    expect(formatThesisRefLabel({ target: "breaker", id: "missing" }, thesis)).toContain("Missing breaker");
  });

  it("groups and filters by relation/type", () => {
    const items = [
      evidenceFixture({ id: "a", relation: "supporting", type: "note" }),
      evidenceFixture({ id: "b", relation: "contradictory", type: "filing" }),
    ];

    expect(groupEvidenceByRelation(items).supporting.map((item) => item.id)).toEqual(["a"]);
    expect(filterEvidence(items, { relation: "contradictory", type: "filing" }).map((item) => item.id)).toEqual(["b"]);
  });

  it("shows broken source refs without dropping data", () => {
    expect(formatSourceRefLabel("missing", [])).toBe("Missing source: missing");
  });
});

function evidenceFixture(patch: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "ev",
    title: "Evidence",
    type: "note",
    relation: "neutral",
    reliability: "user_provided",
    sourceDate: null,
    sourceRefIds: [],
    thesisRefs: [],
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}
