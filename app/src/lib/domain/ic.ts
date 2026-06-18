import type {
  AssetType,
  ConvictionLabel,
  ICState,
  ReviewState,
  ReviewCadence,
  ThesisMemory,
  Vertical,
} from "@/lib/domain/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const QUARTER_MS = 90 * 24 * 60 * 60 * 1000;

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  public_equity: "Public Equity",
  conventional_business: "Conventional Business",
  startup: "Startup",
  real_estate: "Real Estate",
  crypto: "Crypto",
  macro_view: "Macro View",
  other: "Other",
};

export function assetTypeForVertical(vertical: Vertical): AssetType {
  if (vertical === "startups") return "startup";
  if (vertical === "conventional") return "conventional_business";
  return "public_equity";
}

export function assetTypeTag(assetType: AssetType): string {
  if (assetType === "public_equity") return "EQ";
  if (assetType === "startup") return "VC";
  if (assetType === "conventional_business") return "CB";
  if (assetType === "real_estate") return "RE";
  if (assetType === "crypto") return "CR";
  if (assetType === "macro_view") return "MV";
  return "OT";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function asReviewCadence(value: unknown): ReviewCadence {
  return value === "monthly" || value === "quarterly" || value === "event_driven" ? value : "weekly";
}

function asConviction(value: unknown): ConvictionLabel | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

export function emptyThesisMemory(): ThesisMemory {
  return {
    summary: "",
    assumptions: [],
    thesisBreakers: [],
    watchItems: [],
    valuationAssumptions: [],
    catalysts: [],
    openQuestions: [],
    evidenceCandidates: [],
    conviction: null,
  };
}

export function createDefaultICState(now = Date.now()): ICState {
  return {
    thesis: emptyThesisMemory(),
    review: {
      cadence: "weekly",
      lastReviewedAt: null,
      nextReviewDue: now + WEEK_MS,
    },
  };
}

export function reviewCadenceMs(cadence: ReviewCadence): number | null {
  if (cadence === "weekly") return WEEK_MS;
  if (cadence === "monthly") return MONTH_MS;
  if (cadence === "quarterly") return QUARTER_MS;
  return null;
}

export function nextReviewDueAfter(review: ReviewState, reviewedAt: number): number | null {
  const windowMs = reviewCadenceMs(review.cadence);
  return windowMs ? reviewedAt + windowMs : review.nextReviewDue;
}

export function normalizeICState(raw: ICState | undefined, now = Date.now()): ICState {
  const base = createDefaultICState(now);
  if (!raw) return base;

  const rawRecord = asRecord(raw);
  const thesis = asRecord(rawRecord.thesis ?? base.thesis);
  const review = asRecord(rawRecord.review ?? base.review);

  return {
    thesis: {
      summary: typeof thesis.summary === "string" ? thesis.summary : "",
      assumptions: asArray(thesis.assumptions),
      thesisBreakers: asArray(thesis.thesisBreakers),
      watchItems: asArray(thesis.watchItems),
      valuationAssumptions: asArray(thesis.valuationAssumptions),
      catalysts: asArray(thesis.catalysts),
      openQuestions: asArray(thesis.openQuestions),
      evidenceCandidates: asArray(thesis.evidenceCandidates),
      conviction: asConviction(thesis.conviction),
    },
    review: {
      cadence: asReviewCadence(review.cadence),
      lastReviewedAt: typeof review.lastReviewedAt === "number" ? review.lastReviewedAt : null,
      nextReviewDue: typeof review.nextReviewDue === "number" ? review.nextReviewDue : base.review.nextReviewDue,
    },
  };
}
