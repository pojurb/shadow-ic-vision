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

/** Pass 1 of the two-pass analysis: free-form research using web tools. */
export const RESEARCH_SYSTEM = `You are an institutional investment research analyst gathering evidence on a single asset before a formal red-team debate.

Use the tools available to you:
- web_fetch: read every link the user attached, and any other URL you decide is worth reading.
- web_search: search for current, decision-relevant facts (recent results, news, sector moves) when enabled.

Produce concise analyst NOTES (not JSON, not a final verdict): the strongest bull evidence, the strongest bear evidence, and concrete observations for an Operator lens (moat/operations), a Risk lens (downside/exit triggers), and a Predator lens (the contrarian fat-pitch condition).

GROUNDING: the user message includes "Locked figures" from a deterministic engine. Treat those as the only authoritative numbers. You may add qualitative facts from sources, but never contradict or recompute a locked figure, and attribute any external number to its source.`;

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

/**
 * Summary of attached context (files + links). File bytes are sent as native
 * content blocks alongside the text; this just orients the model and surfaces
 * links/web-research intent. Returns "" when nothing is attached.
 */
export function attachedContextText(a: Analysis): string {
  const lines: string[] = [];
  for (const s of a.sources) {
    if (s.kind === "file") lines.push(`- ${s.fileKind}: ${s.name} (attached as a content block)`);
    else lines.push(`- link: ${s.url}${s.title ? ` — ${s.title}` : ""}`);
  }
  if (a.allowWebSearch) lines.push(`- web research: enabled (search the web when it would sharpen the thesis)`);
  if (lines.length === 0) return "";
  return [`Attached context:`, ...lines].join("\n");
}

/** Pass 1 user turn: tell the model what to research. */
export function buildResearchUserPrompt(a: Analysis): string {
  const links = a.sources.filter((s) => s.kind === "link");
  const tasks: string[] = [];
  if (links.length) tasks.push(`Read these attached links with web_fetch:\n${links.map((s) => (s.kind === "link" ? `- ${s.url}` : "")).join("\n")}`);
  if (a.allowWebSearch) tasks.push(`Search the web for current, decision-relevant facts about this asset and its sector.`);
  tasks.push(`Then write analyst notes: strongest bull evidence, strongest bear evidence, and observations for the Operator / Risk / Predator lenses.`);
  return [groundingText(a), attachedContextText(a), tasks.join("\n\n")].filter((s) => s !== "").join("\n\n");
}

/**
 * Pass 2 user turn (structured). `researchNotes`, when present, is qualitative
 * context from pass 1 — explicitly NOT a source of numbers (those stay locked).
 */
export function buildAnalysisUserPrompt(a: Analysis, researchNotes?: string): string {
  const notesBlock = researchNotes?.trim()
    ? `Research notes (qualitative context only — do NOT take any number from here; all figures come from the locked figures above):\n${researchNotes.trim()}`
    : "";
  return [
    groundingText(a),
    attachedContextText(a),
    notesBlock,
    `Produce the red-team debate (2-3 bull, 2-3 bear), the 3 advisory lenses, and a confidence score, grounded strictly in the figures above.`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");
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
  return [groundingText(a), attachedContextText(a), debateContext(a)]
    .filter((s) => s !== "")
    .join("\n\n");
}
