import type {
  ContextSource,
  EvidenceCandidate,
  EvidenceItem,
  EvidenceRelation,
  EvidenceReliability,
  EvidenceType,
  ThesisMemory,
  ThesisRef,
  ThesisRefTarget,
} from "@/lib/domain/types";

const EVIDENCE_TYPES: EvidenceType[] = [
  "filing",
  "article",
  "note",
  "transcript",
  "market_data",
  "pitch_deck",
  "memo",
  "screenshot",
  "pdf",
  "deal_document",
  "other",
];
const RELATIONS: EvidenceRelation[] = ["supporting", "contradictory", "neutral", "unresolved"];
const RELIABILITIES: EvidenceReliability[] = ["official", "third_party", "user_provided", "unknown"];
const REF_TARGETS: ThesisRefTarget[] = [
  "summary",
  "assumption",
  "breaker",
  "watch_item",
  "valuation_assumption",
  "catalyst",
  "open_question",
];

export function evidenceId(prefix = "ev"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | undefined {
  const text = asString(value);
  return text ? text : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeEvidenceType(value: unknown): EvidenceType {
  return EVIDENCE_TYPES.includes(value as EvidenceType) ? (value as EvidenceType) : "other";
}

export function normalizeEvidenceRelation(value: unknown): EvidenceRelation {
  return RELATIONS.includes(value as EvidenceRelation) ? (value as EvidenceRelation) : "unresolved";
}

export function normalizeEvidenceReliability(value: unknown): EvidenceReliability {
  return RELIABILITIES.includes(value as EvidenceReliability) ? (value as EvidenceReliability) : "unknown";
}

export function isValidEvidenceUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceDate(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function normalizeRefs(raw: unknown): ThesisRef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const refs: ThesisRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const ref = item as Partial<ThesisRef>;
    if (!REF_TARGETS.includes(ref.target as ThesisRefTarget)) continue;
    const id = ref.target === "summary" ? null : typeof ref.id === "string" && ref.id ? ref.id : null;
    if (ref.target !== "summary" && !id) continue;
    const key = `${ref.target}:${id ?? "summary"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ target: ref.target as ThesisRefTarget, id });
  }
  return refs;
}

function normalizeSourceRefIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean))];
}

export function createEvidenceItem(input: {
  title: string;
  type?: EvidenceType;
  relation?: EvidenceRelation;
  reliability?: EvidenceReliability;
  sourceDate?: string | null;
  url?: string;
  note?: string;
  sourceRefIds?: string[];
  thesisRefs?: ThesisRef[];
  now?: number;
}): EvidenceItem {
  const now = input.now ?? Date.now();
  return {
    id: evidenceId(),
    title: input.title.trim(),
    type: input.type ?? (input.url ? "article" : "note"),
    relation: input.relation ?? "unresolved",
    reliability: input.reliability ?? "user_provided",
    sourceDate: input.sourceDate?.trim() || null,
    ...(input.url?.trim() ? { url: input.url.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    sourceRefIds: normalizeSourceRefIds(input.sourceRefIds),
    thesisRefs: normalizeRefs(input.thesisRefs),
    createdAt: now,
    updatedAt: now,
  };
}

export function promoteEvidenceCandidate(candidate: EvidenceCandidate, now = Date.now()): EvidenceItem {
  return {
    id: candidate.id || evidenceId(),
    title: candidate.title.trim(),
    type: normalizeEvidenceType(candidate.type),
    relation: normalizeEvidenceRelation(candidate.relation),
    reliability: normalizeEvidenceReliability(candidate.reliability),
    sourceDate: null,
    ...(candidate.url?.trim() ? { url: candidate.url.trim() } : {}),
    ...(candidate.note?.trim() ? { note: candidate.note.trim() } : {}),
    sourceRefIds: [],
    thesisRefs: [],
    createdAt: asNumber(candidate.createdAt, now),
    updatedAt: now,
  };
}

export function normalizeEvidenceItem(raw: unknown, now = Date.now()): EvidenceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<EvidenceItem>;
  const title = asString(item.title);
  if (!title) return null;
  const createdAt = asNumber(item.createdAt, now);
  const url = optionalString(item.url);
  return {
    id: asString(item.id) || evidenceId(),
    title,
    type: normalizeEvidenceType(item.type),
    relation: normalizeEvidenceRelation(item.relation),
    reliability: normalizeEvidenceReliability(item.reliability),
    sourceDate: normalizeSourceDate(item.sourceDate),
    ...(url ? { url } : {}),
    ...(optionalString(item.note) ? { note: optionalString(item.note) } : {}),
    sourceRefIds: normalizeSourceRefIds(item.sourceRefIds),
    thesisRefs: normalizeRefs(item.thesisRefs),
    createdAt,
    updatedAt: asNumber(item.updatedAt, createdAt),
  };
}

function dedupeKey(item: EvidenceItem): string {
  const url = item.url?.trim().toLowerCase();
  if (url) return `url:${url}`;
  return `title:${item.title.trim().toLowerCase()}`;
}

export function dedupeEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  const out: EvidenceItem[] = [];
  for (const item of items) {
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function normalizeAnalysisEvidence(rawEvidence: unknown, thesis: ThesisMemory, now = Date.now()): EvidenceItem[] {
  const persisted = Array.isArray(rawEvidence)
    ? rawEvidence.map((item) => normalizeEvidenceItem(item, now)).filter((item): item is EvidenceItem => Boolean(item))
    : [];
  const promoted = (Array.isArray(thesis.evidenceCandidates) ? thesis.evidenceCandidates : [])
    .filter((candidate) => candidate?.title?.trim())
    .map((candidate) => promoteEvidenceCandidate(candidate, now));
  return dedupeEvidence([...persisted, ...promoted]);
}

export function linkEvidenceSource(item: EvidenceItem, sourceId: string, now = Date.now()): EvidenceItem {
  const id = sourceId.trim();
  if (!id || item.sourceRefIds.includes(id)) return item;
  return { ...item, sourceRefIds: [...item.sourceRefIds, id], updatedAt: now };
}

export function unlinkEvidenceSource(item: EvidenceItem, sourceId: string, now = Date.now()): EvidenceItem {
  const next = item.sourceRefIds.filter((id) => id !== sourceId);
  return next.length === item.sourceRefIds.length ? item : { ...item, sourceRefIds: next, updatedAt: now };
}

export function groupEvidenceByRelation(items: EvidenceItem[]): Record<EvidenceRelation, EvidenceItem[]> {
  return {
    supporting: items.filter((item) => item.relation === "supporting"),
    contradictory: items.filter((item) => item.relation === "contradictory"),
    neutral: items.filter((item) => item.relation === "neutral"),
    unresolved: items.filter((item) => item.relation === "unresolved"),
  };
}

export function filterEvidence(items: EvidenceItem[], filters: { relation?: EvidenceRelation | "all"; type?: EvidenceType | "all" }): EvidenceItem[] {
  return items.filter((item) => {
    if (filters.relation && filters.relation !== "all" && item.relation !== filters.relation) return false;
    if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
    return true;
  });
}

export function formatSourceRefLabel(sourceId: string, sources: ContextSource[]): string {
  const source = sources.find((item) => item.id === sourceId);
  if (!source) return `Missing source: ${sourceId}`;
  return source.kind === "file" ? source.name : source.title || source.url;
}

export function formatThesisRefLabel(ref: ThesisRef, thesis: ThesisMemory): string {
  if (ref.target === "summary") return thesis.summary ? "Summary" : "Summary (empty)";
  const byId = {
    assumption: thesis.assumptions,
    breaker: thesis.thesisBreakers,
    watch_item: thesis.watchItems,
    valuation_assumption: thesis.valuationAssumptions,
    catalyst: thesis.catalysts,
    open_question: thesis.openQuestions,
  }[ref.target];
  const item = byId.find((entry) => entry.id === ref.id);
  const label = ref.target.replace(/_/g, " ");
  return item ? `${label}: ${item.text}` : `Missing ${label}: ${ref.id ?? "unknown"}`;
}

export function thesisRefOptions(thesis: ThesisMemory): Array<{ ref: ThesisRef; label: string }> {
  const options: Array<{ ref: ThesisRef; label: string }> = [];
  if (thesis.summary.trim()) options.push({ ref: { target: "summary", id: null }, label: "Summary" });
  thesis.assumptions.forEach((item) => options.push({ ref: { target: "assumption", id: item.id }, label: `Assumption: ${item.text}` }));
  thesis.thesisBreakers.forEach((item) => options.push({ ref: { target: "breaker", id: item.id }, label: `Breaker: ${item.text}` }));
  thesis.watchItems.forEach((item) => options.push({ ref: { target: "watch_item", id: item.id }, label: `Watch item: ${item.text}` }));
  thesis.valuationAssumptions.forEach((item) => options.push({ ref: { target: "valuation_assumption", id: item.id }, label: `Valuation: ${item.text}` }));
  thesis.catalysts.forEach((item) => options.push({ ref: { target: "catalyst", id: item.id }, label: `Catalyst: ${item.text}` }));
  thesis.openQuestions.forEach((item) => options.push({ ref: { target: "open_question", id: item.id }, label: `Question: ${item.text}` }));
  return options;
}
