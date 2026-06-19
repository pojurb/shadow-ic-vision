import type { AssetType } from "./types";

export type TriageMode = "casual" | "broad_screen" | "direct_asset";

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

export interface TriageResult {
  mode: TriageMode;
  heading: string;
  summary: string;
  candidates: TriageCandidate[];
  chairNotes: string[];
}

const IDX_CANDIDATES: TriageCandidate[] = [
  {
    id: "idx-bbca",
    title: "BBCA case candidate",
    assetName: "BBCA",
    assetType: "public_equity",
    ticker: "BBCA",
    thesisAngle: "Quality bank screen: deposit franchise, fee income durability, and valuation discipline.",
    missingEvidence: ["Latest quarterly financials", "Deposit-cost trend", "Current valuation versus history"],
    riskLens: ["Premium multiple risk", "NIM compression", "Credit-cycle sensitivity"],
  },
  {
    id: "idx-bbri",
    title: "BBRI case candidate",
    assetName: "BBRI",
    assetType: "public_equity",
    ticker: "BBRI",
    thesisAngle: "Micro-lending compounder screen: loan growth, asset quality, and margin resilience.",
    missingEvidence: ["NPL and restructuring trend", "Micro loan yield", "Dividend sustainability"],
    riskLens: ["Credit quality", "Political/regulatory pressure", "Funding cost"],
  },
  {
    id: "idx-tlkm",
    title: "TLKM case candidate",
    assetName: "TLKM",
    assetType: "public_equity",
    ticker: "TLKM",
    thesisAngle: "Infrastructure/income screen: mobile competition, IndiHome integration, and capital returns.",
    missingEvidence: ["ARPU trend", "Capex intensity", "Dividend policy"],
    riskLens: ["Competitive pricing", "Execution risk", "Capital allocation"],
  },
  {
    id: "idx-asii",
    title: "ASII case candidate",
    assetName: "ASII",
    assetType: "public_equity",
    ticker: "ASII",
    thesisAngle: "Indonesia cyclicals screen: auto demand, commodity exposure, and portfolio discount.",
    missingEvidence: ["Auto sales trend", "Commodity sensitivity", "Segment profit mix"],
    riskLens: ["Cyclical downturn", "Conglomerate complexity", "EV transition"],
  },
];

const GENERIC_CANDIDATES: TriageCandidate[] = [
  {
    id: "generic-public-equity",
    title: "Public equity screen",
    assetName: "Public equity idea",
    assetType: "public_equity",
    thesisAngle: "Start with a listed company where cited price, EPS, and ROE can be verified before locking.",
    missingEvidence: ["Ticker", "Recent filing or investor report", "Current price source"],
    riskLens: ["Valuation drift", "Evidence quality", "Thesis breaker clarity"],
  },
  {
    id: "generic-manual-asset",
    title: "Manual private asset",
    assetName: "Manual asset idea",
    assetType: "other",
    thesisAngle: "Use a manual case when the asset has no reliable automated pricing or data connector.",
    missingEvidence: ["Valuation memo", "Liquidity and duration", "Exit path"],
    riskLens: ["Stale valuation", "Illiquidity", "Key-person or operator risk"],
  },
  {
    id: "generic-macro-view",
    title: "Macro view",
    assetName: "Macro view",
    assetType: "macro_view",
    thesisAngle: "Capture a macro assumption only if it affects existing or planned asset-level theses.",
    missingEvidence: ["Affected holdings", "Observable trigger", "Time horizon"],
    riskLens: ["Hidden correlation", "FX/rates exposure", "Crowded thesis"],
  },
];

export function deriveIdeaTriage(prompt: string): TriageResult {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  if (!text || isCasual(lower)) {
    return {
      mode: "casual",
      heading: "IC Chair triage",
      summary: "No case file opened. Ask about an opportunity set, name an asset, or paste a thesis note when you want the desk to start triage.",
      candidates: [],
      chairNotes: [
        "Broad questions stay temporary until you start a case.",
        "Case files are only created when you choose Start case or Add to watchlist.",
      ],
    };
  }

  const directTicker = extractDirectTicker(text);
  if (directTicker) {
    return {
      mode: "direct_asset",
      heading: `Open a case for ${directTicker}?`,
      summary: "This looks like a concrete asset request. Start a case when you want thesis intake, evidence, and valuation verification to begin.",
      candidates: [
        {
          id: `direct-${directTicker.toLowerCase()}`,
          title: `${directTicker} case candidate`,
          assetName: directTicker,
          assetType: "public_equity",
          ticker: directTicker,
          thesisAngle: "Single-name case setup: verify the asset, collect cited facts, then build thesis memory before any figures are locked.",
          missingEvidence: ["Company/source identity", "Cited price", "Cited fundamentals"],
          riskLens: ["Wrong ticker/source match", "Uncited valuation inputs", "Thesis not yet explicit"],
        },
      ],
      chairNotes: ["Starting a case will create a draft in Library. Until then, this triage remains temporary."],
    };
  }

  if (isIndonesianEquityScreen(lower)) {
    return {
      mode: "broad_screen",
      heading: "Indonesian equity candidates for investigation",
      summary:
        "These are investigation candidates, not buy/sell recommendations. The next step is to choose one case and verify evidence before any thesis or figures are locked.",
      candidates: IDX_CANDIDATES,
      chairNotes: [
        "Prioritize one name at a time so the case file has clean evidence and explicit thesis breakers.",
        "For IDX names, fundamentals should prefer issuer or exchange filings; quote pages are acceptable only for current/delayed price context.",
      ],
    };
  }

  return {
    mode: "broad_screen",
    heading: "Choose the right case type",
    summary:
      "This is still broad. Triage can frame the opportunity, but it should not create workspace records until there is a concrete asset or thesis to track.",
    candidates: GENERIC_CANDIDATES,
    chairNotes: [
      "Use public equity for listed companies with verifiable market data.",
      "Use manual assets for private, alternative, or qualitative opportunities.",
      "Use macro view only when the assumption affects asset-level decisions.",
    ],
  };
}

function isCasual(lower: string): boolean {
  return /^(hi|hello|hey|halo|hai)(\s+there)?[.!?\s]*$/.test(lower) ||
    /^(test|testing|thanks|thank you|ok|okay)[.!?\s]*$/.test(lower);
}

function isIndonesianEquityScreen(lower: string): boolean {
  const market = /\b(indonesia|indonesian|idx|bei|saham|emiten)\b/.test(lower);
  const screen = /\b(stock|stocks|saham|emiten|recommend|recommendation|idea|ideas|watch|dig|screen|worth)\b/.test(lower);
  return market && screen;
}

function extractDirectTicker(text: string): string | null {
  const explicit = text.match(/\b(?:analy[sz]e|evaluasi|review|research|dig into|start case|case for)\s+([A-Za-z]{4})(?:\.(?:JK|IDX))?\b/i)?.[1];
  if (explicit) return explicit.toUpperCase();

  const ticker = text.match(/\b(?:ticker|kode|symbol)\s*[:=]?\s*([A-Za-z]{4})(?:\.(?:JK|IDX))?\b/i)?.[1];
  return ticker ? ticker.toUpperCase() : null;
}
