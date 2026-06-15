import { BLANK_PARAMS, type AssetParameters } from "@/data/presets";
import { FIELDS } from "@/data/fields";
import type {
  StockFieldConfidence,
  StockFieldProvenance,
  StockFieldRecord,
  StockFieldSourceKind,
  StockFieldValueType,
} from "@/lib/domain/types";

const STOCK_KEYS = new Set(FIELDS.stocks.map((field) => String(field.key)));

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeStockFieldValueType(value: unknown): StockFieldValueType {
  const clean = cleanString(value);
  switch (clean) {
    case "current":
    case "delayed":
    case "ttm":
    case "annual":
    case "estimated":
    case "user_provided":
    case "derived":
    case "legacy_unknown":
      return clean;
    default:
      return "current";
  }
}

export function normalizeStockFieldConfidence(value: unknown): StockFieldConfidence {
  const clean = cleanString(value);
  switch (clean) {
    case "high":
    case "medium":
    case "low":
    case "needs_review":
    case "legacy_unknown":
      return clean;
    default:
      return "needs_review";
  }
}

export function normalizeStockFieldSourceKind(value: unknown): StockFieldSourceKind {
  const clean = cleanString(value);
  switch (clean) {
    case "official":
    case "third_party":
    case "user_provided":
    case "derived":
    case "legacy_unknown":
      return clean;
    default:
      return "third_party";
  }
}

export function normalizeStockFieldProvenance(raw: unknown): StockFieldProvenance | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = cleanString(record.title);
  const url = cleanString(record.url);
  const asOf = cleanString(record.asOf);
  const valueType = normalizeStockFieldValueType(record.valueType);
  const confidence = normalizeStockFieldConfidence(record.confidence);
  const sourceKind = normalizeStockFieldSourceKind(record.sourceKind);
  if (!title && !url && !asOf) return null;
  return { title, url, asOf, valueType, confidence, sourceKind };
}

export function hasCompleteStockProvenance(provenance: StockFieldProvenance | null | undefined): boolean {
  if (!provenance) return false;
  return Boolean(provenance.title && provenance.url && provenance.asOf && provenance.valueType && provenance.confidence);
}

export function isLockableStockConfidence(confidence: StockFieldConfidence): boolean {
  return confidence === "high" || confidence === "medium";
}

export function stockFieldLockNote(provenance: StockFieldProvenance | null | undefined): string | undefined {
  if (!provenance) return "Missing source title, URL, period/timestamp, value type, and confidence.";
  const missing: string[] = [];
  if (!provenance.title) missing.push("source title");
  if (!provenance.url) missing.push("source URL");
  if (!provenance.asOf) missing.push("period/timestamp");
  if (!provenance.valueType) missing.push("value type");
  if (!provenance.confidence) missing.push("confidence");
  if (!missing.length && !isLockableStockConfidence(provenance.confidence)) missing.push("lockable confidence");
  return missing.length ? `Needs ${missing.join(", ")}.` : undefined;
}

export function buildUserProvidedStockProvenance(now = Date.now()): StockFieldProvenance {
  return {
    title: "User-provided value",
    url: "",
    asOf: now > 0 ? new Date(now).toISOString() : "",
    valueType: "user_provided",
    confidence: "high",
    sourceKind: "user_provided",
  };
}

export function buildDerivedStockProvenance(now = Date.now()): StockFieldProvenance {
  return {
    title: "Derived from confirmed stock input",
    url: "",
    asOf: now > 0 ? new Date(now).toISOString() : "",
    valueType: "derived",
    confidence: "medium",
    sourceKind: "derived",
  };
}

export function normalizePersistedStockFields(raw: unknown): StockFieldRecord[] {
  if (!Array.isArray(raw)) return [];
  const fields: StockFieldRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const key = cleanString(record.key);
    const value = Number(record.value);
    if (!key || !STOCK_KEYS.has(key) || !Number.isFinite(value)) continue;
    const source = record.source === "stated" ? "stated" : "inferred";
    const origin =
      record.origin === "user_fact" ||
      record.origin === "sourced_fact" ||
      record.origin === "candidate" ||
      record.origin === "derived_candidate" ||
      record.origin === "default_assumption" ||
      record.origin === "legacy_unverified"
        ? record.origin
        : "candidate";
    const provenance = normalizeStockFieldProvenance(record.provenance);
    const note = cleanString(record.note);
    fields.push({
      key,
      value,
      source,
      origin,
      lockable: Boolean(record.lockable),
      provenance,
      ...(note ? { note } : {}),
    });
  }
  return fields;
}

export function backfillLegacyStockFields(parameters?: AssetParameters): StockFieldRecord[] {
  if (!parameters) return [];
  const legacy: StockFieldRecord[] = [];
  for (const field of FIELDS.stocks) {
    const key = String(field.key);
    const value = Number(parameters[field.key] ?? Number.NaN);
    const baseline = Number(BLANK_PARAMS.stocks[field.key] ?? Number.NaN);
    if (!Number.isFinite(value)) continue;
    if (Number.isFinite(baseline) && value === baseline) continue;
    legacy.push({
      key,
      value,
      source: "inferred",
      origin: "legacy_unverified",
      lockable: false,
      provenance: {
        title: "Legacy saved stock figure",
        url: "",
        asOf: "",
        valueType: "legacy_unknown",
        confidence: "legacy_unknown",
        sourceKind: "legacy_unknown",
      },
      note: "Saved before field-level provenance existed.",
    });
  }
  return legacy;
}
