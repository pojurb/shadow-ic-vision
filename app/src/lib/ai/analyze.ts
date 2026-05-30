/**
 * Runs the grounded red-team analysis via structured output. Returns the
 * debate + advisory + confidence; numbers come only from the locked figures.
 */
import { ANTHROPIC_URL, anthropicHeaders, errorMessage } from "./client";
import { DEBATE_JSON_SCHEMA, type DebateOutput } from "./schemas";
import { SYSTEM_PROMPT, buildAnalysisUserPrompt } from "./prompts";
import { buildFileBlocks } from "./content";
import type { Analysis } from "@/lib/domain/types";

interface TextBlock {
  type: string;
  text?: string;
}

export async function runAnalysis(
  apiKey: string,
  model: string,
  analysis: Analysis,
): Promise<DebateOutput> {
  const fileBlocks = await buildFileBlocks(analysis.sources);
  const userText = buildAnalysisUserPrompt(analysis);
  // Files (image/document blocks) precede the grounding text. Structured outputs
  // are incompatible with citations, so web_fetch/web_search are not attached here.
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
  const text = (data.content as TextBlock[] | undefined)?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Model returned an empty response.");
  try {
    return JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
}
