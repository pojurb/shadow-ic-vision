/**
 * Pure, environment-agnostic backup core. No Dexie, no FileReader — just data
 * shaping + base64 — so it is fully unit-testable in node and reusable in the
 * browser. The thin DB layer (`repo/index.ts`) reads/writes the tables and calls
 * these helpers to (de)serialize a faithful, versioned workspace envelope.
 *
 * Scope of a backup is workspace DATA only — analyses, portfolios, folders, and
 * attachment bytes (blobs). API keys / provider settings are deliberately NOT
 * included: they are secrets that must never travel in an exported/shared file.
 */
import type { Analysis, PortfolioAnalysis, Folder } from "@/lib/domain/types";
import { normalizeAnalysis, normalizePortfolio } from "./index";

/** A single attachment, bytes carried as base64 with its mime type. */
export interface BackupBlob {
  id: string;
  mime: string;
  data: string; // base64
}

/** The on-disk backup format. `app`/`version` guard against foreign/old files. */
export interface BackupEnvelope {
  app: "jp-workspace";
  version: 1;
  exportedAt: string;
  analyses: Analysis[];
  portfolios: PortfolioAnalysis[];
  folders: Folder[];
  blobs: BackupBlob[];
}

export interface BackupData {
  analyses: Analysis[];
  portfolios: PortfolioAnalysis[];
  folders: Folder[];
  blobs: BackupBlob[];
}

// ---- base64 (browser + node; avoids browser-only FileReader) ----

/** Encode raw bytes to a base64 string. Chunked to avoid arg-count overflow. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/** Decode a base64 string back to raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---- envelope ----

export function buildEnvelope(data: BackupData): BackupEnvelope {
  return {
    app: "jp-workspace",
    version: 1,
    exportedAt: new Date().toISOString(),
    analyses: data.analyses,
    portfolios: data.portfolios,
    folders: data.folders,
    blobs: data.blobs,
  };
}

export function serializeBackup(env: BackupEnvelope): string {
  return JSON.stringify(env, null, 2);
}

/**
 * Parse + validate a backup file. Throws a clear error on a bad/foreign file.
 * Records are run through the same normalizers as a DB read so a legacy-shaped
 * backup upgrades to the current shape on import.
 */
export function parseBackup(json: string): BackupEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not a valid JSON file.");
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a valid backup file.");
  }
  const env = raw as Partial<BackupEnvelope>;
  if (env.app !== "jp-workspace") {
    throw new Error("This file is not a jp-workspace backup.");
  }
  if (env.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(env.version)}.`);
  }

  const analyses = Array.isArray(env.analyses) ? env.analyses.map(normalizeAnalysis) : [];
  const portfolios = Array.isArray(env.portfolios) ? env.portfolios.map(normalizePortfolio) : [];
  const folders = Array.isArray(env.folders) ? env.folders : [];
  const blobs = Array.isArray(env.blobs)
    ? env.blobs.filter(
        (b): b is BackupBlob =>
          !!b && typeof b.id === "string" && typeof b.mime === "string" && typeof b.data === "string",
      )
    : [];

  return {
    app: "jp-workspace",
    version: 1,
    exportedAt: typeof env.exportedAt === "string" ? env.exportedAt : new Date().toISOString(),
    analyses,
    portfolios,
    folders,
    blobs,
  };
}
