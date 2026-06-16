/**
 * The written report posted in chat after intake locks the figures and the
 * debate runs. PURE and templated — it assembles a markdown string from data the
 * pipeline already produced (engine metrics, the engine-derived stance, the
 * persona debate/advisory). It NEVER introduces a number of its own: every figure
 * it prints is a `display` string the deterministic engine emitted. (An AI-written
 * report is a later upgrade; this keeps the no-numeric-hallucination guarantee.)
 */
import type { Analysis } from "@/lib/domain/types";
import { isEngineAnalysis } from "@/lib/domain/manualAssets";

/** Build the markdown report string from a produced analysis. */
export function buildReport(a: Analysis): string {
  const name = a.assetName?.trim() || a.title?.trim() || "This asset";
  const blocks: string[] = [];

  // Headline: the engine-derived stance + the AI's one-line basis (no new numbers).
  if (a.stance) {
    blocks.push(`**${name} — ${a.stance.label}.** ${a.stance.basis}`);
  } else {
    blocks.push(`**${name}.**`);
  }

  // Thesis-support framing — explicitly an analyst read, not an action.
  if (a.debate) {
    blocks.push(
      `Thesis support: **${a.debate.thesisSupport}**. This is an analyst read of how well the locked figures back the case — not a buy/sell call. The decision stays yours.`,
    );
  }

  // Locked figures — each printed verbatim from the engine's display strings.
  const figs = isEngineAnalysis(a)
    ? a.metrics.metrics.map(
    (m) => `- ${m.label}: **${m.display}**${m.verdict ? ` _(${m.verdict})_` : ""}`,
      )
    : [];
  if (figs.length) {
    blocks.push("**Locked figures**");
    blocks.push(figs.join("\n"));
  }

  // The crux of each side — the first (lead) line the persona produced.
  if (a.debate) {
    const bull = a.debate.bull[0];
    const bear = a.debate.bear[0];
    if (bull) blocks.push(`**Bull crux** — ${bull.text}`);
    if (bear) blocks.push(`**Bear crux** — ${bear.text}`);
  }

  // Advisory board — lens name → verdict word (a stance label, never an action).
  if (a.advisory && a.advisory.length) {
    blocks.push("**Advisory board**");
    blocks.push(a.advisory.map((l) => `- ${l.name}: **${l.verdict}**`).join("\n"));
  }

  return blocks.join("\n\n");
}
