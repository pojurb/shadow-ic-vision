/**
 * Prompt construction. The system prompt is now persona-driven (per vertical); the
 * per-asset "locked facts" go in the user turn so the model treats them as grounded
 * data, not instructions. Per-vertical debate slots and lens ids are enumerated in
 * the user prompt, then enforced by a validate+zip step in `analyze.ts`.
 */
import type { Analysis, PortfolioAnalysis, PortfolioMetrics } from "@/lib/domain/types";
import type { Vertical } from "@/data/presets";
import { personaFor, portfolioPersona } from "./personas";
import { summarizeMetrics } from "@/lib/finance/compute";
import { formatIDR } from "@/lib/finance/format";
import { FIELDS, type Field } from "@/data/fields";

/** System prompt for the structured analysis pass — the vertical's expert persona. */
export function analysisSystem(a: Analysis): string {
  return personaFor(a.vertical).systemPrompt;
}

/** System prompt for the optional, on-demand expert-review pass. */
export function reviewSystem(a: Analysis): string {
  return personaFor(a.vertical).reviewSystemPrompt;
}

/* ----------------------------------------------------------------- intake */

/** The unit the engine expects for a field — disambiguates percent vs fraction. */
function unitHint(type: Field["type"]): string {
  switch (type) {
    case "currency":
      return "plain number in IDR";
    case "percent":
      return "whole-number percent, e.g. 19 for 19%";
    case "percent_raw":
      return "decimal fraction between 0 and 1, e.g. 0.19 for 19%";
    default:
      return "plain number";
  }
}

/** Enumerate a vertical's candidate engine keys + the exact unit each expects. */
function candidateKeys(v: Vertical): string {
  return FIELDS[v].map((f) => `${String(f.key)} — ${f.label} [${unitHint(f.type)}]`).join("; ");
}

/**
 * System prompt for the intake pass. The model detects the vertical and EXTRACTS
 * the engine parameters it can find — it must never invent a figure. Each field is
 * tagged stated (typed by the user) vs inferred (read/derived), so the confirm card
 * can gate only the inferred ones before they reach `computeMetrics`.
 */
export function intakeSystem(): string {
  return `You are an intake analyst. A user has pasted or described a potential investment. Your job is to set it up for a deterministic valuation engine — NOT to value it yourself.

Steps:
1. Detect the vertical: "stocks" (listed equities), "startups" (venture / unit-economics), or "conventional" (a conventional/SMB CapEx business).
2. Extract ONLY the engine parameters you can find for that vertical. Candidate keys:
   - stocks: ${candidateKeys("stocks")}
   - startups: ${candidateKeys("startups")}
   - conventional: ${candidateKeys("conventional")}
   Use the exact key strings above, and convert each value to the unit shown in its [brackets] — this matters: some fields want a whole-number percent (19) and others a decimal fraction (0.19) for the SAME "19%". A margin of 70% → 0.70; a 4% churn → 0.04; "Rp 4.2k" → 4200. Omit any key you cannot find — NEVER invent or guess a number to fill a slot.
3. Tag every field: "stated" if the user explicitly gave that number, "inferred" if you read it from an attachment or derived it. When unsure, use "inferred" so it gets confirmed.
4. If there aren't enough numbers to value the asset, set mode "scoping" and explain in "note" what is missing. Otherwise set mode "figures".

NON-NEGOTIABLE: you extract, you do not fabricate. A figure you did not see in the input must be omitted, not estimated. Return the structured object only.`;
}

/** Intake user turn: the raw deal text. Attachment bytes ride as native blocks. */
export function buildIntakeUserPrompt(userText: string): string {
  return `Set up this deal for the valuation engine. Read any attached files too.\n\n---\n${userText.trim()}`;
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

/* ============================================================= portfolio */

export const PORTFOLIO_CHAT_SYSTEM = `You are an institutional portfolio strategist answering follow-up questions about a MULTI-ASSET portfolio that has already been composed and analyzed. Use ONLY the locked figures provided — both the portfolio-level figures AND each holding's own locked figures — plus the prior debate. Never invent, estimate, or recompute a number; when you compare holdings, compare the figures already given. Be concise and direct, use markdown, and reason like a sharp cross-asset allocator. You may stress-test or challenge the construction. You are an analyst, not a decision-maker — never tell the human to buy or sell.`;

/**
 * Portfolio "locked facts" for the prompt: the deterministic portfolio metrics PLUS
 * each holding's own engine figures (so cross-asset questions — "which holding has the
 * best margin of safety?" — can be answered without the model recomputing anything).
 * Every value here comes from the engine (`computePortfolioMetrics` + each member's
 * `computeMetrics`); the model may not alter any of it.
 */
export function portfolioGroundingText(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): string {
  const figures = metrics.metrics
    .map((m) => `- ${m.label}: ${m.display}${m.verdict ? ` (${m.verdict})` : ""}`)
    .join("\n");

  const holdings = metrics.positions.map((p, i) => {
    const member = byId.get(p.analysisId);
    const figs = member ? summarizeMetrics(member.metrics) : "(member analysis unavailable)";
    return [
      `${i + 1}. ${p.name} (${p.vertical}) — weight ${Math.round(p.weight * 100)}%, capital ${formatIDR(
        p.capital,
      )}, stance ${p.stance ?? "—"}`,
      `   Locked figures: ${figs}`,
    ].join("\n");
  });

  return [
    `Portfolio: ${portfolio.title} — ${metrics.positions.length} holdings`,
    ``,
    `Portfolio locked figures (deterministic engine output — do not alter):`,
    figures,
    ``,
    `Holdings (each with its own locked figures — also deterministic, do not alter):`,
    holdings.length ? holdings.join("\n") : "- (no holdings yet)",
  ].join("\n");
}

/** Text rendering of a completed portfolio debate, to seed the cross-asset chat. */
export function portfolioDebateContext(p: PortfolioAnalysis): string {
  if (!p.debate) return "";
  const lines = (arr: { agent: string; text: string; slot?: string }[]) =>
    arr.map((x) => `  - [${x.agent}${x.slot ? `, ${x.slot}` : ""}] ${x.text}`).join("\n");
  const parts = [
    `Prior portfolio debate (thesis support: ${p.debate.thesisSupport}):`,
    `Bull:\n${lines(p.debate.bull)}`,
    `Bear:\n${lines(p.debate.bear)}`,
  ];
  if (p.advisory && p.advisory.length) {
    parts.push(`Advisory lenses:`, ...p.advisory.map((l) => `  - ${l.name} [${l.verdict}]: ${l.text}`));
  }
  if (p.stance) parts.push(`Engine stance: ${p.stance.label} — ${p.stance.basis}`);
  return parts.join("\n");
}

export function portfolioChatContextPreamble(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): string {
  return [portfolioGroundingText(portfolio, metrics, byId), portfolioDebateContext(portfolio)]
    .filter((s) => s !== "")
    .join("\n\n");
}

/** Portfolio structured-debate user turn (mirrors `buildAnalysisUserPrompt`). */
export function buildPortfolioAnalysisUserPrompt(
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): string {
  const persona = portfolioPersona();
  const slots = persona.debateSlots.map((s) => `${s.name} (slot id "${s.id}")`).join(", ");
  const lenses = persona.lenses.map((l) => `${l.name} (id "${l.id}")`).join("; ");
  return [
    portfolioGroundingText(portfolio, metrics, byId),
    `Produce the analysis as ${persona.label}, grounded strictly in the locked figures above (portfolio-level and per-holding).`,
    `Debate: for EACH side (bull and bear), give one line per slot — ${slots} — tagging each line with its slot id. Cite a locked figure wherever the slot maps to one.`,
    `Advisory: exactly one lens object per lens — ${lenses} — each with a short verdict word (a stance/quality label, never a buy/sell action) and 2-4 grounded sentences.`,
    `Also output thesisSupport (STRONG / MIXED / THIN) and a one-line stanceBasis justified ONLY by the locked portfolio figures.`,
  ]
    .filter((s) => s !== "")
    .join("\n\n");
}
