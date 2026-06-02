/**
 * Per-vertical expert analyst personas — the shared contract consumed by the
 * prompt layer (analysis + review), the structured-output validator, and the UI
 * (persona badge, debate slot tags, lens set, engine-derived stance).
 *
 * Design rules (load-bearing):
 *  - GROUNDING: every persona prompt keeps the no-numeric-hallucination rule — the
 *    model reasons qualitatively but only uses the locked deterministic figures.
 *  - STANCE IS ENGINE-DERIVED: `stance.derive(metrics)` is a pure function over the
 *    deterministic metrics. The model NEVER authors the stance label (only a one-line
 *    `stanceBasis` justification that must reference the locked verdicts). This is the
 *    guarantee that the headline verdict can't be hallucinated.
 *  - The debate slots and lens set are per vertical; they map to metrics the engine
 *    actually computes (see `compute.ts`), so an argument can always cite a real figure.
 */
import type { Vertical } from "@/data/presets";
import type { ComputedMetrics, Metric } from "@/lib/domain/types";

export type ThesisSupport = "STRONG" | "MIXED" | "THIN";

export interface SlotSpec {
  id: string;
  name: string;
}

export interface LensSpec {
  id: string;
  name: string;
}

export interface StanceSpec {
  /** All labels this vertical's stance can take, best→worst. */
  labels: [string, string, string];
  /** Pure derivation from the deterministic metrics. null when inputs are missing. */
  derive(metrics: ComputedMetrics): { label: string; basis: string } | null;
}

export interface Persona {
  id: string;
  vertical: Vertical;
  /** Visible identity, e.g. "Equity Analyst". */
  label: string;
  /** One-line description for tooltip / header. */
  blurb: string;
  /** System prompt for the structured analysis pass (replaces the generic one). */
  systemPrompt: string;
  /** System prompt for the optional, on-demand expert-review pass. */
  reviewSystemPrompt: string;
  /** The four debate-rubric slots each side must cover. */
  debateSlots: SlotSpec[];
  /** The advisory lens set (one verdict + take per lens). */
  lenses: LensSpec[];
  stance: StanceSpec;
}

/* ------------------------------------------------------------------ helpers */

const byKey = (m: ComputedMetrics, key: string): Metric | undefined =>
  m.metrics.find((x) => x.key === key);

/** Shared, non-negotiable rule block — identical wording across personas. */
const GROUNDING_RULES = `NON-NEGOTIABLE RULES:
1. GROUNDING: Use ONLY the numeric figures provided in the user message ("Locked figures"). Never invent, recompute, or alter a number. Reference any metric by its provided value verbatim. Qualitative reasoning is welcome; fabricated numbers are not.
2. BALANCE: The Bull and Bear sides must be roughly symmetric in strength and specificity — do not stack one side.
3. You are an analyst, not a decision-maker. Never tell the human to buy or sell; present the case for judgement.`;

interface PersonaSpec {
  id: string;
  vertical: Vertical;
  label: string;
  blurb: string;
  role: string;
  expertise: string;
  /** What STRONG / MIXED / THIN means for this vertical's thesis support. */
  thesisGuidance: string;
  debateSlots: SlotSpec[];
  lenses: LensSpec[];
  stance: StanceSpec;
}

function slotList(slots: SlotSpec[]): string {
  return slots.map((s) => s.name).join(", ");
}

function lensList(lenses: LensSpec[]): string {
  return lenses.map((l) => `${l.name} (id "${l.id}")`).join("; ");
}

function buildSystemPrompt(spec: PersonaSpec): string {
  return `You are ${spec.role}. ${spec.expertise}

You produce a balanced Bull-vs-Bear debate and an advisory board for a single asset, to support a human decision-maker.

${GROUNDING_RULES}
4. DEBATE RUBRIC: Each of the Bull and Bear sides must cover all four slots — ${slotList(
    spec.debateSlots,
  )}. Tag each debate line with its slot. Where a slot maps to a locked figure, cite that figure.
5. ADVISORY LENSES: Produce exactly one lens object per lens, in this set — ${lensList(
    spec.lenses,
  )}. Each lens gets a short "verdict" (a 1–2 word stance/quality label, NEVER a buy/sell action) and a concrete 2–4 sentence "text".
6. THESIS SUPPORT: Output thesisSupport as one of STRONG / MIXED / THIN. ${spec.thesisGuidance} This replaces any numeric confidence score.
7. STANCE BASIS: Provide a one-line stanceBasis that justifies the asset's standing using ONLY the locked verdicts/figures. You do NOT choose the stance label itself — the deterministic engine derives it.

Return the structured object only.`;
}

function buildReviewPrompt(spec: PersonaSpec): string {
  return `You are ${spec.role}, now red-teaming a colleague's completed analysis of a single asset before it reaches the decision-maker. Be sharp and specific; your job is to improve the quality of the call, not to re-run it.

${GROUNDING_RULES}

Review the provided debate + advisory against the locked figures and produce:
- verdictLine: one sentence on whether the analysis is sound / needs work / off-track.
- strengths: the genuinely well-grounded points.
- gaps: weak, vague, or unsupported arguments, and decision-relevant angles that are missing (especially for ${slotList(
    spec.debateSlots,
  )}).
- groundingCheck: explicitly flag ANY number in the analysis that is not present verbatim in the Locked figures (a grounding-integrity pass). State "clean" if every figure traces to the locked set.
- whatWouldChangeMyMind: the specific evidence or figure changes that would flip the thesis.

Return the structured object only.`;
}

function compose(spec: PersonaSpec): Persona {
  return {
    id: spec.id,
    vertical: spec.vertical,
    label: spec.label,
    blurb: spec.blurb,
    debateSlots: spec.debateSlots,
    lenses: spec.lenses,
    stance: spec.stance,
    systemPrompt: buildSystemPrompt(spec),
    reviewSystemPrompt: buildReviewPrompt(spec),
  };
}

/* --------------------------------------------------------------- registry */

const SPECS: Record<Vertical, PersonaSpec> = {
  /* ===================== STOCKS — Equity Analyst ===================== */
  stocks: {
    id: "equity-analyst",
    vertical: "stocks",
    label: "Equity Analyst",
    blurb: "Senior buy-side equity analyst — valuation, franchise quality, catalysts, rate risk.",
    role: "a senior buy-side equity analyst with 20+ years in emerging-market and Indonesian equities",
    expertise:
      "You think valuation-first (P/E, intrinsic value/DCF, margin of safety), interrogate the durability of returns (ROE quality and mean-reversion), separate cheapness from a value trap (catalyst), and you know most of a DCF's value usually sits in the terminal multiple — so you stress what the thesis is most fragile to (rates, terminal assumptions).",
    thesisGuidance:
      "STRONG = valuation and quality both cite supportive locked verdicts; MIXED = the figures are split or a key driver is qualitative; THIN = the case leans mostly on narrative, not the locked figures.",
    debateSlots: [
      { id: "valuation", name: "Valuation" },
      { id: "quality", name: "Quality" },
      { id: "catalyst", name: "Catalyst" },
      { id: "risk", name: "Risk" },
    ],
    lenses: [
      { id: "valuation", name: "Valuation" },
      { id: "quality", name: "Quality" },
      { id: "catalyst", name: "Catalyst" },
      { id: "risk", name: "Risk Manager" },
    ],
    stance: {
      labels: ["UNDERVALUED", "FAIR", "OVERVALUED"],
      derive(m) {
        const pe = byKey(m, "pe");
        const mos = byKey(m, "mos");
        if (!pe || !mos) return null;
        const cheap = pe.verdict === "DISCOUNT";
        const rich = pe.verdict === "PREMIUM";
        const mosPos = mos.value > 0;
        const basis = `P/E ${pe.display} ${pe.verdict ?? ""}, margin of safety ${mos.display}`.trim();
        if (cheap && mosPos) return { label: "UNDERVALUED", basis };
        if (rich || !mosPos) return { label: "OVERVALUED", basis };
        return { label: "FAIR", basis };
      },
    },
  },

  /* ===================== STARTUPS — Venture Analyst ===================== */
  startups: {
    id: "venture-analyst",
    vertical: "startups",
    label: "Venture Analyst",
    blurb: "Series A/B venture investor — unit economics, retention, runway vs the next round.",
    role: "a venture investor and unit-economics specialist who has led Series A/B rounds",
    expertise:
      "You read LTV:CAC and CAC payback as the real test of whether growth is fundable, weigh retention/churn as the ceiling on the base, and obsess over the gap between cash runway and the time to a credible next round — default-alive vs default-dead — plus dilution and term risk.",
    thesisGuidance:
      "STRONG = unit economics and runway verdicts both support fundability; MIXED = healthy economics but a tightening runway (or vice versa); THIN = the case rests on narrative growth rather than the locked unit-economics figures.",
    debateSlots: [
      { id: "unit_economics", name: "Unit Economics" },
      { id: "growth", name: "Growth & Retention" },
      { id: "runway", name: "Runway & Raise" },
      { id: "risk", name: "Risk" },
    ],
    lenses: [
      { id: "unit_economics", name: "Unit Economics" },
      { id: "growth", name: "Growth" },
      { id: "runway", name: "Runway & Dilution" },
      { id: "risk", name: "Risk Manager" },
    ],
    stance: {
      labels: ["BACKABLE", "CONDITIONAL", "UNPROVEN"],
      derive(m) {
        const ltv = byKey(m, "ltvcac");
        const runway = byKey(m, "runway");
        if (!ltv || !runway) return null;
        const econStrong = ltv.verdict === "STRONG" || ltv.verdict === "HEALTHY";
        const basis = `LTV:CAC ${ltv.display} ${ltv.verdict ?? ""}, runway ${runway.display} ${runway.verdict ?? ""}`.trim();
        // Any red (weak economics or critical runway) → unproven.
        if (ltv.verdict === "WEAK" || runway.verdict === "CRITICAL") return { label: "UNPROVEN", basis };
        // Healthy economics AND a safe runway → backable; a watch-list runway → conditional.
        if (econStrong && runway.verdict === "SAFE") return { label: "BACKABLE", basis };
        return { label: "CONDITIONAL", basis };
      },
    },
  },

  /* ===================== CONVENTIONAL — Operator/SMB Analyst ===================== */
  conventional: {
    id: "operator-analyst",
    vertical: "conventional",
    label: "Operator Analyst",
    blurb: "Hands-on operator & SMB/CapEx investor — break-even, IRR, demand realism, cost leverage.",
    role: "a hands-on operator and SMB/CapEx investor who has opened and run unit-economics businesses",
    expertise:
      "You size a deal on break-even economics (contribution margin, BEP units/revenue) and projected IRR on hard-asset CapEx, pressure-test demand/footfall realism against the break-even, watch operating leverage in the fixed-cost base, and never forget that upfront CapEx is largely irreversible.",
    thesisGuidance:
      "STRONG = IRR verdict is strong and break-even sits comfortably below realistic demand; MIXED = decent returns but a thin break-even cushion (or vice versa); THIN = the case relies on optimistic demand narrative rather than the locked BEP/IRR figures.",
    debateSlots: [
      { id: "returns", name: "Returns (IRR)" },
      { id: "breakeven", name: "Break-even" },
      { id: "demand", name: "Demand & Volume" },
      { id: "risk", name: "Risk" },
    ],
    lenses: [
      { id: "returns", name: "Returns" },
      { id: "breakeven", name: "Break-even" },
      { id: "demand", name: "Demand" },
      { id: "risk", name: "Risk Manager" },
    ],
    stance: {
      labels: ["VIABLE", "MARGINAL", "UNVIABLE"],
      derive(m) {
        const irr = byKey(m, "irr");
        if (!irr) return null;
        const basis = `IRR ${irr.display} (${irr.verdict ?? "n/a"})`;
        if (irr.verdict === "STRONG") return { label: "VIABLE", basis };
        if (irr.verdict === "WEAK") return { label: "UNVIABLE", basis };
        return { label: "MARGINAL", basis };
      },
    },
  },
};

export const PERSONAS: Record<Vertical, Persona> = {
  stocks: compose(SPECS.stocks),
  startups: compose(SPECS.startups),
  conventional: compose(SPECS.conventional),
};

export function personaFor(vertical: Vertical): Persona {
  return PERSONAS[vertical];
}
