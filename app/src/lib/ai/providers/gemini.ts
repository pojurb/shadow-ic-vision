/**
 * Google Gemini adapter — implements AIProvider over the Generative Language API.
 * Auth: API key via ?key= query param (Google AI Studio key, starts with AIza...).
 * Called directly from the browser (BYOK; key never leaves the user's machine).
 *
 * Capabilities vs. Anthropic / OpenAI:
 *  - vision: native inlineData image parts ✓
 *  - pdfNative: true — Gemini reads PDFs as inlineData (no pdf.js needed)
 *  - webFetchNative / webSearchNative: false → thin-backend tool loop (same as OpenAI)
 *
 * Structured output via generationConfig.responseMimeType + responseSchema.
 * Streaming via :streamGenerateContent?alt=sse.
 * Function calling uses functionDeclarations / functionCall / functionResponse parts.
 */
import type {
  AIProvider,
  AnalysisRequest,
  AnalysisResult,
  ChatRequest,
  DeeperIdeaDiscoveryRequest,
  IdeaDiscoveryRequest,
  IntakeRequest,
  Capabilities,
  ModelOption,
  PortfolioAnalysisRequest,
  PortfolioChatRequest,
} from "../types";
import type { DebateOutput, ExpertReview, IntakeOutput, IntakeResult } from "../schemas";
import { DEBATE_JSON_SCHEMA, EXPERT_REVIEW_JSON_SCHEMA, INTAKE_JSON_SCHEMA } from "../schemas";
import {
  DEEPER_IDEA_DISCOVERY_JSON_SCHEMA,
  IDEA_DISCOVERY_JSON_SCHEMA,
  buildDeeperIdeaDiscoveryUserPrompt,
  buildIdeaDiscoveryUserPrompt,
  finalizeDeeperIdeaDiscovery,
  finalizeIdeaDiscovery,
  ideaDiscoverySystem,
} from "../discovery";
import {
  analysisSystem,
  CHAT_SYSTEM,
  researchSystem,
  reviewSystem,
  intakeSystem,
  buildAnalysisUserPrompt,
  buildResearchUserPrompt,
  buildReviewUserPrompt,
  buildIntakeUserPrompt,
  chatContextPreamble,
  buildPortfolioAnalysisUserPrompt,
  PORTFOLIO_CHAT_SYSTEM,
  portfolioChatContextPreamble,
} from "../prompts";
import { needsResearch, finalizeDebate, finalizeIntake, finalizePortfolioDebate } from "../analyze";
import { portfolioPersona } from "../personas";
import { blobToBase64 } from "../content";
import { getBlob } from "@/lib/repo";
import type { Analysis, ContextSource, ChatMessage } from "@/lib/domain/types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function geminiUrl(model: string, endpoint: string, apiKey: string): string {
  return `${GEMINI_BASE}/${model}:${endpoint}?key=${encodeURIComponent(apiKey)}`;
}

async function geminiErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

const GEMINI_CAPABILITIES: Capabilities = {
  vision: true,
  pdfNative: true,
  webFetchNative: false,
  webSearchNative: false,
};

export const GEMINI_MODELS: ModelOption[] = [
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — latest fast" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview — latest capable" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — stable, most capable" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — stable, balanced" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite — stable, cheapest" },
];

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

/**
 * Gemini's responseSchema doesn't support `additionalProperties`; `enum` support
 * is inconsistent across models. Strip both recursively — the enum on
 * `thesisSupport` is enforced instead by the prompt and clamped in finalizeDebate.
 */
function toGeminiSchema(schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  const { additionalProperties: _drop, enum: _enum, ...rest } = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    out[k] = toGeminiSchema(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content parts — Gemini format
// ---------------------------------------------------------------------------

type GeminiTextPart = { text: string };
type GeminiInlineDataPart = { inlineData: { mimeType: string; data: string } };
type GeminiFunctionCallPart = { functionCall: { name: string; args: Record<string, unknown> } };
type GeminiFunctionResponsePart = {
  functionResponse: { name: string; response: Record<string, unknown> };
};
type GeminiPart =
  | GeminiTextPart
  | GeminiInlineDataPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart;

type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };

/**
 * Build Gemini inlineData parts for file sources.
 * Both images AND PDFs are sent natively as inlineData — no pdf.js needed.
 */
async function buildGeminiFileParts(sources: ContextSource[]): Promise<GeminiInlineDataPart[]> {
  const parts: GeminiInlineDataPart[] = [];
  for (const s of sources) {
    if (s.kind !== "file") continue;
    const blob = await getBlob(s.blobId);
    if (!blob) continue;
    const data = await blobToBase64(blob);
    parts.push({ inlineData: { mimeType: s.mime, data } });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Tool definitions for the backend tool loop (same routes as OpenAI adapter)
// ---------------------------------------------------------------------------

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "web_fetch",
        description:
          "Fetch the full text content of a URL. Use for reading attached links or any other relevant page.",
        parameters: {
          type: "object",
          properties: { url: { type: "string", description: "The https:// URL to fetch." } },
          required: ["url"],
        },
      },
      {
        name: "web_search",
        description:
          "Search the web for current, decision-relevant facts about an asset or its sector.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "The search query." } },
          required: ["query"],
        },
      },
    ],
  },
];

async function callBackendTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "web_fetch") {
    const r = await fetch("/api/web-fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: args.url }),
    });
    const d = await r.json();
    return (d.content as string) ?? (d.error as string) ?? "No content returned.";
  }
  if (name === "web_search") {
    const r = await fetch("/api/web-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: args.query }),
    });
    const d = await r.json();
    type SR = { title: string; url: string; content: string };
    const results = d.results as SR[] | undefined;
    return results?.length
      ? results.map((x) => `${x.title}\n${x.url}\n${x.content}`).join("\n\n")
      : (d.error as string) ?? "No results.";
  }
  return "Unknown tool.";
}

// ---------------------------------------------------------------------------
// Research pass — free-form function-calling loop
// ---------------------------------------------------------------------------

const MAX_ROUNDS = 6;

async function runGeminiResearch(
  apiKey: string,
  model: string,
  analysis: Analysis,
): Promise<string> {
  const hasLinks = analysis.sources.some((s) => s.kind === "link");
  if (!hasLinks && !analysis.allowWebSearch) return "";

  const fileParts = await buildGeminiFileParts(analysis.sources);
  const userText = buildResearchUserPrompt(analysis);
  const userParts: GeminiPart[] = [...fileParts, { text: userText }];

  const contents: GeminiMessage[] = [{ role: "user", parts: userParts }];
  const parts: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: researchSystem(analysis) }] },
        contents,
        tools: GEMINI_TOOLS,
        generationConfig: { maxOutputTokens: 6000 },
      }),
    });
    if (!res.ok) throw new Error(await geminiErrorMessage(res));
    const data = await res.json();

    const candidate = data?.candidates?.[0];
    if (!candidate) break;

    const responseParts: GeminiPart[] = candidate.content?.parts ?? [];
    const modelMsg: GeminiMessage = { role: "model", parts: responseParts };
    contents.push(modelMsg);

    // Collect any text parts this turn
    for (const p of responseParts) {
      if ("text" in p && p.text) parts.push(p.text);
    }

    // Execute function calls (if any), collect results in a single user turn
    const fnCalls = responseParts.filter((p): p is GeminiFunctionCallPart => "functionCall" in p);
    if (fnCalls.length === 0) break;

    const responseMsgs: GeminiFunctionResponsePart[] = [];
    for (const fc of fnCalls) {
      let result = "";
      try {
        result = await callBackendTool(
          fc.functionCall.name,
          fc.functionCall.args as Record<string, string>,
        );
      } catch (err) {
        result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }
      responseMsgs.push({
        functionResponse: { name: fc.functionCall.name, response: { content: result } },
      });
    }
    // In Gemini, function responses go back in the "user" role
    contents.push({ role: "user", parts: responseMsgs });
  }

  return parts.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Analysis — structured output via responseSchema
// ---------------------------------------------------------------------------

async function runGeminiAnalysis(
  req: AnalysisRequest,
  researchNotes?: string,
): Promise<DebateOutput> {
  const { apiKey, model, analysis } = req;

  const fileParts = await buildGeminiFileParts(analysis.sources);
  const userText = buildAnalysisUserPrompt(analysis, researchNotes);
  const userParts: GeminiPart[] = [...fileParts, { text: userText }];

  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: analysisSystem(analysis) }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: {
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(DEBATE_JSON_SCHEMA),
      },
    }),
  });

  if (!res.ok) throw new Error(await geminiErrorMessage(res));

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Model returned an empty response.");

  try {
    return JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
}

/** Optional, on-demand expert review — structured responseSchema, no web tools. */
async function runGeminiExpertReview(req: AnalysisRequest): Promise<ExpertReview> {
  const { apiKey, model, analysis } = req;
  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: reviewSystem(analysis) }] },
      contents: [{ role: "user", parts: [{ text: buildReviewUserPrompt(analysis) }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(EXPERT_REVIEW_JSON_SCHEMA),
      },
    }),
  });

  if (!res.ok) throw new Error(await geminiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Model returned an empty review.");
  try {
    return JSON.parse(text) as ExpertReview;
  } catch {
    throw new Error("Model did not return a valid structured review.");
  }
}

// ---------------------------------------------------------------------------
// Intake — one structured call; detect vertical + extract figures
// ---------------------------------------------------------------------------

async function runGeminiIntake(req: IntakeRequest): Promise<IntakeResult> {
  const { apiKey, model, userText, sources } = req;
  const fileParts = await buildGeminiFileParts(sources);
  const userParts: GeminiPart[] = [...fileParts, { text: buildIntakeUserPrompt(userText) }];

  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: intakeSystem() }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: {
        maxOutputTokens: 3500,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(INTAKE_JSON_SCHEMA),
      },
    }),
  });

  if (!res.ok) throw new Error(await geminiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Model returned an empty intake.");
  let raw: IntakeOutput;
  try {
    raw = JSON.parse(text) as IntakeOutput;
  } catch {
    throw new Error("Model did not return valid intake output.");
  }
  return finalizeIntake(raw);
}

async function runGeminiIdeaDiscovery(req: IdeaDiscoveryRequest) {
  const { apiKey, model, prompt } = req;
  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: ideaDiscoverySystem() }] },
      contents: [{ role: "user", parts: [{ text: buildIdeaDiscoveryUserPrompt(prompt) }] }],
      generationConfig: {
        maxOutputTokens: 3500,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(IDEA_DISCOVERY_JSON_SCHEMA),
      },
    }),
  });
  if (!res.ok) throw new Error(await geminiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("AI discovery returned an empty response.");
  try {
    return finalizeIdeaDiscovery(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("AI discovery did not return valid structured output.");
    throw error;
  }
}

async function runGeminiDeeperIdeaDiscovery(req: DeeperIdeaDiscoveryRequest) {
  const { apiKey, model, prompt, direction } = req;
  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: ideaDiscoverySystem() }] },
      contents: [{ role: "user", parts: [{ text: buildDeeperIdeaDiscoveryUserPrompt(prompt, direction) }] }],
      generationConfig: {
        maxOutputTokens: 3500,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(DEEPER_IDEA_DISCOVERY_JSON_SCHEMA),
      },
    }),
  });
  if (!res.ok) throw new Error(await geminiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("AI discovery returned an empty response.");
  try {
    return finalizeDeeperIdeaDiscovery(JSON.parse(text), direction.id);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("AI discovery did not return valid structured output.");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Chat — streaming SSE via :streamGenerateContent?alt=sse
// ---------------------------------------------------------------------------

async function streamGeminiChat(req: ChatRequest): Promise<string> {
  const { apiKey, model, analysis, userText, onDelta } = req;

  const fileParts = await buildGeminiFileParts(analysis.sources);
  const preamble = chatContextPreamble(analysis);

  // Build multi-turn history: our ChatMessage uses "assistant", Gemini uses "model"
  const history: GeminiMessage[] = analysis.chat.map((m: ChatMessage) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const preambleParts: GeminiPart[] = [...fileParts, { text: preamble }];

  const contents: GeminiMessage[] = [
    { role: "user", parts: preambleParts },
    {
      role: "model",
      parts: [
        {
          text: "Understood — I have the locked figures and the prior bull/bear debate in mind. Ask away.",
        },
      ],
    },
    ...history,
    { role: "user", parts: [{ text: userText }] },
  ];

  const res = await fetch(geminiUrl(model, "streamGenerateContent", apiKey) + "&alt=sse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: CHAT_SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 4000 },
    }),
  });

  if (!res.ok || !res.body) throw new Error(await geminiErrorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        const chunk: string = evt?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }

  return full;
}

// ---------------------------------------------------------------------------
// Portfolio — structured cross-asset debate + grounded chat
// ---------------------------------------------------------------------------

async function runGeminiPortfolioAnalysis(req: PortfolioAnalysisRequest): Promise<AnalysisResult> {
  const { apiKey, model, portfolio, metrics, byId } = req;
  const res = await fetch(geminiUrl(model, "generateContent", apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: portfolioPersona().systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: buildPortfolioAnalysisUserPrompt(portfolio, metrics, byId) }] },
      ],
      generationConfig: {
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(DEBATE_JSON_SCHEMA),
      },
    }),
  });

  if (!res.ok) throw new Error(await geminiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Model returned an empty response.");
  let raw: DebateOutput;
  try {
    raw = JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
  return finalizePortfolioDebate(metrics, raw);
}

async function streamGeminiPortfolioChat(req: PortfolioChatRequest): Promise<string> {
  const { apiKey, model, portfolio, metrics, byId, userText, onDelta } = req;
  const preamble = portfolioChatContextPreamble(portfolio, metrics, byId);
  const history: GeminiMessage[] = portfolio.chat.map((m: ChatMessage) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const contents: GeminiMessage[] = [
    { role: "user", parts: [{ text: preamble }] },
    {
      role: "model",
      parts: [
        {
          text: "Understood — I have the portfolio's locked figures and each holding's figures in mind. Ask away.",
        },
      ],
    },
    ...history,
    { role: "user", parts: [{ text: userText }] },
  ];

  const res = await fetch(geminiUrl(model, "streamGenerateContent", apiKey) + "&alt=sse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: PORTFOLIO_CHAT_SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 4000 },
    }),
  });

  if (!res.ok || !res.body) throw new Error(await geminiErrorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        const chunk: string = evt?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }

  return full;
}

// ---------------------------------------------------------------------------
// Provider export
// ---------------------------------------------------------------------------

export const geminiProvider: AIProvider = {
  id: "gemini",
  label: "Google (Gemini)",
  models: GEMINI_MODELS,
  capabilities: () => GEMINI_CAPABILITIES,

  runIntake(req: IntakeRequest): Promise<IntakeResult> {
    return runGeminiIntake(req);
  },

  discoverIdeas(req: IdeaDiscoveryRequest) {
    return runGeminiIdeaDiscovery(req);
  },

  deepenIdea(req: DeeperIdeaDiscoveryRequest) {
    return runGeminiDeeperIdeaDiscovery(req);
  },

  async runAnalysis(req: AnalysisRequest): Promise<AnalysisResult> {
    let notes: string | undefined;
    if (needsResearch(req.analysis)) {
      req.onPhase?.("research");
      notes = await runGeminiResearch(req.apiKey, req.model, req.analysis);
    }
    req.onPhase?.("debate");
    const raw = await runGeminiAnalysis(req, notes);
    return finalizeDebate(req.analysis, raw);
  },

  runExpertReview(req: AnalysisRequest): Promise<ExpertReview> {
    return runGeminiExpertReview(req);
  },

  streamChat(req: ChatRequest): Promise<string> {
    return streamGeminiChat(req);
  },

  runPortfolioAnalysis(req: PortfolioAnalysisRequest): Promise<AnalysisResult> {
    return runGeminiPortfolioAnalysis(req);
  },

  streamPortfolioChat(req: PortfolioChatRequest): Promise<string> {
    return streamGeminiPortfolioChat(req);
  },
};
