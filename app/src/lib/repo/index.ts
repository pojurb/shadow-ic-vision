/**
 * Async repository over Dexie. This is the seam: every UI data access goes through
 * here, so a server/DB-backed implementation can replace it for multi-user later
 * without touching components.
 */
import { getDB } from "./db";
import type {
  Analysis,
  AnalysisStatus,
  PortfolioAnalysis,
  Folder,
  ComputedMetrics,
  Vertical,
  AssetParameters,
} from "@/lib/domain/types";

function uid(): string {
  return crypto.randomUUID();
}

// ---- Analyses ----

export async function listAnalyses(): Promise<Analysis[]> {
  return getDB().analyses.orderBy("updatedAt").reverse().toArray();
}

export async function getAnalysis(id: string): Promise<Analysis | undefined> {
  return getDB().analyses.get(id);
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
    folderId: null,
    parameters: input.parameters,
    metrics: input.metrics,
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

export async function listPortfolios(): Promise<PortfolioAnalysis[]> {
  return getDB().portfolios.orderBy("updatedAt").reverse().toArray();
}

export async function getPortfolio(id: string): Promise<PortfolioAnalysis | undefined> {
  return getDB().portfolios.get(id);
}

export async function savePortfolio(p: PortfolioAnalysis): Promise<PortfolioAnalysis> {
  p.updatedAt = Date.now();
  await getDB().portfolios.put(p);
  return p;
}

export async function deletePortfolio(id: string): Promise<void> {
  await getDB().portfolios.delete(id);
}

export function createPortfolio(title: string, memberIds: string[] = []): PortfolioAnalysis {
  const now = Date.now();
  return {
    id: uid(),
    title,
    memberIds,
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
