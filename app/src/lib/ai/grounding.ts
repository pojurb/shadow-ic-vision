/**
 * Deterministic grounding linter — the load-bearing no-numeric-hallucination guard.
 *
 * The prompt + structured schema ask the model not to invent numbers, but nothing
 * deterministically checks the model's FREE TEXT (debate lines, advisory text,
 * stanceBasis, chat replies). This module does: it parses every number-like token in
 * the prose to a value and flags any that doesn't trace to an engine figure.
 *
 * Design (see P8 plan):
 *  - Compare numeric VALUES, not strings — robust to id-ID formatting (`.` thousands /
 *    `,` decimal), `Rp`, `%`, `x`, and `B`/`M`/`T` magnitudes (see finance/format.ts).
 *  - Ambiguous separators (e.g. "4.940" = 4.94 or 4940) parse to BOTH candidates; a
 *    token is grounded if ANY candidate matches — keeping false positives near zero.
 *  - FLAG, don't block: a flag means "a human should glance", never edits the prose.
 *  - PURE (no JSX/IO) so the UI and the eval harness share one implementation.
 */
import type { Analysis, Metric, PortfolioAnalysis, PortfolioMetrics } from "@/lib/domain/types";

export interface GroundingFlag {
  /** The text the token appeared in. */
  text: string;
  /** The raw matched token, e.g. "Rp 4,2B" or "30%". */
  raw: string;
  /** The primary parsed value (first candidate interpretation). */
  value: number;
}

export interface GroundingResult {
  clean: boolean;
  flagged: GroundingFlag[];
}

interface NumberToken {
  raw: string;
  /** Plausible numeric interpretations (≥1; >1 when separators are ambiguous). */
  values: number[];
  /** True when the token carries a unit (%, x, magnitude, or Rp) → always checked. */
  unit: boolean;
}

const MAGNITUDE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

/**
 * A number core: optional sign, digits with `.`/`,` separators. Optional `Rp` prefix
 * and an optional unit suffix (`%`, `x`/`×`, or a magnitude letter not followed by
 * another letter — so "24.3 mo" does NOT read `m` as mega).
 */
const TOKEN_RE = /(Rp\s*)?(-?\d[\d.,]*\d|-?\d)\s*(%|x|×|[kmbt](?![a-z]))?/gi;

/** Parse a separator-bearing core into all plausible numeric interpretations. */
function parseCore(core: string): number[] {
  const hasDot = core.includes(".");
  const hasComma = core.includes(",");
  const out = new Set<number>();
  if (hasDot && hasComma) {
    // The last separator is the decimal point; the other groups thousands.
    if (core.lastIndexOf(",") > core.lastIndexOf(".")) {
      out.add(Number(core.replace(/\./g, "").replace(",", "."))); // id-ID
    } else {
      out.add(Number(core.replace(/,/g, ""))); // en-US
    }
  } else if (hasComma) {
    out.add(Number(core.replace(",", "."))); // comma-decimal (id-ID)
    out.add(Number(core.replace(/,/g, ""))); // comma-thousands (en-US)
  } else if (hasDot) {
    out.add(Number(core)); // dot-decimal (en-US)
    out.add(Number(core.replace(/\./g, ""))); // dot-thousands (id-ID)
  } else {
    out.add(Number(core));
  }
  return [...out].filter((n) => Number.isFinite(n));
}

/** Pull every number-like token from a string with its plausible values + unit flag. */
export function extractNumberTokens(text: string): NumberToken[] {
  if (!text) return [];
  const tokens: NumberToken[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const [, rp, core, suffix] = m;
    if (!core) continue;
    const sfx = (suffix ?? "").toLowerCase();
    const mag = MAGNITUDE[sfx] ?? 1;
    const unit = !!rp || !!suffix; // Rp / % / x / magnitude all make it a figure
    const values = parseCore(core).map((v) => v * mag);
    if (values.length === 0) continue;
    tokens.push({ raw: m[0].trim(), values, unit });
  }
  return tokens;
}

/** The legitimate value set: each metric.value + every number in its display + extras. */
export function allowedValues(metrics: Metric[], extra: number[] = []): number[] {
  const vals = new Set<number>();
  for (const m of metrics) {
    if (Number.isFinite(m.value)) vals.add(m.value);
    for (const t of extractNumberTokens(m.display)) for (const v of t.values) vals.add(v);
  }
  for (const e of extra) if (Number.isFinite(e)) vals.add(e);
  return [...vals];
}

function matchesAllowed(v: number, allowed: number[]): boolean {
  for (const a of allowed) {
    if (a === v) return true;
    const tol = Math.max(Math.abs(a), Math.abs(v)) * 0.02; // ~2% rounding slack
    if (Math.abs(a - v) <= tol) return true;
  }
  return false;
}

/** Bare (unit-less) integers that are almost always counts / durations / years. */
function whitelistedBare(v: number): boolean {
  if (!Number.isInteger(v)) return false;
  if (Math.abs(v) <= 100) return true; // counts, ordinals, durations, small percents-as-words
  if (v >= 1900 && v <= 2100) return true; // years
  return false;
}

function tokenGrounded(tok: NumberToken, allowed: number[]): boolean {
  if (tok.values.some((v) => matchesAllowed(v, allowed))) return true;
  if (tok.unit) return false; // a unit-bearing figure must trace to the engine
  return tok.values.some((v) => whitelistedBare(v));
}

/** Core linter: flag any number in `texts` not traceable to the engine `metrics`. */
export function lintGrounding(opts: {
  texts: string[];
  metrics: Metric[];
  extra?: number[];
}): GroundingResult {
  const allowed = allowedValues(opts.metrics, opts.extra ?? []);
  const flagged: GroundingFlag[] = [];
  for (const text of opts.texts) {
    for (const tok of extractNumberTokens(text)) {
      if (!tokenGrounded(tok, allowed)) {
        flagged.push({ text, raw: tok.raw, value: tok.values[0] });
      }
    }
  }
  return { clean: flagged.length === 0, flagged };
}

/* --------------------------------------------------------------- gatherers */

/** All model-authored prose on a single analysis (debate + advisory + stanceBasis). */
function analysisTexts(a: Analysis): string[] {
  const texts: string[] = [];
  if (a.debate) for (const l of [...a.debate.bull, ...a.debate.bear]) texts.push(l.text);
  for (const l of a.advisory ?? []) {
    texts.push(l.verdict);
    texts.push(l.text);
  }
  if (a.stance) texts.push(a.stance.basis);
  return texts;
}

export function lintAnalysisGrounding(a: Analysis): GroundingResult {
  return lintGrounding({ texts: analysisTexts(a), metrics: a.metrics.metrics });
}

export function lintPortfolioGrounding(
  p: PortfolioAnalysis,
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): GroundingResult {
  const texts: string[] = [];
  if (p.debate) for (const l of [...p.debate.bull, ...p.debate.bear]) texts.push(l.text);
  for (const l of p.advisory ?? []) {
    texts.push(l.verdict);
    texts.push(l.text);
  }
  if (p.stance) texts.push(p.stance.basis);

  // Allow portfolio figures + each holding's own figures + weights/capital.
  const allMetrics = [...metrics.metrics];
  const extra: number[] = [];
  for (const pos of metrics.positions) {
    extra.push(Math.round(pos.weight * 100), pos.capital);
    const m = byId.get(pos.analysisId);
    if (m) allMetrics.push(...m.metrics.metrics);
  }
  return lintGrounding({ texts, metrics: allMetrics, extra });
}

/** Lint one chat reply against a metric set (+ optional extra allowed values). */
export function lintChatReply(text: string, metrics: Metric[], extra: number[] = []): GroundingResult {
  return lintGrounding({ texts: [text], metrics, extra });
}

/** Allowed-value extras for portfolio chat (member figures + weights/capital). */
export function portfolioChatExtras(
  metrics: PortfolioMetrics,
  byId: Map<string, Analysis>,
): { metrics: Metric[]; extra: number[] } {
  const allMetrics = [...metrics.metrics];
  const extra: number[] = [];
  for (const pos of metrics.positions) {
    extra.push(Math.round(pos.weight * 100), pos.capital);
    const m = byId.get(pos.analysisId);
    if (m) allMetrics.push(...m.metrics.metrics);
  }
  return { metrics: allMetrics, extra };
}
