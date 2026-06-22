import { createEvidenceItem } from "./evidence";
import type { AssetType, EvidenceItem, ICState, ThesisMemory } from "./types";

export type TriageMode = "casual" | "broad_screen" | "direct_asset";
export type TriageSource = "deterministic" | "ai" | "unavailable";

export interface TriageCandidate {
  id: string;
  title: string;
  assetName: string;
  assetType: AssetType;
  ticker?: string;
  thesisAngle: string;
  missingEvidence: string[];
  riskLens: string[];
}

export interface ExploreDirection {
  id: string;
  title: string;
  assetName: string;
  assetType: AssetType;
  ticker?: string;
  thesisAngle: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  nextQuestions: string[];
}

export interface ExploreResult {
  summary: string;
  directions: ExploreDirection[];
}

export interface ExploreDeeperResult {
  directionId: string;
  summary: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  evidenceToCheck: string[];
  decisionQuestions: string[];
}

export type FactCheckSuggestionKind = "company" | "ticker" | "note" | "source_prompt";

export interface FactCheckSuggestion {
  label: string;
  seedText: string;
  kind: FactCheckSuggestionKind;
}

export interface FactCheckSuggestionContext {
  assetType: AssetType;
  title?: string;
  assetName?: string;
  ticker?: string;
  sector?: string;
  promptNote?: string;
  thesisSummary?: string;
  openQuestions?: string[];
  direction?: ExploreDirection | null;
  deeperExploration?: ExploreDeeperResult | null;
}

export interface TriageResult {
  mode: TriageMode;
  heading: string;
  summary: string;
  candidates: TriageCandidate[];
  chairNotes: string[];
  requiresDiscovery?: boolean;
  source?: TriageSource;
  exploration?: ExploreResult | null;
  deeperExploration?: ExploreDeeperResult | null;
}

export function buildExplorationCarryForwardEvidence(prompt: string): EvidenceItem | null {
  const note = prompt.trim();
  if (!note) return null;
  return createEvidenceItem({
    title: "Imported from Exploration",
    type: "transcript",
    relation: "unresolved",
    reliability: "user_provided",
    note,
  });
}

function uid(): string {
  return crypto.randomUUID();
}

export function buildExploreSeedThesis(
  direction: ExploreDirection,
  deeperExploration: ExploreDeeperResult | null,
  base: ThesisMemory,
): ThesisMemory {
  const now = Date.now();
  const riskItems = (deeperExploration?.mainRisks.length ? deeperExploration.mainRisks : direction.mainRisks)
    .map((text) => text.trim())
    .filter(Boolean);
  const questionItems = (deeperExploration?.decisionQuestions.length ? deeperExploration.decisionQuestions : direction.nextQuestions)
    .map((text) => text.trim())
    .filter(Boolean);

  return {
    ...base,
    summary: (deeperExploration?.summary || direction.thesisAngle).trim(),
    thesisBreakers: riskItems.map((text) => ({
      id: uid(),
      text,
      severity: "material",
      createdAt: now,
    })),
    openQuestions: questionItems.map((text) => ({
      id: uid(),
      text,
      createdAt: now,
    })),
  };
}

export function seedICStateFromExploration(
  direction: ExploreDirection,
  deeperExploration: ExploreDeeperResult | null,
  base: ICState,
): ICState {
  return {
    ...base,
    thesis: buildExploreSeedThesis(direction, deeperExploration, base.thesis),
  };
}

export function seedICStateFromTriageCandidate(candidate: TriageCandidate, base: ICState): ICState {
  const now = Date.now();
  return {
    ...base,
    thesis: {
      ...base.thesis,
      summary: candidate.thesisAngle.trim(),
      thesisBreakers: candidate.riskLens.map((text) => ({
        id: uid(),
        text,
        severity: "material",
        createdAt: now,
      })),
      openQuestions: candidate.missingEvidence.map((text) => ({
        id: uid(),
        text,
        createdAt: now,
      })),
    },
  };
}

export function buildFactCheckSuggestions(context: FactCheckSuggestionContext): FactCheckSuggestion[] {
  const suggestions: FactCheckSuggestion[] = [];
  const seen = new Set<string>();
  const direction = context.direction ?? null;
  const deeperExploration = context.deeperExploration ?? null;
  const ticker = cleanTicker(context.ticker || direction?.ticker || "");
  const companyName = pickCompanyName(direction?.assetName, context.assetName, context.title);
  const theme = deriveFactCheckTheme(context, companyName, ticker);
  const question = firstNonEmpty(
    deeperExploration?.decisionQuestions,
    deeperExploration?.evidenceToCheck,
    direction?.nextQuestions,
    context.openQuestions,
  );

  function push(label: string, seedText: string, kind: FactCheckSuggestionKind) {
    const cleanLabel = cleanString(label);
    const cleanSeed = cleanString(seedText);
    if (!cleanLabel || !cleanSeed) return;
    const key = cleanSeed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ label: cleanLabel, seedText: cleanSeed, kind });
  }

  if (ticker) {
    push(`Use ticker ${ticker}`, ticker, "ticker");
  }

  if (companyName) {
    push(`Verify ${companyName}`, companyName, "company");
  }

  if (question) {
    push("Start with the next question", `Check this first: ${question}`, "note");
  }

  if (context.assetType === "public_equity") {
    if (theme) {
      push(`Find leaders in ${theme}`, `Find leading public companies in ${theme}`, "source_prompt");
      push("Compare listed options", `Compare 2 listed companies exposed to ${theme}`, "note");
      push("Find one ETF or company", `Identify one ETF or public company tied to ${theme}`, "source_prompt");
    }
    if (ticker || companyName) {
      const target = ticker || companyName!;
      push("Ground the basics first", `Verify ${target}: business model, latest price, and current valuation.`, "note");
    }
  } else if (theme) {
    push("Define the exact target", `Define the exact business or asset to verify for ${theme}.`, "note");
    push("List the first facts to confirm", `List the first 3 facts to confirm about ${theme}: customers, unit economics, and risks.`, "note");
    push("Bring one source or note", `Paste one source, memo, or note about ${theme} so this review can start grounding it.`, "source_prompt");
  } else {
    push("Define the exact target", "Define the exact business or asset to verify first.", "note");
    push("List the first facts to confirm", "List the first 3 facts to confirm: customers, economics, and risks.", "note");
    push("Bring one source or note", "Paste one source, memo, or note so this review can start grounding it.", "source_prompt");
  }

  return suggestions.slice(0, 5);
}

const ASSET_TYPES: AssetType[] = [
  "public_equity",
  "conventional_business",
  "startup",
  "real_estate",
  "crypto",
  "macro_view",
  "other",
];

export function deriveIdeaTriage(prompt: string): TriageResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  if (!text || isCasual(lower)) {
    return {
      mode: "casual",
      heading: "IC Chair triage",
      summary: "Nothing saved yet. Ask about an opportunity set, name an asset, or paste a thesis note when you want to start exploring.",
      candidates: [],
      chairNotes: [
        "Broad questions stay temporary until you explicitly save a review.",
        "Saved reviews are only created when you choose Start review or Save to watchlist.",
      ],
      source: "deterministic",
      exploration: null,
      deeperExploration: null,
    };
  }

  const directTicker = extractDirectTicker(text);
  if (directTicker) {
    return {
      mode: "direct_asset",
      heading: `Start a review for ${directTicker}?`,
      summary: "This looks like a concrete asset request. Start a review when you want note capture, evidence, and fact checking to begin.",
      candidates: [
        {
          id: `direct-${directTicker.toLowerCase()}`,
          title: `${directTicker} review`,
          assetName: directTicker,
          assetType: "public_equity",
          ticker: directTicker,
          thesisAngle: "Single-name review setup: verify the asset, collect cited facts, and build your working view before you make a decision.",
          missingEvidence: ["Company/source identity", "Cited price", "Cited fundamentals"],
          riskLens: ["Wrong ticker/source match", "Uncited valuation inputs", "Thesis not yet explicit"],
        },
      ],
      chairNotes: ["Starting a review will open a saved draft. Until then, this exploration stays temporary."],
      source: "deterministic",
      exploration: null,
      deeperExploration: null,
    };
  }

  return {
    mode: "broad_screen",
    heading: "Explore this idea before you save it",
    summary: "This is a broad discovery prompt. AI should help you think through possible directions before anything becomes a saved review.",
    candidates: [],
    chairNotes: [
      "Discovery stays temporary in this sandbox.",
      "Your first direction pick should deepen the reasoning, not create a saved review.",
    ],
    requiresDiscovery: true,
    source: "deterministic",
    exploration: null,
    deeperExploration: null,
  };
}

function isCasual(lower: string): boolean {
  return /^(hi|hello|hey|halo|hai)(\s+there)?[.!?\s]*$/.test(lower) ||
    /^(test|testing|thanks|thank you|ok|okay)[.!?\s]*$/.test(lower);
}

function extractDirectTicker(text: string): string | null {
  const explicit = text.match(/\b(?:analy[sz]e|evaluasi|review|research|dig into|start case|case for)\s+([A-Za-z]{4})(?:\.(?:JK|IDX))?\b/i)?.[1];
  if (explicit) return explicit.toUpperCase();

  const ticker = text.match(/\b(?:ticker|kode|symbol)\s*[:=]?\s*([A-Za-z]{4})(?:\.(?:JK|IDX))?\b/i)?.[1];
  return ticker ? ticker.toUpperCase() : null;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean).slice(0, limit);
}

function cleanAssetType(value: unknown): AssetType {
  return ASSET_TYPES.includes(value as AssetType) ? (value as AssetType) : "other";
}

function stableDirectionId(direction: Pick<ExploreDirection, "assetName" | "title" | "assetType">, index: number): string {
  const raw = `${direction.assetType}-${direction.assetName || direction.title || index}`;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `ai-${slug || index + 1}`;
}

function firstNonEmpty(...lists: Array<string[] | undefined | null>): string {
  for (const list of lists) {
    const item = list?.map((value) => cleanString(value)).find(Boolean);
    if (item) return item;
  }
  return "";
}

function cleanTicker(value: string): string {
  const ticker = cleanString(value).replace(/\.(?:JK|IDX)$/i, "").toUpperCase();
  return /^[A-Z]{2,5}$/.test(ticker) ? ticker : "";
}

function pickCompanyName(...values: Array<string | undefined>): string {
  for (const value of values) {
    const name = cleanString(value);
    if (!name) continue;
    if (/^[A-Z]{2,5}$/.test(name)) continue;
    if (looksLikeBroadTheme(name)) continue;
    return name;
  }
  return "";
}

function deriveFactCheckTheme(context: FactCheckSuggestionContext, companyName: string, ticker: string): string {
  const candidates = [
    context.sector,
    context.direction?.title,
    context.direction?.assetName,
    context.assetName,
    context.title,
    context.promptNote,
    context.thesisSummary,
  ];

  for (const candidate of candidates) {
    const theme = normalizeFactCheckTheme(candidate ?? "", companyName, ticker);
    if (theme) return theme;
  }

  return "";
}

function normalizeFactCheckTheme(value: string, companyName: string, ticker: string): string {
  const text = cleanString(value)
    .replace(/\s+/g, " ")
    .replace(/\breview\b/gi, "")
    .replace(/\bidea\b/gi, "")
    .replace(/\bwatchlist\b/gi, "")
    .trim()
    .replace(/^[-:,]+|[-:,]+$/g, "")
    .trim();

  if (!text) return "";
  if (ticker && text.toUpperCase() === ticker) return "";
  if (companyName && text.toLowerCase() === companyName.toLowerCase()) return "";
  return text.length > 90 ? `${text.slice(0, 87).trim()}...` : text;
}

function looksLikeBroadTheme(value: string): boolean {
  const lower = value.toLowerCase();
  return /\b(ideas|theme|themes|review|industry|sector|market|companies|stocks|etf)\b/.test(lower) ||
    /\bfor\b/.test(lower) ||
    /( business| infrastructure| platforms?| storage| computing)$/.test(lower);
}

export function inspectIdeaDiscoveryOutput(raw: unknown): ExploreResult | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const summary = cleanString(input.summary);
  const rawDirections = Array.isArray(input.directions) ? input.directions : [];
  const directions: ExploreDirection[] = [];

  for (const item of rawDirections) {
    if (!item || typeof item !== "object") continue;
    const direction = item as Record<string, unknown>;
    const title = cleanString(direction.title);
    const assetName = cleanString(direction.assetName);
    const thesisAngle = cleanString(direction.thesisAngle);
    const whyItCouldWork = cleanStringList(direction.whyItCouldWork);
    const mainRisks = cleanStringList(direction.mainRisks);
    const nextQuestions = cleanStringList(direction.nextQuestions);
    if (!title || !assetName || !thesisAngle || whyItCouldWork.length === 0 || mainRisks.length === 0 || nextQuestions.length === 0) continue;
    const assetType = cleanAssetType(direction.assetType);
    const ticker = cleanString(direction.ticker).toUpperCase();
    directions.push({
      id: stableDirectionId({ title, assetName, assetType }, directions.length),
      title,
      assetName,
      assetType,
      ...(ticker ? { ticker } : {}),
      thesisAngle,
      whyItCouldWork,
      mainRisks,
      nextQuestions,
    });
    if (directions.length >= 4) break;
  }

  if (!summary || directions.length < 2) return null;
  return { summary, directions };
}

export function inspectDeeperIdeaDiscoveryOutput(raw: unknown, directionId: string): ExploreDeeperResult | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const summary = cleanString(input.summary);
  const whyItCouldWork = cleanStringList(input.whyItCouldWork);
  const mainRisks = cleanStringList(input.mainRisks);
  const evidenceToCheck = cleanStringList(input.evidenceToCheck);
  const decisionQuestions = cleanStringList(input.decisionQuestions);
  if (!summary || whyItCouldWork.length === 0 || mainRisks.length === 0 || evidenceToCheck.length === 0 || decisionQuestions.length === 0) return null;
  return {
    directionId,
    summary,
    whyItCouldWork,
    mainRisks,
    evidenceToCheck,
    decisionQuestions,
  };
}
