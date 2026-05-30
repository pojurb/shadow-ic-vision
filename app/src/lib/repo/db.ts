/**
 * Dexie (IndexedDB) database for the local-first workspace.
 * Browser-only: instantiated lazily so it is never touched during SSR.
 */
import Dexie, { type Table } from "dexie";
import type { Analysis, PortfolioAnalysis, Folder } from "@/lib/domain/types";

export interface BlobRecord {
  id: string;
  blob: Blob;
}

export class WorkspaceDB extends Dexie {
  analyses!: Table<Analysis, string>;
  portfolios!: Table<PortfolioAnalysis, string>;
  folders!: Table<Folder, string>;
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super("jp-workspace");
    this.version(1).stores({
      analyses: "id, updatedAt, vertical, folderId, status, *tags",
      portfolios: "id, updatedAt, folderId, *tags",
      folders: "id, parentId",
      blobs: "id",
    });
  }
}

let instance: WorkspaceDB | null = null;

export function getDB(): WorkspaceDB {
  if (typeof window === "undefined") {
    throw new Error("WorkspaceDB is browser-only and cannot be used during SSR.");
  }
  if (!instance) instance = new WorkspaceDB();
  return instance;
}
