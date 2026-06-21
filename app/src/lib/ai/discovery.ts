import { ANTHROPIC_URL, anthropicHeaders, errorMessage } from "./client";
import type { ExploreDeeperResult, ExploreDirection, ExploreResult } from "@/lib/domain/triage";
import { inspectDeeperIdeaDiscoveryOutput, inspectIdeaDiscoveryOutput } from "@/lib/domain/triage";

export interface IdeaDiscoveryOutput {
  summary: string;
  directions: Array<{
    title: string;
    assetName: string;
    assetType: string;
    ticker: string;
    thesisAngle: string;
    whyItCouldWork: string[];
    mainRisks: string[];
    nextQuestions: string[];
  }>;
}

export interface DeeperIdeaDiscoveryOutput {
  summary: string;
  whyItCouldWork: string[];
  mainRisks: string[];
  evidenceToCheck: string[];
  decisionQuestions: string[];
}

const stringArray = { type: "array", items: { type: "string" } } as const;

const discoveryDirection = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short display title for this exploration direction" },
    assetName: { type: "string", description: "Company, asset, business idea, or macro view name" },
    assetType: { type: "string", description: "One of: public_equity, conventional_business, startup, real_estate, crypto, macro_view, other" },
    ticker: { type: "string", description: "Ticker when the direction is a listed security, otherwise empty string" },
    thesisAngle: { type: "string", description: "Plain-language thesis framing for why this direction may matter" },
    whyItCouldWork: stringArray,
    mainRisks: stringArray,
    nextQuestions: stringArray,
  },
  required: ["title", "assetName", "assetType", "ticker", "thesisAngle", "whyItCouldWork", "mainRisks", "nextQuestions"],
  additionalProperties: false,
} as const;

export const IDEA_DISCOVERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Plain-language framing summary for the broad exploration prompt" },
    directions: { type: "array", items: discoveryDirection },
  },
  required: ["summary", "directions"],
  additionalProperties: false,
} as const;

export const DEEPER_IDEA_DISCOVERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Sharpened summary for the selected exploration direction" },
    whyItCouldWork: stringArray,
    mainRisks: stringArray,
    evidenceToCheck: stringArray,
    decisionQuestions: stringArray,
  },
  required: ["summary", "whyItCouldWork", "mainRisks", "evidenceToCheck", "decisionQuestions"],
  additionalProperties: false,
} as const;

export function ideaDiscoverySystem(): string {
  return `You help a private investor explore early investment ideas.

Rules:
- Return temporary guided exploration only, never buy/sell recommendations.
- Do not say the user should buy, sell, hold, enter, exit, or allocate.
- Broad prompts should become 2 to 4 exploration directions when possible.
- Each direction must help the user think: what may work, what may fail, and what needs checking next.
- Do not invent precise financial facts, prices, EPS, ROE, valuations, or returns.
- Keep all copy plain-language and suitable for an everyday investor.`;
}

export function buildIdeaDiscoveryUserPrompt(prompt: string): string {
  return `User's temporary Explore prompt:
${prompt}

Return JSON only. Keep this temporary and focused on guided exploration, not saved-review actions.`;
}

export function buildDeeperIdeaDiscoveryUserPrompt(prompt: string, direction: ExploreDirection): string {
  return `User's temporary Explore prompt:
${prompt}

The user picked this temporary direction to explore more deeply:
- Title: ${direction.title}
- Asset name: ${direction.assetName}
- Asset type: ${direction.assetType}
- Thesis angle: ${direction.thesisAngle}
- Why it could work: ${direction.whyItCouldWork.join("; ")}
- Main risks: ${direction.mainRisks.join("; ")}
- Next questions: ${direction.nextQuestions.join("; ")}

Return JSON only. Sharpen the reasoning before any saved review exists.`;
}

type TextBlock = { type?: string; text?: string };

function collectText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as TextBlock[])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

export function finalizeIdeaDiscovery(raw: unknown): ExploreResult {
  const inspected = inspectIdeaDiscoveryOutput(raw);
  if (!inspected) throw new Error("AI discovery did not return usable guided exploration.");
  return inspected;
}

export function finalizeDeeperIdeaDiscovery(raw: unknown, directionId: string): ExploreDeeperResult {
  const inspected = inspectDeeperIdeaDiscoveryOutput(raw, directionId);
  if (!inspected) throw new Error("AI discovery did not return usable deeper exploration.");
  return inspected;
}

export async function runAnthropicIdeaDiscovery(apiKey: string, model: string, prompt: string): Promise<ExploreResult> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 3500,
      system: ideaDiscoverySystem(),
      messages: [{ role: "user", content: buildIdeaDiscoveryUserPrompt(prompt) }],
      output_config: { format: { type: "json_schema", schema: IDEA_DISCOVERY_JSON_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("AI discovery returned an empty response.");
  try {
    return finalizeIdeaDiscovery(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("AI discovery did not return valid structured output.");
    throw error;
  }
}

export async function runAnthropicDeeperIdeaDiscovery(
  apiKey: string,
  model: string,
  prompt: string,
  direction: ExploreDirection,
): Promise<ExploreDeeperResult> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 3500,
      system: ideaDiscoverySystem(),
      messages: [{ role: "user", content: buildDeeperIdeaDiscoveryUserPrompt(prompt, direction) }],
      output_config: { format: { type: "json_schema", schema: DEEPER_IDEA_DISCOVERY_JSON_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("AI discovery returned an empty response.");
  try {
    return finalizeDeeperIdeaDiscovery(JSON.parse(text), direction.id);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("AI discovery did not return valid structured output.");
    throw error;
  }
}
