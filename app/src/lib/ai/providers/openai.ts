/**
 * OpenAI adapter — implements AIProvider over the OpenAI Chat Completions API.
 * Called directly from the browser (BYOK; key never leaves the user's machine).
 *
 * Capability differences vs. Anthropic:
 *  - vision: native image_url blocks ✓
 *  - pdfNative: false → pdf.js text extraction fallback
 *  - webFetchNative / webSearchNative: false → thin-backend tool loop (P6.3)
 *    Client calls /api/web-fetch and /api/web-search; the server-side routes
 *    bypass CORS and hold the Tavily key. Provider key stays browser-only.
 *
 * Structured debate uses response_format json_schema (strict mode).
 * Chat uses streaming SSE (choices[0].delta.content).
 * Research uses the OpenAI function-tool loop driving the backend routes.
 */
import type { AIProvider, AnalysisRequest, AnalysisResult, ChatRequest, IntakeRequest, Capabilities, ModelOption } from "../types";
import type { DebateOutput, ExpertReview, IntakeOutput, IntakeResult } from "../schemas";
import { DEBATE_JSON_SCHEMA, EXPERT_REVIEW_JSON_SCHEMA, INTAKE_JSON_SCHEMA } from "../schemas";
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
} from "../prompts";
import { needsResearch, finalizeDebate, finalizeIntake } from "../analyze";
import { blobToBase64 } from "../content";
import { extractPdfText } from "../pdf";
import { getBlob } from "@/lib/repo";
import type { Analysis, ContextSource, ChatMessage } from "@/lib/domain/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function openaiHeaders(apiKey: string): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

async function openaiErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ? `${body.error.message}` : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

const OPENAI_CAPABILITIES: Capabilities = {
  vision: true,
  pdfNative: false,
  webFetchNative: false,
  webSearchNative: false,
};

export const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-4o", label: "GPT-4o — most capable" },
  { id: "gpt-4o-mini", label: "GPT-4o mini — fast / cheap" },
  { id: "o3-mini", label: "o3-mini — reasoning" },
];

// ---------------------------------------------------------------------------
// Content blocks — OpenAI format
// ---------------------------------------------------------------------------

type OpenAIContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Build OpenAI-format content blocks for file sources.
 *  - images → image_url with base64 data URL
 *  - PDFs   → text block with pdf.js-extracted text
 * Links are passed to the backend tool loop, not here.
 */
async function buildOpenAIFileBlocks(sources: ContextSource[]): Promise<OpenAIContentBlock[]> {
  const blocks: OpenAIContentBlock[] = [];
  for (const s of sources) {
    if (s.kind !== "file") continue;
    const blob = await getBlob(s.blobId);
    if (!blob) continue;

    if (s.fileKind === "image") {
      const data = await blobToBase64(blob);
      blocks.push({ type: "image_url", image_url: { url: `data:${s.mime};base64,${data}` } });
    } else {
      let text = "";
      try {
        text = await extractPdfText(blob);
      } catch {
        text = "(PDF text extraction failed — contents unavailable)";
      }
      blocks.push({ type: "text", text: `[Document: ${s.name}]\n${text}` });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Tool definitions for the backend tool loop
// ---------------------------------------------------------------------------

const TOOL_WEB_FETCH = {
  type: "function",
  function: {
    name: "web_fetch",
    description:
      "Fetch the full text content of a URL. Use for reading attached links or any other relevant page.",
    parameters: {
      type: "object",
      properties: { url: { type: "string", description: "The https:// URL to fetch." } },
      required: ["url"],
      additionalProperties: false,
    },
    strict: true,
  },
} as const;

const TOOL_WEB_SEARCH = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current, decision-relevant facts about an asset or its sector.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "The search query." } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
} as const;

// ---------------------------------------------------------------------------
// Research pass — free-form, drives the backend tool loop
// ---------------------------------------------------------------------------

// Flexible message union for the tool-use conversation thread.
type OAIMessage =
  | { role: "system" | "user" | "assistant"; content: unknown; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

async function callTool(name: string, args: Record<string, string>): Promise<string> {
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
    type SearchResult = { title: string; url: string; content: string };
    const results = d.results as SearchResult[] | undefined;
    return results?.length
      ? results.map((x) => `${x.title}\n${x.url}\n${x.content}`).join("\n\n")
      : (d.error as string) ?? "No results.";
  }
  return "Unknown tool.";
}

const MAX_TOOL_ROUNDS = 6;

export async function runOpenAIResearch(
  apiKey: string,
  model: string,
  analysis: Analysis,
): Promise<string> {
  const tools: (typeof TOOL_WEB_FETCH | typeof TOOL_WEB_SEARCH)[] = [];
  if (analysis.sources.some((s) => s.kind === "link")) tools.push(TOOL_WEB_FETCH);
  if (analysis.allowWebSearch) tools.push(TOOL_WEB_SEARCH);
  if (tools.length === 0) return "";

  const fileBlocks = await buildOpenAIFileBlocks(analysis.sources);
  const userText = buildResearchUserPrompt(analysis);
  const userContent: OpenAIContentBlock[] = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: userText }]
    : [{ type: "text", text: userText }];

  const messages: OAIMessage[] = [
    { role: "system", content: researchSystem(analysis) },
    { role: "user", content: userContent },
  ];

  const parts: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: openaiHeaders(apiKey),
      body: JSON.stringify({ model, max_tokens: 6000, messages, tools, tool_choice: "auto" }),
    });
    if (!res.ok) throw new Error(await openaiErrorMessage(res));
    const data = await res.json();

    const choice = data?.choices?.[0];
    if (!choice) break;

    const assistantText: string = choice.message?.content ?? "";
    if (assistantText) parts.push(assistantText);

    if (choice.finish_reason !== "tool_calls") break;

    // Append the assistant message (carries tool_calls) to thread
    messages.push(choice.message as OAIMessage);

    // Execute each tool call via the backend routes, append results
    for (const tc of (choice.message.tool_calls ?? []) as ToolCall[]) {
      let result = "";
      try {
        const args = JSON.parse(tc.function.arguments) as Record<string, string>;
        result = await callTool(tc.function.name, args);
      } catch (err) {
        result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  return parts.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Structured debate pass — response_format json_schema
// ---------------------------------------------------------------------------

async function runOpenAIAnalysis(req: AnalysisRequest, researchNotes?: string): Promise<DebateOutput> {
  const { apiKey, model, analysis } = req;

  const fileBlocks = await buildOpenAIFileBlocks(analysis.sources);
  const userText = buildAnalysisUserPrompt(analysis, researchNotes);
  const userContent: OpenAIContentBlock[] = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: userText }]
    : [{ type: "text", text: userText }];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: openaiHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [
        { role: "system", content: analysisSystem(analysis) },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "debate", strict: true, schema: DEBATE_JSON_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw new Error(await openaiErrorMessage(res));

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Model returned an empty response.");

  try {
    return JSON.parse(text) as DebateOutput;
  } catch {
    throw new Error("Model did not return valid structured output.");
  }
}

/** Optional, on-demand expert review — structured json_schema, no web tools. */
async function runOpenAIExpertReview(req: AnalysisRequest): Promise<ExpertReview> {
  const { apiKey, model, analysis } = req;
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: openaiHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [
        { role: "system", content: reviewSystem(analysis) },
        { role: "user", content: buildReviewUserPrompt(analysis) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "expert_review", strict: true, schema: EXPERT_REVIEW_JSON_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw new Error(await openaiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
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

async function runOpenAIIntake(req: IntakeRequest): Promise<IntakeResult> {
  const { apiKey, model, userText, sources } = req;
  const fileBlocks = await buildOpenAIFileBlocks(sources);
  const userPrompt = buildIntakeUserPrompt(userText);
  const userContent: OpenAIContentBlock[] = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: userPrompt }]
    : [{ type: "text", text: userPrompt }];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: openaiHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: intakeSystem() },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "intake", strict: true, schema: INTAKE_JSON_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw new Error(await openaiErrorMessage(res));
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Model returned an empty intake.");
  let raw: IntakeOutput;
  try {
    raw = JSON.parse(text) as IntakeOutput;
  } catch {
    throw new Error("Model did not return valid intake output.");
  }
  return finalizeIntake(raw);
}

// ---------------------------------------------------------------------------
// Chat — streaming SSE via choices[0].delta.content
// ---------------------------------------------------------------------------

async function streamOpenAIChat(req: ChatRequest): Promise<string> {
  const { apiKey, model, analysis, userText, onDelta } = req;

  const history = analysis.chat.map((m: ChatMessage) => ({ role: m.role, content: m.content }));
  const fileBlocks = await buildOpenAIFileBlocks(analysis.sources);
  const preamble = chatContextPreamble(analysis);
  const preambleContent: OpenAIContentBlock[] = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: preamble }]
    : [{ type: "text", text: preamble }];

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: openaiHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      stream: true,
      messages: [
        { role: "system", content: CHAT_SYSTEM },
        { role: "user", content: preambleContent },
        {
          role: "assistant",
          content:
            "Understood — I have the locked figures and the prior bull/bear debate in mind. Ask away.",
        },
        ...history,
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok || !res.body) throw new Error(await openaiErrorMessage(res));

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
        const delta: string = evt?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta);
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

export const openaiProvider: AIProvider = {
  id: "openai",
  label: "OpenAI (GPT)",
  models: OPENAI_MODELS,
  capabilities: () => OPENAI_CAPABILITIES,

  runIntake(req: IntakeRequest): Promise<IntakeResult> {
    return runOpenAIIntake(req);
  },

  async runAnalysis(req: AnalysisRequest): Promise<AnalysisResult> {
    let notes: string | undefined;
    if (needsResearch(req.analysis)) {
      req.onPhase?.("research");
      notes = await runOpenAIResearch(req.apiKey, req.model, req.analysis);
    }
    req.onPhase?.("debate");
    const raw = await runOpenAIAnalysis(req, notes);
    return finalizeDebate(req.analysis, raw);
  },

  runExpertReview(req: AnalysisRequest): Promise<ExpertReview> {
    return runOpenAIExpertReview(req);
  },

  streamChat(req: ChatRequest): Promise<string> {
    return streamOpenAIChat(req);
  },
};
