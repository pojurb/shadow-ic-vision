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
import type { ThesisSupport, DebateLine } from "@/data/presets";

export type { ThesisSupport, DebateLine };

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
