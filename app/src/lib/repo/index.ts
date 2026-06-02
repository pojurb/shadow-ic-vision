/**
 * Async repository over Dexie. This is the seam: every UI data access goes through
 * here, so a server/DB-backed implementation can replace it for multi-user later
 * without touching components.
 */
import { getDB } from "./db";
import { personaFor } from "@/lib/ai/personas";
import type {
  Analysis,
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
} from "@/lib/domain/types";

function uid(): string {
  return crypto.randomUUID();
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
    const p = personaFor(a.vertical);
    return { id: p.id, label: p.label };
  })();
  let stance: Stance | null = a.stance ?? null;
  if (!stance) {
    const d = personaFor(a.vertical).stance.derive(a.metrics);
    stance = d ? { label: d.label, basis: d.basis } : null;
  }

  return { ...a, advisory, debate, persona, stance, expertReview: a.expertReview ?? null };
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
  return all.filter((a) => a.decision != null);
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
    vertical: input.vertical,
    assetName: input.assetName,
    assetMeta: { currency: "IDR" },
    tags: [],
    folderId: input.folderId ?? null,
    parameters: input.parameters,
    metrics: input.metrics,
    debate: input.debate ?? null,
    advisory: input.advisory ?? null,
    persona: input.persona ?? null,
    stance: input.stance ?? null,
    expertReview: null,
    sources: [],
    allowWebSearch: false,
    chat: [],
    decision: null,
    model: input.model,
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
  const p = raw as PortfolioAnalysis & { memberIds?: string[] };
  if (Array.isArray(p.members)) return p;
  const members: PortfolioMember[] = Array.isArray(p.memberIds)
    ? p.memberIds.map((analysisId) => ({ analysisId, capital: 0 }))
    : [];
  return { ...p, members };
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
    createdAt: now,
    updatedAt: now,
  };
}

// ---- Maintenance ----

export async function exportAll(): Promise<string> {
  const db = getDB();
  const [analyses, portfolios, folders] = await Promise.all([
    db.analyses.toArray(),
    db.portfolios.toArray(),
    db.folders.toArray(),
  ]);
  return JSON.stringify({ version: 1, analyses, portfolios, folders }, null, 2);
}

export async function setStatus(id: string, status: AnalysisStatus): Promise<void> {
  const a = await getAnalysis(id);
  if (a) {
    a.status = status;
    await saveAnalysis(a);
  }
}
