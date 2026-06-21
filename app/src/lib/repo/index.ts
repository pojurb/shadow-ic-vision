/**
 * Async repository over Dexie. This is the seam: every UI data access goes through
 * here, so a server/DB-backed implementation can replace it for multi-user later
 * without touching components.
 */
import { getDB } from "./db";
import { personaFor } from "@/lib/ai/personas";
import { normalizeDecisionHistory, deriveStatusFromDecisionHistory } from "@/lib/domain/decisions";
import { normalizeAnalysisEvidence } from "@/lib/domain/evidence";
import { assetTypeForVertical, createDefaultICState, normalizeICState } from "@/lib/domain/ic";
import { emptyManualMeta, normalizeManualMeta } from "@/lib/domain/manualAssets";
import { backfillLegacyStockFields, normalizePersistedStockFields } from "@/lib/domain/stockFields";
import {
  bytesToBase64,
  base64ToBytes,
  buildEnvelope,
  serializeBackup,
  parseBackup,
  type BackupBlob,
} from "./backup";
import type {
  Analysis,
  AnalysisReviewMode,
  AnalysisStatus,
  PortfolioAnalysis,
  PortfolioMember,
  Folder,
  ComputedMetrics,
  DebateResult,
  AdvisoryResult,
  LensResult,
  PersonaRef,
  Stance,
  Vertical,
  AssetParameters,
  AssetType,
  ICState,
  ValuationMode,
} from "@/lib/domain/types";

function uid(): string {
  return crypto.randomUUID();
}

function normalizeReviewMode(value: unknown): AnalysisReviewMode {
  return value === "kickoff" || value === "fact_check" ? value : null;
}

function shouldBackfillLegacyManualKickoff(
  analysis: Pick<Analysis, "valuationMode" | "tags" | "evidence">,
  reviewMode: AnalysisReviewMode,
  hasDecisions: boolean,
): boolean {
  if (reviewMode !== null || hasDecisions || analysis.valuationMode !== "manual") return false;
  if (!analysis.tags.includes("triage")) return false;
  return analysis.evidence.some((item) => item.title === "Imported from Exploration" && item.type === "transcript");
}

// ---- Back-compat ----

/** Old advisory shape persisted before the per-vertical lens migration. */
type LegacyLens = { title?: string; text?: string };
type LegacyAdvisory = { operator: LegacyLens; risk: LegacyLens; predator: LegacyLens };

/**
 * Normalize a persisted analysis to the current shape on read (idempotent). Old
 * records have advisory={operator,risk,predator}, a numeric debate.confidence, and
 * no persona/stance/expertReview. New records pass through untouched. Keeps the
 * Dexie schema unchanged (no version bump) and the UI on a single, current shape.
 */
export function normalizeAnalysis(raw: Analysis): Analysis {
  const a = raw as Analysis & {
    debate: (DebateResult & { confidence?: number }) | null;
    advisory: AdvisoryResult | LegacyAdvisory | null;
    assetType?: AssetType;
    ic?: ICState;
    evidence?: Analysis["evidence"];
    decisionHistory?: Analysis["decisionHistory"];
  };

  // advisory: object {operator,risk,predator} → lens array
  let advisory: AdvisoryResult | null = null;
  if (Array.isArray(a.advisory)) {
    advisory = a.advisory;
  } else if (a.advisory) {
    const legacy = a.advisory as LegacyAdvisory;
    advisory = [
      { id: "operator", name: "Operator", verdict: "—", text: legacy.operator?.text ?? "" },
      { id: "risk", name: "Risk", verdict: "—", text: legacy.risk?.text ?? "" },
      { id: "predator", name: "Predator", verdict: "—", text: legacy.predator?.text ?? "" },
    ] as LensResult[];
  }

  // debate: numeric confidence → discrete thesisSupport
  let debate: DebateResult | null = a.debate;
  if (a.debate && a.debate.thesisSupport === undefined) {
    const c = a.debate.confidence;
    const thesisSupport = c == null ? "MIXED" : c >= 70 ? "STRONG" : c >= 40 ? "MIXED" : "THIN";
    debate = { thesisSupport, bull: a.debate.bull ?? [], bear: a.debate.bear ?? [] };
  }

  // backfill persona identity + engine stance
  const persona: PersonaRef = a.persona ?? (() => {
    if (!a.vertical) return { id: "manual-asset", label: "Manual Asset" };
    const p = personaFor(a.vertical);
    return { id: p.id, label: p.label };
  })();
  let stance: Stance | null = a.stance ?? null;
  if (!stance && a.vertical && a.metrics) {
    const d = personaFor(a.vertical).stance.derive(a.metrics);
    stance = d ? { label: d.label, basis: d.basis } : null;
  }

  const decisionHistory = normalizeDecisionHistory(a.decisionHistory, a.decision);
  const ic = normalizeICState(a.ic);
  const evidence = normalizeAnalysisEvidence(a.evidence, ic.thesis);
  const normalizedStockFields = normalizePersistedStockFields(a.stockFields);
  const stockFields =
    a.vertical === "stocks"
      ? normalizedStockFields.length
        ? normalizedStockFields
        : backfillLegacyStockFields(a.parameters)
      : [];

  const valuationMode: ValuationMode = a.valuationMode === "manual" ? "manual" : "engine";
  const assetType = a.assetType ?? (a.vertical ? assetTypeForVertical(a.vertical) : "other");
  const vertical = valuationMode === "manual" ? null : a.vertical ?? "stocks";
  const metrics = valuationMode === "manual" ? null : a.metrics;
  const manualMeta = normalizeManualMeta(a.manualMeta, assetType);
  const persistedReviewMode = normalizeReviewMode((a as Analysis & { reviewMode?: unknown }).reviewMode);
  const reviewMode = shouldBackfillLegacyManualKickoff(
    {
      valuationMode,
      tags: a.tags ?? [],
      evidence,
    },
    persistedReviewMode,
    decisionHistory.length > 0,
  )
    ? "kickoff"
    : persistedReviewMode;

  return {
    ...a,
    valuationMode,
    vertical,
    assetType,
    manualMeta,
    stockFields,
    ic,
    advisory,
    debate,
    persona,
    stance,
    metrics,
    expertReview: a.expertReview ?? null,
    evidence,
    reviewMode,
    decisionHistory,
    status: deriveStatusFromDecisionHistory(decisionHistory),
  };
}

// ---- Analyses ----

export async function listAnalyses(): Promise<Analysis[]> {
  const all = await getDB().analyses.orderBy("updatedAt").reverse().toArray();
  return all.map(normalizeAnalysis);
}

export async function getAnalysis(id: string): Promise<Analysis | undefined> {
  const a = await getDB().analyses.get(id);
  return a ? normalizeAnalysis(a) : undefined;
}

export async function saveAnalysis(a: Analysis): Promise<Analysis> {
  a.updatedAt = Date.now();
  await getDB().analyses.put(a);
  return a;
}

export async function deleteAnalysis(id: string): Promise<void> {
  await getDB().analyses.delete(id);
}

/** Derived ledger: every analysis with a committed decision, newest first. */
export async function listLedger(): Promise<Analysis[]> {
  const all = await listAnalyses();
  return all.filter((a) => a.decisionHistory.length > 0);
}

/** Factory for a fresh draft analysis. */
export function createAnalysis(input: {
  title: string;
  vertical: Vertical;
  assetName: string;
  parameters: AssetParameters;
  metrics: ComputedMetrics;
  debate?: DebateResult | null;
  advisory?: AdvisoryResult | null;
  persona?: PersonaRef | null;
  stance?: Stance | null;
  folderId?: string | null;
  model: string;
}): Analysis {
  const now = Date.now();
  return {
    id: uid(),
    title: input.title,
    valuationMode: "engine",
    vertical: input.vertical,
    assetType: assetTypeForVertical(input.vertical),
    assetName: input.assetName,
    assetMeta: { currency: "IDR" },
    manualMeta: null,
    stockFields: input.vertical === "stocks" ? [] : undefined,
    tags: [],
    folderId: input.folderId ?? null,
    ic: createDefaultICState(now),
    parameters: input.parameters,
    metrics: input.metrics,
    debate: input.debate ?? null,
    advisory: input.advisory ?? null,
    persona: input.persona ?? null,
    stance: input.stance ?? null,
    expertReview: null,
    sources: [],
    evidence: [],
    allowWebSearch: false,
    reviewMode: null,
    chat: [],
    decision: null,
    decisionHistory: [],
    model: input.model,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function createManualAnalysis(input: {
  title: string;
  assetType: Exclude<AssetType, "public_equity">;
  assetName?: string;
  folderId?: string | null;
  model?: string;
}): Analysis {
  const now = Date.now();
  return {
    id: uid(),
    title: input.title,
    valuationMode: "manual",
    vertical: null,
    assetType: input.assetType,
    assetName: input.assetName ?? "",
    assetMeta: { currency: "IDR" },
    manualMeta: normalizeManualMeta(emptyManualMeta(), input.assetType),
    stockFields: [],
    tags: [],
    folderId: input.folderId ?? null,
    ic: createDefaultICState(now),
    parameters: {},
    metrics: null,
    debate: null,
    advisory: null,
    persona: null,
    stance: null,
    expertReview: null,
    sources: [],
    evidence: [],
    allowWebSearch: false,
    reviewMode: null,
    chat: [],
    decision: null,
    decisionHistory: [],
    model: input.model ?? "manual",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Blobs (attachment bytes) ----

export async function putBlob(blob: Blob): Promise<string> {
  const id = uid();
  await getDB().blobs.put({ id, blob });
  return id;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const rec = await getDB().blobs.get(id);
  return rec?.blob;
}

export async function deleteBlob(id: string): Promise<void> {
  await getDB().blobs.delete(id);
}

// ---- Folders ----

export async function listFolders(): Promise<Folder[]> {
  return getDB().folders.toArray();
}

export async function createFolder(name: string, parentId: string | null = null): Promise<Folder> {
  const folder: Folder = { id: uid(), name, parentId, createdAt: Date.now() };
  await getDB().folders.put(folder);
  return folder;
}

export async function deleteFolder(id: string): Promise<void> {
  await getDB().folders.delete(id);
}

// ---- Portfolios ----

/**
 * Normalize a persisted portfolio to the current shape on read (idempotent). Old
 * records have `memberIds: string[]` (no capital); new records carry
 * `members: PortfolioMember[]`. Legacy ids map to members with capital 0 (the user
 * sets capital later). Mirrors `normalizeAnalysis`; keeps the Dexie schema unchanged.
 */
export function normalizePortfolio(raw: PortfolioAnalysis): PortfolioAnalysis {
  const p = raw as PortfolioAnalysis & { memberIds?: string[]; decisionHistory?: PortfolioAnalysis["decisionHistory"] };
  const hasMembers = Array.isArray(p.members);
  // Analysis-parity fields added with P7b (persona/stance/debate/advisory). The stance
  // is derived only when ANALYZE runs (it needs the member analyses), so a missing one
  // stays null here — no byId is available on read.
  const hasFields =
    p.persona !== undefined &&
    p.stance !== undefined &&
    p.debate !== undefined &&
    p.advisory !== undefined;
  if (hasMembers && hasFields && Array.isArray(p.decisionHistory)) return p; // already current-shape (idempotent)

  const members: PortfolioMember[] = hasMembers
    ? p.members
    : Array.isArray(p.memberIds)
      ? p.memberIds.map((analysisId) => ({ analysisId, capital: 0 }))
      : [];
  const decisionHistory = normalizeDecisionHistory(p.decisionHistory);

  return {
    ...p,
    members,
    persona: p.persona ?? null,
    stance: p.stance ?? null,
    debate: p.debate ?? null,
    advisory: p.advisory ?? null,
    decisionHistory,
  };
}

export async function listPortfolios(): Promise<PortfolioAnalysis[]> {
  const all = await getDB().portfolios.orderBy("updatedAt").reverse().toArray();
  return all.map(normalizePortfolio);
}

export async function getPortfolio(id: string): Promise<PortfolioAnalysis | undefined> {
  const p = await getDB().portfolios.get(id);
  return p ? normalizePortfolio(p) : undefined;
}

export async function savePortfolio(p: PortfolioAnalysis): Promise<PortfolioAnalysis> {
  p.updatedAt = Date.now();
  await getDB().portfolios.put(p);
  return p;
}

export async function deletePortfolio(id: string): Promise<void> {
  await getDB().portfolios.delete(id);
}

export function createPortfolio(title: string, members: PortfolioMember[] = []): PortfolioAnalysis {
  const now = Date.now();
  return {
    id: uid(),
    title,
    members,
    tags: [],
    folderId: null,
    chat: [],
    allowWebSearch: false,
    persona: null,
    stance: null,
    debate: null,
    advisory: null,
    decisionHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Maintenance ----

export interface ImportCounts {
  analyses: number;
  portfolios: number;
  folders: number;
  blobs: number;
}

/**
 * Serialize the ENTIRE workspace (incl. attachment bytes) to a versioned JSON
 * backup string. Blobs are read as raw bytes and carried as base64 with their
 * mime type. API keys / settings are intentionally excluded (secrets).
 */
export async function exportAll(): Promise<string> {
  const db = getDB();
  const [analyses, portfolios, folders, blobRecords] = await Promise.all([
    db.analyses.toArray(),
    db.portfolios.toArray(),
    db.folders.toArray(),
    db.blobs.toArray(),
  ]);
  const blobs: BackupBlob[] = await Promise.all(
    blobRecords.map(async (rec) => ({
      id: rec.id,
      mime: rec.blob.type || "application/octet-stream",
      data: bytesToBase64(new Uint8Array(await rec.blob.arrayBuffer())),
    })),
  );
  return serializeBackup(buildEnvelope({ analyses, portfolios, folders, blobs }));
}

/**
 * Restore a backup. `merge` (default) overwrites by id and keeps everything else;
 * `replace` wipes the four tables first (destructive). Blobs are rebuilt from
 * base64. Returns per-table counts written, for UI feedback.
 */
export async function importAll(json: string, mode: "merge" | "replace" = "merge"): Promise<ImportCounts> {
  const env = parseBackup(json);
  const db = getDB();
  const blobRecords = env.blobs.map((b) => ({
    id: b.id,
    blob: new Blob([base64ToBytes(b.data) as BlobPart], { type: b.mime }),
  }));

  await db.transaction("rw", db.analyses, db.portfolios, db.folders, db.blobs, async () => {
    if (mode === "replace") {
      await Promise.all([db.analyses.clear(), db.portfolios.clear(), db.folders.clear(), db.blobs.clear()]);
    }
    await Promise.all([
      db.analyses.bulkPut(env.analyses),
      db.portfolios.bulkPut(env.portfolios),
      db.folders.bulkPut(env.folders),
      db.blobs.bulkPut(blobRecords),
    ]);
  });

  return {
    analyses: env.analyses.length,
    portfolios: env.portfolios.length,
    folders: env.folders.length,
    blobs: blobRecords.length,
  };
}

export async function setStatus(id: string, status: AnalysisStatus): Promise<void> {
  const a = await getAnalysis(id);
  if (a) {
    a.status = status;
    await saveAnalysis(a);
  }
}
