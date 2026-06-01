/**
 * The grounded red-team analysis. Two paths:
 *  - runResearch (pass 1): free-form, with web_fetch/web_search server tools, when
 *    the analysis has links or web research enabled. Returns analyst notes.
 *  - runAnalysis (pass 2): structured output. Numbers come only from the locked
 *    figures; pass-1 notes are folded in as qualitative context, never as numbers.
 * Structured outputs are incompatible with citations, so the web tools live on the
 * separate free-form pass, not here.
 */
import { ANTHROPIC_URL, anthropicHeaders, errorMessage } from "./client";
import {
  DEBATE_JSON_SCHEMA,
  EXPERT_REVIEW_JSON_SCHEMA,
  type DebateOutput,
  type ExpertReview,
} from "./schemas";
import {
  analysisSystem,
  researchSystem,
  reviewSystem,
  buildAnalysisUserPrompt,
  buildResearchUserPrompt,
  buildReviewUserPrompt,
} from "./prompts";
import { buildFileBlocks } from "./content";
import { personaFor } from "./personas";
import type { Analysis, DebateLine, LensResult } from "@/lib/domain/types";
import type { AnalysisResult } from "./types";

interface TextBlock {
  type: string;
  text?: string;
}

function collectText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as TextBlock[])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

/** Does this analysis need a research pass at all? */
export function needsResearch(analysis: Analysis): boolean {
  return analysis.allowWebSearch || analysis.sources.some((s) => s.kind === "link");
}

const MAX_PAUSE_ROUNDS = 6;

/**
 * Pass 1 — free-form research with server tools. Drives the server-tool loop by
 * re-sending on stop_reason "pause_turn" until the model finishes (or the round
 * cap is hit). Returns the concatenated analyst notes.
 */
export async function runResearch(
  apiKey: string,
  model: string,
  analysis: Analysis,
): Promise<string> {
  const tools: Array<Record<string, unknown>> = [];
  if (analysis.sources.some((s) => s.kind === "link")) tools.push({ type: "web_fetch_20260209", name: "web_fetch" });
  if (analysis.allowWebSearch) tools.push({ type: "web_search_20260209", name: "web_search" });
  if (tools.length === 0) return "";

  const fileBlocks = await buildFileBlocks(analysis.sources);
  const userText = buildResearchUserPrompt(analysis);
  const content = fileBlocks.length ? [...fileBlocks, { type: "text", text: userText }] : userText;
  const messages: Array<{ role: string; content: unknown }> = [{ role: "user", content }];

  const parts: string[] = [];
  for (let round = 0; round < MAX_PAUSE_ROUNDS; round++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify({ model, max_tokens: 6000, system: researchSystem(analysis), messages, tools }),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    const data = await res.json();

    const turnText = collectText(data.content);
    if (turnText) parts.push(turnText);

    if (data.stop_reason === "pause_turn") {
      // Server tool paused mid-turn — re-send with the assistant turn appended so
      // the server resumes. No extra user message (per the server-tool protocol).
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    break;
  }
  return parts.join("\n").trim();
}

/**
 * Pass 2 — structured debate. `researchNotes` (from pass 1) is optional qualitative
 * context; the locked figures remain the only source of numbers.
 */
export async function runAnalysis(
  apiKey: string,
  model: string,
  analysis: Analysis,
  researchNotes?: string,
): Promise<AnalysisResult> {
  const fileBlocks = await buildFileBlocks(analysis.sources);
  const userText = buildAnalysisUserPrompt(analysis, researchNotes);
  const content = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: userText }]
    : userText;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: analysisSystem(analysis),
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: DEBATE_JSON_SCHEMA } },
    }),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("Model returned an empty response.");
  let raw: DebateOutput;
  try {
    raw = JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
  return finalizeDebate(analysis, raw);
}

/**
 * Validate + zip the model's structured output against the persona contract, and
 * attach the ENGINE-DERIVED stance (the model never authors the stance label).
 * Pure — the unit-testable core, shared by all three providers.
 */
export function finalizeDebate(analysis: Analysis, raw: DebateOutput): AnalysisResult {
  const persona = personaFor(analysis.vertical);
  const slotIds = new Set(persona.debateSlots.map((s) => s.id));
  const clamp = (l: DebateLine): DebateLine => ({
    agent: l.agent,
    text: l.text,
    slot: l.slot && slotIds.has(l.slot) ? l.slot : undefined,
  });
  // Zip advisory against the persona's lens set: keep lens order, drop unknown ids,
  // fill any the model missed so the UI always renders the full board.
  const byId = new Map((raw.advisory ?? []).map((l) => [l.id, l] as const));
  const advisory: LensResult[] = persona.lenses.map((spec) => {
    const got = byId.get(spec.id);
    return {
      id: spec.id,
      name: spec.name,
      verdict: got?.verdict?.trim() || "—",
      text: got?.text?.trim() || "(no analysis returned for this lens)",
    };
  });
  const derived = persona.stance.derive(analysis.metrics);
  const stance = derived
    ? { label: derived.label, basis: raw.stanceBasis?.trim() || derived.basis }
    : null;
  // Clamp to the enum (Gemini strips the schema enum, so guard the value here).
  const thesisSupport =
    raw.thesisSupport === "STRONG" || raw.thesisSupport === "THIN" ? raw.thesisSupport : "MIXED";
  return {
    debate: {
      thesisSupport,
      bull: (raw.bull ?? []).map(clamp),
      bear: (raw.bear ?? []).map(clamp),
    },
    advisory,
    stance,
  };
}

/**
 * Pass 3 (optional, on-demand) — a second expert red-teams the produced analysis.
 * One structured call, no web tools. Returns the review for the UI to store/show.
 */
export async function runExpertReview(
  apiKey: string,
  model: string,
  analysis: Analysis,
): Promise<ExpertReview> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: reviewSystem(analysis),
      messages: [{ role: "user", content: buildReviewUserPrompt(analysis) }],
      output_config: { format: { type: "json_schema", schema: EXPERT_REVIEW_JSON_SCHEMA } },
    }),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("Model returned an empty review.");
  try {
    return JSON.parse(text) as ExpertReview;
  } catch {
    throw new Error("Model did not return a valid structured review.");
  }
}
