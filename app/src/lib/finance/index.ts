/**
 * Deterministic finance engine — the single source of numeric truth for the cockpit.
 * No figure in the product comes from the LLM; everything is computed here and then
 * "locked" into the AI prompt as grounded facts.
 */
export * from "./format";
export * from "./equities";
export * from "./ventures";
export * from "./operating";
