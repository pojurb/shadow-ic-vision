/**
 * Prompt construction. The system prompt is now persona-driven (per vertical); the
 * per-asset "locked facts" go in the user turn so the model treats them as grounded
 * data, not instructions. Per-vertical debate slots and lens ids are enumerated in
 * the user prompt, then enforced by a validate+zip step in `analyze.ts`.
 */
import type { Analysis } from "@/lib/domain/types";
import { personaFor } from "./personas";

/** System prompt for the structured analysis pass — the vertical's expert persona. */
export function analysisSystem(a: Analysis): string {
  return personaFor(a.vertical).systemPrompt;
}

/** System prompt for the optional, on-demand expert-review pass. */
export function reviewSystem(a: Analysis): string {
  return personaFor(a.vertical).reviewSystemPrompt;
}

export const CHAT_SYSTEM = `You are an institutional investment analyst answering follow-up questions about ONE asset already analyzed. Use ONLY the locked figures and the prior debate provided as context — never invent numbers. Be concise and direct, use markdown, and reason like a sharp buy-side analyst. You may stress-test, reframe, or challenge the prior thesis. You are an analyst, not a decision-maker.`;

/** Pass 1 of the two-pass analysis: free-form research using web tools (persona-aware). */
export function researchSystem(a: Analysis): string {
  const persona = personaFor(a.vertical);
  const lensNames = persona.lenses.map((l) => l.name).join(", ");
  return `You are ${persona.label}, gathering evidence on a single asset before a formal red-team debate.

Use the tools available to you:
- web_fetch: read every link the user attached, and any other URL you decide is worth reading.
- web_search: search for current, decision-relevant facts (recent results, news, sector moves) when enabled.

Produce concise analyst NOTES (not JSON, not a final verdict): the strongest bull evidence, the strongest bear evidence, and concrete observations for these lenses — ${lensNames}.

GROUNDING: the user message includes "Locked figures" from a deterministic engine. Treat those as the only authoritative numbers. You may add qualitative facts from sources, but never contradict or recompute a locked figure, and attribute any external number to its source.`;
}

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
  const lensNames = personaFor(a.vertical).lenses.map((l) => l.name).join(", ");
  tasks.push(`Then write analyst notes: strongest bull evidence, strongest bear evidence, and observations for these lenses — ${lensNames}.`);
  return [groundingText(a), attachedContextText(a), tasks.join("\n\n")].filter((s) => s !== "").join("\n\n");
}

/**
 * Pass 2 user turn (structured). `researchNotes`, when present, is qualitative
 * context from pass 1 — explicitly NOT a source of numbers (those stay locked).
 */
export function buildAnalysisUserPrompt(a: Analysis, researchNotes?: string): string {
  const persona = personaFor(a.vertical);
  const slots = persona.debateSlots.map((s) => `${s.name} (slot id "${s.id}")`).join(", ");
  const lenses = persona.lenses.map((l) => `${l.name} (id "${l.id}")`).join("; ");
  const notesBlock = researchNotes?.trim()
    ? `Research notes (qualitative context only — do NOT take any number from here; all figures come from the locked figures above):\n${researchNotes.trim()}`
    : "";
  return [
    groundingText(a),
    attachedContextText(a),
    notesBlock,
    `Produce the analysis as ${persona.label}, grounded strictly in the locked figures above.`,
    `Debate: for EACH side (bull and bear), give one line per slot — ${slots} — tagging each line with its slot id. Cite a locked figure wherever the slot maps to one.`,
    `Advisory: exactly one lens object per lens — ${lenses} — each with a short verdict word (a stance/quality label, never a buy/sell action) and 2-4 grounded sentences.`,
    `Also output thesisSupport (STRONG / MIXED / THIN) and a one-line stanceBasis justified ONLY by the locked verdicts/figures.`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");
}

/** Pass-3 (optional) user turn: red-team the produced analysis. */
export function buildReviewUserPrompt(a: Analysis): string {
  return [
    groundingText(a),
    debateContext(a),
    `Red-team the analysis above as ${personaFor(a.vertical).label}. Return the structured review (verdictLine, strengths, gaps, groundingCheck, whatWouldChangeMyMind). For groundingCheck, flag any number in the debate/advisory not present verbatim in the Locked figures; say "clean" if every figure traces.`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");
}

/** Text rendering of a completed debate, used to seed chat + review context. */
export function debateContext(a: Analysis): string {
  if (!a.debate) return "";
  const lines = (arr: { agent: string; text: string; slot?: string }[]) =>
    arr.map((x) => `  - [${x.agent}${x.slot ? `, ${x.slot}` : ""}] ${x.text}`).join("\n");
  const parts = [
    `Prior debate (thesis support: ${a.debate.thesisSupport}):`,
    `Bull:\n${lines(a.debate.bull)}`,
    `Bear:\n${lines(a.debate.bear)}`,
  ];
  if (a.advisory && a.advisory.length) {
    parts.push(`Advisory lenses:`, ...a.advisory.map((l) => `  - ${l.name} [${l.verdict}]: ${l.text}`));
  }
  if (a.stance) parts.push(`Engine stance: ${a.stance.label} — ${a.stance.basis}`);
  return parts.join("\n");
}

export function chatContextPreamble(a: Analysis): string {
  return [groundingText(a), attachedContextText(a), debateContext(a)]
    .filter((s) => s !== "")
    .join("\n\n");
}
