/**
 * Prompt construction. The SYSTEM_PROMPT is static; per-asset "locked facts"
 * go in the user turn so the model treats them as grounded data, not instructions.
 */
import type { Analysis } from "@/lib/domain/types";

export const SYSTEM_PROMPT = `You are the Orchestrator of an institutional investment red-team. You produce a balanced Bull-vs-Bear debate and a 3-lens advisory board for a single asset, to support a human decision-maker.

NON-NEGOTIABLE RULES:
1. GROUNDING: Use ONLY the numeric figures provided in the user message ("Locked figures"). Never invent, recompute, or alter a number. If you reference a metric, reference the provided value verbatim. Qualitative reasoning is welcome; fabricated numbers are not.
2. BALANCE: The Bull and Bear sides must be roughly symmetric in strength and specificity. Do not stack one side.
3. THREE LENSES:
   - Operator: moat, operational efficiency, concrete SOPs/actions.
   - Risk Manager: stress-test scenarios, downside, capital preservation, exit triggers.
   - Predator: contrarian "fat pitch" — the exact condition + level at which to swing capital aggressively.
4. CONFIDENCE: an integer 20-90 reflecting how strong and data-supported the overall thesis is (not a buy/sell signal).
5. You are an analyst, not a decision-maker. Never tell the human to buy or sell; present the case for judgement.

Return the structured object only.`;

export const CHAT_SYSTEM = `You are an institutional investment analyst answering follow-up questions about ONE asset already analyzed. Use ONLY the locked figures and the prior debate provided as context — never invent numbers. Be concise and direct, use markdown, and reason like a sharp buy-side analyst. You may stress-test, reframe, or challenge the prior thesis. You are an analyst, not a decision-maker.`;

export function groundingText(a: Analysis): string {
  const meta = a.assetMeta;
  const metaBits = [
    meta.ticker && `ticker ${meta.ticker}`,
    meta.sector && `sector ${meta.sector}`,
    meta.currency && `currency ${meta.currency}`,
    meta.dataAsOf && `data as of ${meta.dataAsOf}`,
  ]
    .filter(Boolean)
    .join(", ");

  const figures = a.metrics.metrics
    .map((m) => `- ${m.label}: ${m.display}${m.verdict ? ` (${m.verdict})` : ""}`)
    .join("\n");

  return [
    `Asset: ${a.assetName} (${a.vertical})${metaBits ? ` — ${metaBits}` : ""}`,
    ``,
    `Locked figures (deterministic engine output — do not alter):`,
    figures,
  ].join("\n");
}

export function buildAnalysisUserPrompt(a: Analysis): string {
  return [
    groundingText(a),
    ``,
    `Produce the red-team debate (2-3 bull, 2-3 bear), the 3 advisory lenses, and a confidence score, grounded strictly in the figures above.`,
  ].join("\n");
}

/** Text rendering of a completed debate, used to seed chat context. */
export function debateContext(a: Analysis): string {
  if (!a.debate) return "";
  const lines = (arr: { agent: string; text: string }[]) =>
    arr.map((x) => `  - [${x.agent}] ${x.text}`).join("\n");
  const parts = [
    `Prior debate (confidence ${a.debate.confidence}%):`,
    `Bull:\n${lines(a.debate.bull)}`,
    `Bear:\n${lines(a.debate.bear)}`,
  ];
  if (a.advisory) {
    parts.push(
      `Advisory lenses:`,
      `  - Operator: ${a.advisory.operator.text}`,
      `  - Risk: ${a.advisory.risk.text}`,
      `  - Predator: ${a.advisory.predator.text}`,
    );
  }
  return parts.join("\n");
}

export function chatContextPreamble(a: Analysis): string {
  return [groundingText(a), ``, debateContext(a)].join("\n");
}
