/**
 * OPTIONAL live scorecard — run with `npm run eval` (never in `npm test`). Drives the
 * real provider over the fixtures and reports schema-valid %, stance-match % (model
 * result == engine derive, must be 100% by construction), and grounding-clean %
 * (measured by the deterministic linter). Gated by GEMINI_API_KEY in app/.env.local.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { personaFor, portfolioPersona, derivePortfolioStance } from "@/lib/ai/personas";
import {
  lintAnalysisGrounding,
  lintChatReply,
  lintPortfolioGrounding,
  portfolioChatExtras,
} from "@/lib/ai/grounding";
import { VERTICALS, memberFromPreset, mixedPortfolio } from "./fixtures";
import type { Analysis } from "@/lib/domain/types";

function readKey(): string {
  try {
    const txt = readFileSync(new URL("../../../../.env.local", import.meta.url), "utf8");
    const m = txt.match(/^GEMINI_API_KEY=(.+)$/m);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/high demand|overloaded|temporar|503|429/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
  throw last;
}

/** Environment limits (quota/billing/network) — not a regression; the eval soft-skips. */
function isEnvLimit(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /quota|rate.?limit|billing|exceeded|ENOTFOUND|fetch failed|network/i.test(msg);
}

const KEY = readKey();
const MODEL = "gemini-2.5-flash";

interface Row {
  name: string;
  schemaValid: boolean | null;
  stanceMatch: boolean | null;
  groundingClean: boolean;
}

describe.skipIf(!KEY)("P8 live eval scorecard (Gemini)", () => {
  const rows: Row[] = [];

  it("scores debates + chat across verticals and the portfolio", async () => {
    try {
      await runScorecard(rows);
    } catch (e) {
      if (isEnvLimit(e)) {
        console.warn(`\n[eval] soft-skip — provider environment limit: ${e instanceof Error ? e.message : e}\n`);
        return; // quota/network is not a regression
      }
      throw e;
    }
  });
});

async function runScorecard(rows: Row[]): Promise<void> {
  {
    // --- per-vertical debate + a follow-up chat ---
    for (const v of VERTICALS) {
      const a = memberFromPreset("m", v);
      const persona = personaFor(v);
      const out = await withRetry(() =>
        geminiProvider.runAnalysis({ apiKey: KEY, model: MODEL, analysis: a }),
      );
      const expectedStance = persona.stance.derive(a.metrics)?.label;
      const produced: Analysis = { ...a, ...out };
      rows.push({
        name: `${v} debate`,
        schemaValid: out.advisory.length === persona.lenses.length && out.debate.bull.length > 0 && out.debate.bear.length > 0,
        stanceMatch: expectedStance == null ? null : out.stance?.label === expectedStance,
        groundingClean: lintAnalysisGrounding(produced).clean,
      });

      if (v === "stocks") {
        const reply = await withRetry(() =>
          geminiProvider.streamChat({
            apiKey: KEY, model: MODEL, analysis: produced,
            userText: "Stress-test the bear case in one sentence, citing a locked figure.",
            onDelta: () => {},
          }),
        );
        rows.push({ name: `${v} chat`, schemaValid: null, stanceMatch: null, groundingClean: lintChatReply(reply, a.metrics.metrics).clean });
      }
    }

    // --- portfolio debate + chat ---
    const { portfolio, metrics, byId } = mixedPortfolio();
    const pPersona = portfolioPersona();
    const pOut = await withRetry(() =>
      geminiProvider.runPortfolioAnalysis({ apiKey: KEY, model: MODEL, portfolio, metrics, byId }),
    );
    const producedP = { ...portfolio, ...pOut };
    rows.push({
      name: "portfolio debate",
      schemaValid: pOut.advisory.length === pPersona.lenses.length && pOut.debate.bull.length > 0 && pOut.debate.bear.length > 0,
      stanceMatch: pOut.stance?.label === derivePortfolioStance(metrics)?.label,
      groundingClean: lintPortfolioGrounding(producedP, metrics, byId).clean,
    });

    const pExtra = portfolioChatExtras(metrics, byId);
    const pReply = await withRetry(() =>
      geminiProvider.streamPortfolioChat({
        apiKey: KEY, model: MODEL, portfolio: producedP, metrics, byId,
        userText: "Which holding carries the most concentration risk? Reference the locked weight.",
        onDelta: () => {},
      }),
    );
    rows.push({ name: "portfolio chat", schemaValid: null, stanceMatch: null, groundingClean: lintChatReply(pReply, pExtra.metrics, pExtra.extra).clean });

    // --- scorecard ---
    const pct = (xs: (boolean | null)[]) => {
      const vals = xs.filter((x): x is boolean => x !== null);
      return vals.length ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : 100;
    };
    console.log("\n================ P8 EVAL SCORECARD (Gemini " + MODEL + ") ================");
    for (const r of rows) {
      const cell = (b: boolean | null) => (b === null ? "  — " : b ? " ✓  " : " ✗  ");
      console.log(`  ${r.name.padEnd(18)} schema${cell(r.schemaValid)} stance${cell(r.stanceMatch)} grounded${cell(r.groundingClean)}`);
    }
    console.log("  ----------------------------------------------------------------");
    console.log(`  schema-valid:   ${pct(rows.map((r) => r.schemaValid))}%`);
    console.log(`  stance-match:   ${pct(rows.map((r) => r.stanceMatch))}%   (engine-derived — expect 100%)`);
    console.log(`  grounding-clean:${pct(rows.map((r) => r.groundingClean))}%   (measured; model slips OR parser false-positives lower it)`);
    console.log("================================================================\n");

    // Hard gates: schema + engine-derived stance must always hold. Grounding is measured.
    expect(pct(rows.map((r) => r.schemaValid))).toBe(100);
    expect(pct(rows.map((r) => r.stanceMatch))).toBe(100);
  }
}
