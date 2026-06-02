/**
 * Structured-output schemas. Forcing these shapes via output_config.format
 * guarantees a renderable, auditable result (no free text). Hand-written JSON
 * Schema (Anthropic structured outputs require additionalProperties:false and no
 * numeric/length constraints; `enum` is allowed).
 *
 * The schema is intentionally GENERIC across verticals: the per-vertical lens ids
 * and debate slots are enumerated in the PROMPT, then enforced by a validate+zip
 * step in `analyze.ts`. This keeps one schema working across all three providers.
 */
import type { ThesisSupport, DebateLine, Vertical, AssetParameters } from "@/data/presets";

export type { ThesisSupport, DebateLine };

/* ----------------------------------------------------------------- intake */

/** One extracted engine parameter, tagged by how it entered the deal. */
export interface IntakeField {
  key: string;
  value: number;
  /** "stated" = the user typed it; "inferred" = the model read/derived it. */
  source: "stated" | "inferred";
}

/** Raw intake output from the model (pre-validation — strings unvalidated). */
export interface IntakeOutput {
  vertical: string;
  mode: string;
  assetName: string;
  title: string;
  note: string;
  fields: IntakeField[];
}

/** Finalized intake (validated + zipped). Adds the engine-ready `params`. */
export interface IntakeResult {
  vertical: Vertical;
  mode: "scoping" | "figures";
  assetName: string;
  title: string;
  note: string;
  /** Kept, source-tagged rows for the confirm card (unknown keys dropped). */
  fields: IntakeField[];
  /** BLANK_PARAMS for the vertical, overlaid with the kept numeric fields. */
  params: AssetParameters;
}

const intakeField = {
  type: "object",
  properties: {
    key: { type: "string", description: "An engine parameter key — one of the candidate keys named for the chosen vertical in the instructions" },
    value: { type: "number", description: "The numeric value (no units, no thousands separators)" },
    source: { type: "string", description: "'stated' if the user explicitly typed this number, 'inferred' if you read or derived it" },
  },
  required: ["key", "value", "source"],
  additionalProperties: false,
} as const;

/**
 * Generic intake schema. `vertical`/`mode`/`source` stay plain strings (not enum)
 * and are validated in `finalizeIntake` — same defensive approach as `thesisSupport`
 * (Gemini's `toGeminiSchema` strips enums, so the code is the real guard).
 */
export const INTAKE_JSON_SCHEMA = {
  type: "object",
  properties: {
    vertical: { type: "string", description: "One of: stocks, startups, conventional" },
    mode: { type: "string", description: "'figures' if there are enough numbers to value the asset, else 'scoping'" },
    assetName: { type: "string", description: "The asset/company name, or '' if not given" },
    title: { type: "string", description: "A short title for this analysis" },
    note: { type: "string", description: "In scoping mode: what numbers are missing. In figures mode: a one-line summary of what was found" },
    fields: { type: "array", items: intakeField, description: "The engine parameters you could extract (omit any you cannot find — never invent)" },
  },
  required: ["vertical", "mode", "assetName", "title", "note", "fields"],
  additionalProperties: false,
} as const;

/** One advisory lens emitted by the model (zipped against the persona's lens set). */
export interface LensOut {
  id: string;
  name: string;
  verdict: string;
  text: string;
}

export interface DebateOutput {
  thesisSupport: ThesisSupport;
  /** One-line justification of the asset's standing (references locked verdicts only). */
  stanceBasis: string;
  bull: DebateLine[];
  bear: DebateLine[];
  advisory: LensOut[];
}

/** Optional, on-demand second-expert red-team of a produced analysis. */
export interface ExpertReview {
  verdictLine: string;
  strengths: string[];
  gaps: string[];
  /** Grounding-integrity pass: flags any number not present verbatim in the locked figures. */
  groundingCheck: string;
  whatWouldChangeMyMind: string[];
}

const line = {
  type: "object",
  properties: {
    agent: { type: "string", description: "Short persona/role name, e.g. 'Valuation Bear'" },
    text: { type: "string", description: "One concise, data-grounded argument (1-2 sentences)" },
    slot: { type: "string", description: "The debate-rubric slot id this line addresses (one of the slot ids named in the instructions)" },
  },
  required: ["agent", "text", "slot"],
  additionalProperties: false,
} as const;

const lensItem = {
  type: "object",
  properties: {
    id: { type: "string", description: "The lens id (one of the lens ids named in the instructions)" },
    name: { type: "string", description: "The lens display name" },
    verdict: { type: "string", description: "A 1-2 word stance/quality label, never a buy/sell action" },
    text: { type: "string", description: "2-4 sentences of concrete, grounded analysis" },
  },
  required: ["id", "name", "verdict", "text"],
  additionalProperties: false,
} as const;

export const DEBATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    thesisSupport: { type: "string", enum: ["STRONG", "MIXED", "THIN"], description: "How strongly the locked figures support the thesis" },
    stanceBasis: { type: "string", description: "One-line justification of the asset's standing using ONLY the locked verdicts/figures" },
    bull: { type: "array", items: line, description: "Bull arguments — one per debate slot" },
    bear: { type: "array", items: line, description: "Bear arguments — one per debate slot" },
    advisory: { type: "array", items: lensItem, description: "One object per advisory lens, in the instructed set" },
  },
  required: ["thesisSupport", "stanceBasis", "bull", "bear", "advisory"],
  additionalProperties: false,
} as const;

const stringArray = { type: "array", items: { type: "string" } } as const;

export const EXPERT_REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdictLine: { type: "string", description: "One sentence: sound / needs work / off-track" },
    strengths: stringArray,
    gaps: stringArray,
    groundingCheck: { type: "string", description: "Flag any number not present verbatim in Locked figures; 'clean' if all trace" },
    whatWouldChangeMyMind: stringArray,
  },
  required: ["verdictLine", "strengths", "gaps", "groundingCheck", "whatWouldChangeMyMind"],
  additionalProperties: false,
} as const;
