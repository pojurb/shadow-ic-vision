/**
 * Structured-output schema for the red-team debate. Forcing this shape via
 * output_config.format guarantees a renderable, auditable result (no free text).
 * Hand-written JSON Schema (Anthropic structured outputs require
 * additionalProperties:false and no numeric/length constraints).
 */

export interface DebateLine {
  agent: string;
  text: string;
}

export interface AdvisoryLensOut {
  title: string;
  text: string;
}

export interface DebateOutput {
  confidence: number;
  bull: DebateLine[];
  bear: DebateLine[];
  advisory: {
    operator: AdvisoryLensOut;
    risk: AdvisoryLensOut;
    predator: AdvisoryLensOut;
  };
}

const line = {
  type: "object",
  properties: {
    agent: { type: "string", description: "Short persona/role name, e.g. 'Valuation Bear'" },
    text: { type: "string", description: "One concise, data-grounded argument (1-2 sentences)" },
  },
  required: ["agent", "text"],
  additionalProperties: false,
} as const;

const lens = {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string", description: "2-4 sentences of concrete, actionable analysis" },
  },
  required: ["title", "text"],
  additionalProperties: false,
} as const;

export const DEBATE_JSON_SCHEMA = {
  type: "object",
  properties: {
    confidence: { type: "integer", description: "Orchestrator confidence 20-90" },
    bull: { type: "array", items: line, description: "2-3 strongest bull arguments" },
    bear: { type: "array", items: line, description: "2-3 strongest bear arguments" },
    advisory: {
      type: "object",
      properties: { operator: lens, risk: lens, predator: lens },
      required: ["operator", "risk", "predator"],
      additionalProperties: false,
    },
  },
  required: ["confidence", "bull", "bear", "advisory"],
  additionalProperties: false,
} as const;
