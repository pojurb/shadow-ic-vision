import { describe, it, expect } from "vitest";
import {
  bytesToBase64,
  base64ToBytes,
  buildEnvelope,
  serializeBackup,
  parseBackup,
  type BackupData,
} from "./backup";
import { memberFromPreset } from "@/lib/ai/eval/fixtures";
import type { Analysis } from "@/lib/domain/types";

const EMPTY: BackupData = { analyses: [], portfolios: [], folders: [], blobs: [] };

describe("base64 round-trip", () => {
  it("preserves arbitrary bytes (incl. 0 and 255)", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 254, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("round-trips a large byte run without overflow", () => {
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("handles empty input", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("").length).toBe(0);
  });
});

describe("buildEnvelope / serializeBackup", () => {
  it("stamps app + version + exportedAt and carries the data", () => {
    const env = buildEnvelope(EMPTY);
    expect(env.app).toBe("jp-workspace");
    expect(env.version).toBe(1);
    expect(typeof env.exportedAt).toBe("string");
    expect(env.analyses).toEqual([]);
    expect(env.blobs).toEqual([]);
  });

  it("serializes to JSON that parses back to an equivalent envelope", () => {
    const env = buildEnvelope({ ...EMPTY, blobs: [{ id: "x", mime: "image/png", data: "AAAA" }] });
    const round = parseBackup(serializeBackup(env));
    expect(round.blobs).toEqual([{ id: "x", mime: "image/png", data: "AAAA" }]);
  });
});

describe("parseBackup guards", () => {
  it("rejects non-JSON", () => {
    expect(() => parseBackup("not json")).toThrow(/valid JSON/i);
  });

  it("rejects a foreign file (wrong app)", () => {
    expect(() => parseBackup(JSON.stringify({ app: "other", version: 1 }))).toThrow(/jp-workspace/i);
  });

  it("rejects an unsupported version", () => {
    expect(() => parseBackup(JSON.stringify({ app: "jp-workspace", version: 99 }))).toThrow(/version/i);
  });

  it("drops malformed blob entries", () => {
    const json = JSON.stringify({
      app: "jp-workspace",
      version: 1,
      blobs: [{ id: "ok", mime: "image/png", data: "AA" }, { id: "bad" }, null],
    });
    expect(parseBackup(json).blobs).toEqual([{ id: "ok", mime: "image/png", data: "AA" }]);
  });
});

describe("normalize-on-import", () => {
  it("upgrades a legacy-shaped analysis (no persona/stance) to the current shape", () => {
    const member = memberFromPreset("legacy", "stocks");
    // Strip the P7b-era fields to simulate an older backup record.
    const legacy = { ...member, persona: undefined, stance: undefined } as unknown as Analysis;
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [legacy] });
    const out = parseBackup(json).analyses[0];
    expect(out.persona).not.toBeNull();
    expect(out.persona?.id).toBeTruthy();
    // stance is engine-derived from the locked metrics on read
    expect(out.expertReview).toBeNull();
  });

  it("preserves decision history and reviews on import", () => {
    const member = memberFromPreset("decision-history", "stocks");
    const analysis: Analysis = {
      ...member,
      decisionHistory: [{
        id: "d1",
        decidedAt: 100,
        action: "watch",
        rationale: "Wait for better entry",
        trigger: { dueAt: 200, note: "Review after earnings" },
        snapshot: {
          kind: "analysis",
          data: {
            title: member.title,
            assetType: member.assetType,
            vertical: member.vertical,
            thesis: member.ic.thesis,
            review: member.ic.review,
            metrics: member.metrics,
            stance: member.stance,
            sources: member.sources,
            evidence: member.evidence,
            evidenceCandidates: member.ic.thesis.evidenceCandidates,
            capturedAt: 100,
          },
        },
        review: {
          reviewedAt: 300,
          outcome: "mixed",
          reasoningAssessment: "unclear",
          notes: "Partially played out",
        },
      }],
    };
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [analysis] });
    const out = parseBackup(json).analyses[0];
    expect(out.decisionHistory).toHaveLength(1);
    expect(out.decisionHistory[0].review?.notes).toBe("Partially played out");
    expect(out.decisionHistory[0].snapshot.kind).toBe("analysis");
  });

  it("preserves evidence records and linked source refs on import", () => {
    const member = memberFromPreset("evidence-import", "stocks");
    const analysis: Analysis = {
      ...member,
      sources: [{ id: "src1", kind: "link", url: "https://example.com", createdAt: 1 }],
      evidence: [{
        id: "ev1",
        title: "Evidence source",
        type: "article",
        relation: "supporting",
        reliability: "third_party",
        sourceDate: "2026-01-01",
        url: "https://example.com",
        sourceRefIds: ["src1"],
        thesisRefs: [{ target: "summary", id: null }],
        createdAt: 1,
        updatedAt: 2,
      }],
    };
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [analysis] });
    const out = parseBackup(json).analyses[0];
    expect(out.evidence).toHaveLength(1);
    expect(out.evidence[0].sourceRefIds).toEqual(["src1"]);
    expect(out.evidence[0].thesisRefs).toEqual([{ target: "summary", id: null }]);
  });

  it("round-trips imported exploration transcript evidence unchanged", () => {
    const member = memberFromPreset("triage-import", "stocks");
    const analysis: Analysis = {
      ...member,
      evidence: [{
        id: "ev-triage",
        title: "Imported from Exploration",
        type: "transcript",
        relation: "unresolved",
        reliability: "user_provided",
        sourceDate: null,
        note: "look into BBCA deposit franchise",
        sourceRefIds: [],
        thesisRefs: [],
        createdAt: 1,
        updatedAt: 2,
      }],
    };
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [analysis] });
    const out = parseBackup(json).analyses[0];
    expect(out.evidence).toHaveLength(1);
    expect(out.evidence[0]).toMatchObject({
      title: "Imported from Exploration",
      type: "transcript",
      relation: "unresolved",
      reliability: "user_provided",
      note: "look into BBCA deposit franchise",
    });
  });

  it("normalizes legacy backup candidates into first-class evidence", () => {
    const member = memberFromPreset("legacy-evidence-import", "stocks");
    const legacy: Analysis = {
      ...member,
      evidence: undefined as unknown as Analysis["evidence"],
      ic: {
        ...member.ic,
        thesis: {
          ...member.ic.thesis,
          evidenceCandidates: [{
            id: "candidate-1",
            title: "Legacy candidate",
            type: "filing",
            relation: "supporting",
            reliability: "official",
            createdAt: 1,
          }],
        },
      },
    };
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [legacy] });
    const out = parseBackup(json).analyses[0];
    expect(out.evidence).toHaveLength(1);
    expect(out.evidence[0].id).toBe("candidate-1");
  });

  it("round-trips manual asset metadata on import", () => {
    const manual = {
      ...memberFromPreset("manual-import", "stocks"),
      valuationMode: "manual" as const,
      vertical: null,
      metrics: null,
      assetType: "macro_view" as const,
      manualMeta: {
        valuationAmount: 250_000_000,
        valuationDate: "2026-06-16",
        valuationSource: "Manual mark",
        pricingFreshness: "Monthly",
        liquidity: "Variable",
        expectedDuration: "Tactical",
        portfolioRole: "Hedge",
        sizingIntent: "Pilot",
        macroDependencies: ["rates", "fx"],
        riskNotes: [{ promptId: "macro_rates_fx" as const, note: "Rates and FX dominate." }],
      },
    } as Analysis;
    const json = JSON.stringify({ app: "jp-workspace", version: 1, analyses: [manual] });
    const out = parseBackup(json).analyses[0];
    expect(out.valuationMode).toBe("manual");
    expect(out.vertical).toBeNull();
    expect(out.metrics).toBeNull();
    expect(out.manualMeta?.macroDependencies).toEqual(["rates", "fx"]);
  });
});
