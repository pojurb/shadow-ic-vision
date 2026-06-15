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
});
