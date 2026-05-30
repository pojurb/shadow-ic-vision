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
import { DEBATE_JSON_SCHEMA, type DebateOutput } from "./schemas";
import {
  SYSTEM_PROMPT,
  RESEARCH_SYSTEM,
  buildAnalysisUserPrompt,
  buildResearchUserPrompt,
} from "./prompts";
import { buildFileBlocks } from "./content";
import type { Analysis } from "@/lib/domain/types";

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
      body: JSON.stringify({ model, max_tokens: 6000, system: RESEARCH_SYSTEM, messages, tools }),
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
): Promise<DebateOutput> {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: DEBATE_JSON_SCHEMA } },
    }),
  });

  if (!res.ok) throw new Error(await errorMessage(res));

  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("Model returned an empty response.");
  try {
    return JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
}
