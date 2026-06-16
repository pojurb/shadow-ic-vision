import type {
  Analysis,
  AnalysisManualMeta,
  AssetType,
  ComputedMetrics,
  ManualRiskNote,
  ManualRiskPromptId,
  Vertical,
} from "@/lib/domain/types";

export interface ManualRiskPrompt {
  id: ManualRiskPromptId;
  label: string;
}

const SHARED_PROMPTS: ManualRiskPrompt[] = [
  { id: "illiquidity_exit", label: "Illiquidity and exit path" },
  { id: "valuation_quality", label: "Valuation quality and source freshness" },
  { id: "concentration", label: "Concentration risk" },
  { id: "key_person", label: "Key-person or operator dependency" },
  { id: "balance_sheet_burn", label: "Balance-sheet or burn risk" },
  { id: "legal_regulatory", label: "Legal or regulatory risk" },
  { id: "macro_exposure", label: "Macro exposure" },
];

const PROMPTS_BY_ASSET_TYPE: Partial<Record<AssetType, ManualRiskPrompt[]>> = {
  startup: [{ id: "startup_dilution_funding", label: "Dilution, cap-table, and funding risk" }],
  real_estate: [
    { id: "real_estate_vacancy_tenant", label: "Vacancy, tenant, and location risk" },
    { id: "real_estate_leverage_refinancing", label: "Leverage and refinancing risk" },
  ],
  crypto: [
    { id: "crypto_custody", label: "Custody risk" },
    { id: "crypto_protocol", label: "Protocol risk" },
    { id: "crypto_liquidity", label: "Liquidity risk" },
    { id: "crypto_regulatory", label: "Regulatory risk" },
    { id: "crypto_smart_contract", label: "Smart-contract risk" },
  ],
  macro_view: [
    { id: "macro_rates_fx", label: "Rates and FX risk" },
    { id: "macro_hidden_correlation", label: "Hidden-correlation risk" },
  ],
};

export function isManualAssetType(assetType: AssetType): boolean {
  return assetType !== "public_equity";
}

export function manualRiskPromptsForAssetType(assetType: AssetType): ManualRiskPrompt[] {
  return [...SHARED_PROMPTS, ...(PROMPTS_BY_ASSET_TYPE[assetType] ?? [])];
}

export function emptyManualMeta(): AnalysisManualMeta {
  return {
    valuationAmount: null,
    valuationDate: "",
    valuationSource: "",
    pricingFreshness: "",
    liquidity: "",
    expectedDuration: "",
    portfolioRole: "",
    sizingIntent: "",
    macroDependencies: [],
    riskNotes: [],
  };
}

export function normalizeManualRiskNotes(notes: ManualRiskNote[] | undefined, assetType: AssetType): ManualRiskNote[] {
  const allowed = new Set(manualRiskPromptsForAssetType(assetType).map((prompt) => prompt.id));
  const normalized = Array.isArray(notes)
    ? notes
        .filter((note): note is ManualRiskNote => !!note && typeof note === "object" && allowed.has(note.promptId))
        .map((note) => ({ promptId: note.promptId, note: typeof note.note === "string" ? note.note : "" }))
    : [];

  const existing = new Map(normalized.map((note) => [note.promptId, note]));
  return manualRiskPromptsForAssetType(assetType).map((prompt) => existing.get(prompt.id) ?? { promptId: prompt.id, note: "" });
}

export function normalizeManualMeta(raw: AnalysisManualMeta | null | undefined, assetType: AssetType): AnalysisManualMeta | null {
  if (!isManualAssetType(assetType) && raw == null) return null;
  const base = emptyManualMeta();
  return {
    valuationAmount: typeof raw?.valuationAmount === "number" && Number.isFinite(raw.valuationAmount) ? raw.valuationAmount : null,
    valuationDate: typeof raw?.valuationDate === "string" ? raw.valuationDate : "",
    valuationSource: typeof raw?.valuationSource === "string" ? raw.valuationSource : "",
    pricingFreshness: typeof raw?.pricingFreshness === "string" ? raw.pricingFreshness : "",
    liquidity: typeof raw?.liquidity === "string" ? raw.liquidity : "",
    expectedDuration: typeof raw?.expectedDuration === "string" ? raw.expectedDuration : "",
    portfolioRole: typeof raw?.portfolioRole === "string" ? raw.portfolioRole : "",
    sizingIntent: typeof raw?.sizingIntent === "string" ? raw.sizingIntent : "",
    macroDependencies: Array.isArray(raw?.macroDependencies)
      ? raw.macroDependencies.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : base.macroDependencies,
    riskNotes: normalizeManualRiskNotes(raw?.riskNotes, assetType),
  };
}

export function isEngineAnalysis(
  analysis: Analysis,
): analysis is Analysis & { valuationMode: "engine"; vertical: Vertical; metrics: ComputedMetrics } {
  return analysis.valuationMode === "engine" && analysis.vertical != null && analysis.metrics != null;
}
