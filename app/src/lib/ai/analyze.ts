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
  INTAKE_JSON_SCHEMA,
  type DebateOutput,
  type ExpertReview,
  type IntakeOutput,
  type IntakeResult,
  type IntakeField,
} from "./schemas";
import {
  analysisSystem,
  researchSystem,
  reviewSystem,
  intakeSystem,
  buildAnalysisUserPrompt,
  buildResearchUserPrompt,
  buildReviewUserPrompt,
  buildIntakeUserPrompt,
  buildPortfolioAnalysisUserPrompt,
} from "./prompts";
import { buildFileBlocks } from "./content";
import { personaFor, portfolioPersona } from "./personas";
import { BLANK_PARAMS, type AssetParameters, type Vertical } from "@/data/presets";
import { paramKeysFor, FIELDS } from "@/data/fields";
import type {
  Analysis,
  ContextSource,
  DebateLine,
  LensResult,
  PortfolioAnalysis,
  PortfolioMetrics,
} from "@/lib/domain/types";
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

/* --------------------------------------------------------------- portfolio */

/**
 * Portfolio-level structured debate (cross-asset). One structured call, no web
 * research pass — the grounding is the deterministic portfolio metrics + each
 * member's locked figures. Anthropic path; OpenAI/Gemini implement inline then call
 * the shared `finalizePortfolioDebate`.
 */
export async function runPortfolioAnalysis(
  apiKey: string,
  model: string,
  portfolio: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): Promise<AnalysisResult> {
  const userText = buildPortfolioAnalysisUserPrompt(portfolio, metrics, byId);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: portfolioPersona().systemPrompt,
      messages: [{ role: "user", content: userText }],
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
  return finalizePortfolioDebate(metrics, raw);
}

/**
 * Validate + zip the portfolio debate against the Portfolio Strategist contract, and
 * attach the ENGINE-DERIVED portfolio stance (the model never authors the label).
 * Pure — the unit-testable core, shared by all three providers. Mirrors
 * `finalizeDebate`, but the stance derives from `PortfolioMetrics`.
 */
export function finalizePortfolioDebate(metrics: PortfolioMetrics, raw: DebateOutput): AnalysisResult {
  const persona = portfolioPersona();
  const slotIds = new Set(persona.debateSlots.map((s) => s.id));
  const clamp = (l: DebateLine): DebateLine => ({
    agent: l.agent,
    text: l.text,
    slot: l.slot && slotIds.has(l.slot) ? l.slot : undefined,
  });
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
  const derived = persona.stance.derive(metrics);
  const stance = derived
    ? { label: derived.label, basis: raw.stanceBasis?.trim() || derived.basis }
    : null;
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

/* ----------------------------------------------------------------- intake */

const VERTICALS: Vertical[] = ["stocks", "startups", "conventional"];

/**
 * Validate + zip the raw intake output into an engine-ready draft. PURE — the
 * unit-testable core, shared by all three providers. This is the one place
 * numbers enter from prose, so the guards matter:
 *  - clamp `vertical`/`mode`/`source` to known values (Gemini strips schema enums)
 *  - drop fields whose key isn't an engine param for the chosen vertical
 *  - coerce values to finite numbers (drop the rest)
 *  - merge BLANK_PARAMS so the engine always computes cleanly
 * The model never authors a stance; that stays `persona.stance.derive` downstream.
 */
export function finalizeIntake(raw: IntakeOutput): IntakeResult {
  const vertical: Vertical = VERTICALS.includes(raw?.vertical as Vertical)
    ? (raw.vertical as Vertical)
    : "stocks";

  const allowed = new Set(paramKeysFor(vertical).map(String));
  // percent_raw fields are fractions (0–1); a value >1 is a whole-percent misread.
  const rawPctKeys = new Set(FIELDS[vertical].filter((f) => f.type === "percent_raw").map((f) => String(f.key)));
  const fields: IntakeField[] = [];
  const numbers: Record<string, number> = {};
  for (const f of raw?.fields ?? []) {
    if (!f || typeof f.key !== "string" || !allowed.has(f.key)) continue;
    let value = Number(f.value);
    if (!Number.isFinite(value)) continue;
    // Defensive unit guard: the model sometimes emits 70 for a 70% fraction field.
    // Every percent_raw field caps below 1, so any value >1 is a /100 unit error.
    if (rawPctKeys.has(f.key) && value > 1) value = value / 100;
    const source: IntakeField["source"] = f.source === "stated" ? "stated" : "inferred";
    fields.push({ key: f.key, value, source });
    numbers[f.key] = value;
  }

  // Mode is DERIVED from what we actually extracted, not the model's opinion: any
  // kept figure ⇒ figures (the confirm card still gates inferred values before they
  // lock); nothing extractable ⇒ scoping (pre-numbers / macro questions). This keeps
  // the figures/scoping decision deterministic instead of trusting a flaky label.
  const mode: IntakeResult["mode"] = fields.length >= 1 ? "figures" : "scoping";

  const params: AssetParameters = { ...BLANK_PARAMS[vertical], ...numbers };
  // Stocks DCF needs a cashflow series, but `cashflows` isn't an extractable field
  // (not in paramKeysFor), so always proxy a flat-EPS stream from the resolved EPS —
  // keeps DCF/NPV/MoS consistent with the EPS the user actually gave. Surfaced as an
  // approximation on the confirm card.
  if (vertical === "stocks") {
    const eps = Number(params.eps ?? 0);
    params.cashflows = Array(5).fill(eps);
  }

  return {
    vertical,
    mode,
    assetName: typeof raw?.assetName === "string" ? raw.assetName : "",
    title: (typeof raw?.title === "string" && raw.title.trim()) || "New analysis",
    note: typeof raw?.note === "string" ? raw.note : "",
    fields,
    params,
  };
}

/**
 * Intake pass — one structured call that detects the vertical and extracts the
 * engine parameters from the user's text + attachments. Returns the finalized,
 * confirm-ready draft. Anthropic path; OpenAI/Gemini implement inline then call
 * the shared `finalizeIntake`.
 */
export async function runIntake(
  apiKey: string,
  model: string,
  userText: string,
  sources: ContextSource[],
): Promise<IntakeResult> {
  const fileBlocks = await buildFileBlocks(sources);
  const userPrompt = buildIntakeUserPrompt(userText);
  const content = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: userPrompt }]
    : userPrompt;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: intakeSystem(),
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: INTAKE_JSON_SCHEMA } },
    }),
  });

  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  const text = collectText(data.content);
  if (!text.trim()) throw new Error("Model returned an empty intake.");
  let raw: IntakeOutput;
  try {
    raw = JSON.parse(text) as IntakeOutput;
  } catch {
    throw new Error("Model did not return valid intake output.");
  }
  return finalizeIntake(raw);
}
