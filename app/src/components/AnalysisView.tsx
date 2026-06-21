"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Analysis,
  AssetParameters,
  ChatMessage,
  ContextSource,
  DebateLine,
  EvidenceItem,
  ICState,
  EvidenceRelation,
  EvidenceReliability,
  EvidenceType,
  ThesisRef,
  StockFieldRecord,
  ReviewCadence,
} from "@/lib/domain/types";
import { calcDCF, calcBEP } from "@/lib/finance";
import { computeMetrics } from "@/lib/finance/compute";
import { putBlob, deleteBlob } from "@/lib/repo";
import { getProvider } from "@/lib/ai/registry";
import { personaFor } from "@/lib/ai/personas";
import { buildReport } from "@/lib/ai/report";
import { lintAnalysisGrounding, lintChatReply, type GroundingResult } from "@/lib/ai/grounding";
import {
  buildIntakeConversationText,
  buildResearchAugmentedIntakeText,
  gatherIntakeWebEvidence,
} from "@/lib/ai/intakeContext";
import type { ProviderId } from "@/lib/ai/types";
import type { IntakeResult, ThesisIntakeDraft } from "@/lib/ai/schemas";
import { StocksChart, StartupsChart, ConventionalChart } from "./charts";
import { BLANK_PARAMS, VERTICAL_SHORT, type Vertical } from "@/data/presets";
import { FIELDS, fmtVal } from "@/data/fields";
import { loadInspectorWidth, saveInspectorWidth } from "@/lib/ui/inspectorWidth";
import { ASSET_TYPE_LABELS, assetTypeForVertical, createDefaultICState, nextReviewDueAfter } from "@/lib/domain/ic";
import { isEngineAnalysis, manualRiskPromptsForAssetType } from "@/lib/domain/manualAssets";
import { buildDerivedStockProvenance, buildUserProvidedStockProvenance } from "@/lib/domain/stockFields";
import {
  createEvidenceItem,
  filterEvidence,
  formatSourceRefLabel,
  formatThesisRefLabel,
  groupEvidenceByRelation,
  isValidEvidenceUrl,
  linkEvidenceSource,
  promoteEvidenceCandidate,
  thesisRefOptions,
  unlinkEvidenceSource,
} from "@/lib/domain/evidence";
import {
  createAnalysisDecisionEntry,
  deriveStatusFromDecisionHistory,
  type DecisionDraft,
} from "@/lib/domain/decisions";
import DecisionLedger from "./DecisionLedger";

const MIN_W = 380;
const MAX_W = 760;
const W_KEY = "tp_inspector_w_analysis";

function toneFor(verdict?: string): string {
  if (!verdict) return "";
  if (["DISCOUNT", "STRONG", "SAFE", "NPV POSITIVE"].includes(verdict)) return " bull-text";
  if (["PREMIUM", "WEAK", "CRITICAL", "TOO LONG", "NPV NEGATIVE"].includes(verdict)) return " bear-text";
  return " warning-text";
}

function chartFor(vertical: Vertical, p: AssetParameters) {
  if (vertical === "stocks") {
    const dcf = calcDCF(p.cashflows ?? [], Number(p.discountRate ?? 0.1), Number(p.terminalMult ?? 10), p.invested);
    return <StocksChart cfs={p.cashflows ?? []} discounted={dcf.discounted} />;
  }
  if (vertical === "startups") {
    return <StartupsChart cash={Number(p.cash ?? 0)} burn={Number(p.burn ?? 0)} />;
  }
  return <ConventionalChart bep={calcBEP(Number(p.fixed ?? 0), Number(p.price ?? 0), Number(p.variable ?? 0))} />;
}

function uid(): string {
  return crypto.randomUUID();
}

function nowMs(): number {
  return Date.now();
}

function cleanLines(values: string[]): string[] {
  return values.map((v) => v.trim()).filter(Boolean);
}

function toDateInputValue(value: number | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatReviewDate(value: number | null): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("id-ID");
}

function daysBetween(start: number, end: number): number {
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}

function reviewStatus(review: ICState["review"], now = nowMs()): { label: string; tone: "ok" | "warning" | "danger" | "muted" } {
  if (!review.nextReviewDue) return { label: "No review date", tone: "muted" };
  const days = daysBetween(now, review.nextReviewDue);
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, tone: "danger" };
  if (days === 0) return { label: "Due today", tone: "warning" };
  return { label: `Due in ${days}d`, tone: "ok" };
}

function savedSurfaceLabel(analysis: Analysis): string {
  return analysis.tags.includes("watchlist") ? "Saved to watchlist" : "Saved review";
}

type ReviewSurfaceMode = "kickoff" | "fact_check" | "review";

function reviewLifecycleState(analysis: Analysis, surfaceMode: ReviewSurfaceMode): { label: string; className: string } {
  if (analysis.decisionHistory.length > 0) return { label: "Decision made", className: "status-decision-made" };
  if (surfaceMode === "kickoff" || surfaceMode === "fact_check") return { label: "Needs fact check", className: "status-needs-fact-check" };
  return { label: "Ready for review", className: "status-ready-for-review" };
}

function reviewModeLabel(surfaceMode: ReviewSurfaceMode): string {
  if (surfaceMode === "kickoff") return "Saved kickoff";
  if (surfaceMode === "fact_check") return "Checking facts";
  return "Ready for review";
}

function getImportedExplorationNote(analysis: Analysis): EvidenceItem | null {
  return analysis.evidence.find((item) => item.title === "Imported from Exploration" && item.type === "transcript") ?? null;
}

function deriveReviewSurfaceMode(analysis: Analysis, pendingIntake: IntakeResult | null): ReviewSurfaceMode {
  if (analysis.reviewMode === "kickoff") return "kickoff";
  if (analysis.reviewMode === "fact_check" || pendingIntake !== null || !analysis.debate) return "fact_check";
  return "review";
}

function unsupportedSavedReviewRecovery(text: string, analysis: Analysis): { message: string; actionLabel: string; action: "open_explore" } | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;
  if (
    analysis.assetType === "public_equity" &&
    (/\btell me what stocks to buy\b/.test(lower) ||
      /\bwhat stocks should i buy\b/.test(lower) ||
      /\bwhich stocks should i buy\b/.test(lower) ||
      /\brecommend (me )?(a )?stock\b/.test(lower))
  ) {
    return {
      message: "We don't make buy or sell recommendations. Explore general stock ideas in Explore an idea, or keep checking the facts in this saved review.",
      actionLabel: "Explore an idea",
      action: "open_explore",
    };
  }
  return null;
}

function clampEvidenceType(value?: string): EvidenceType {
  const allowed: EvidenceType[] = [
    "filing",
    "article",
    "note",
    "transcript",
    "market_data",
    "pitch_deck",
    "memo",
    "screenshot",
    "pdf",
    "deal_document",
    "other",
  ];
  return allowed.includes(value as EvidenceType) ? (value as EvidenceType) : "other";
}

function clampEvidenceRelation(value?: string): EvidenceRelation {
  const allowed: EvidenceRelation[] = ["supporting", "contradictory", "neutral", "unresolved"];
  return allowed.includes(value as EvidenceRelation) ? (value as EvidenceRelation) : "unresolved";
}

function clampEvidenceReliability(value?: string): EvidenceReliability {
  const allowed: EvidenceReliability[] = ["official", "third_party", "user_provided", "unknown"];
  return allowed.includes(value as EvidenceReliability) ? (value as EvidenceReliability) : "unknown";
}

function stockFieldTone(field: StockFieldRecord): string {
  if (field.origin === "candidate" || field.origin === "derived_candidate" || field.origin === "legacy_unverified") return " is-inferred";
  return "";
}

const STOCK_FIELD_BY_KEY = new Map(FIELDS.stocks.map((field) => [String(field.key), field] as const));

function stockFieldBadge(field: StockFieldRecord): string {
  switch (field.origin) {
    case "user_fact":
      return "user provided";
    case "sourced_fact":
      return "cited source";
    case "derived_candidate":
      return "derived helper";
    case "legacy_unverified":
      return "legacy non-audited";
    default:
      return "needs confirmation";
  }
}

function prettifyStockFieldText(value: string): string {
  return value.replace(/_/g, " ");
}

function stockFieldLabel(field: StockFieldRecord): string {
  return STOCK_FIELD_BY_KEY.get(field.key)?.label ?? field.key;
}

function stockFieldValue(field: StockFieldRecord): string {
  const spec = STOCK_FIELD_BY_KEY.get(field.key);
  return spec ? fmtVal(field.value, spec.type) : String(field.value);
}

function stockFieldBadgeTone(field: StockFieldRecord): string {
  switch (field.origin) {
    case "user_fact":
      return " is-user";
    case "sourced_fact":
      return " is-sourced";
    case "derived_candidate":
      return " is-derived";
    case "legacy_unverified":
      return " is-legacy";
    default:
      return " is-candidate";
  }
}

function stockFieldMeta(field: StockFieldRecord): string[] {
  const provenance = field.provenance;
  if (!provenance) return [];
  const items: string[] = [];
  if (provenance.asOf) items.push(`As of ${provenance.asOf}`);
  if (provenance.valueType) items.push(`Type: ${prettifyStockFieldText(provenance.valueType)}`);
  if (provenance.confidence) items.push(`Confidence: ${prettifyStockFieldText(provenance.confidence)}`);
  if (provenance.sourceKind) items.push(`Source: ${prettifyStockFieldText(provenance.sourceKind)}`);
  return items;
}

function hasThesisDraft(thesis: ThesisIntakeDraft): boolean {
  return Boolean(
    thesis.summary.trim() ||
      thesis.assumptions.length ||
      thesis.thesisBreakers.length ||
      thesis.watchItems.length ||
      thesis.valuationAssumptions.length ||
      thesis.catalysts.length ||
      thesis.openQuestions.length ||
      thesis.evidenceCandidates.length,
  );
}

function buildICStateFromThesis(thesis: ThesisIntakeDraft, existing?: ICState): ICState {
  const now = Date.now();
  const base = existing ?? createDefaultICState(now);
  return {
    ...base,
    thesis: {
      ...base.thesis,
      summary: thesis.summary.trim(),
      assumptions: cleanLines(thesis.assumptions).map((text) => ({
        id: uid(),
        text,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })),
      thesisBreakers: cleanLines(thesis.thesisBreakers).map((text) => ({
        id: uid(),
        text,
        severity: "material",
        createdAt: now,
      })),
      watchItems: cleanLines(thesis.watchItems).map((text) => ({ id: uid(), text, cadence: "weekly", createdAt: now })),
      valuationAssumptions: cleanLines(thesis.valuationAssumptions).map((text) => ({
        id: uid(),
        text,
        source: "user",
        createdAt: now,
      })),
      catalysts: cleanLines(thesis.catalysts).map((text) => ({ id: uid(), text, createdAt: now })),
      openQuestions: cleanLines(thesis.openQuestions).map((text) => ({ id: uid(), text, createdAt: now })),
      evidenceCandidates: thesis.evidenceCandidates
        .filter((candidate) => candidate.title?.trim())
        .map((candidate) => ({
          id: uid(),
          title: candidate.title.trim(),
          ...(candidate.url?.trim() ? { url: candidate.url.trim() } : {}),
          ...(candidate.note?.trim() ? { note: candidate.note.trim() } : {}),
          type: clampEvidenceType(candidate.type),
          relation: clampEvidenceRelation(candidate.relation),
          reliability: clampEvidenceReliability(candidate.reliability),
          createdAt: now,
        })),
      conviction: base.thesis.conviction,
    },
  };
}

export default function AnalysisView({
  analysis,
  onChange,
  provider,
  apiKey,
  model,
  onNeedSettings,
  onOpenExplore,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
  provider: ProviderId;
  apiKey: string;
  model: string;
  onNeedSettings: () => void;
  onOpenExplore: () => void;
}) {
  const manualMode = analysis.valuationMode === "manual";
  const [reviewing, setReviewing] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [runPhase, setRunPhase] = useState<"" | "research" | "debate">("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [recoveryCta, setRecoveryCta] = useState<{ message: string; actionLabel: string; action: "open_explore" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const importedExplorationNote = getImportedExplorationNote(analysis);

  // Intake (Option C): when there's no debate yet, the composer drives a structured
  // intake → confirm-card → lock → debate flow instead of grounded follow-up chat.
  const intakeMode = !manualMode && !analysis.debate;
  const [pendingIntake, setPendingIntake] = useState<IntakeResult | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakePhase, setIntakePhase] = useState<"extract" | "research">("extract");
  const [intakeNonce, setIntakeNonce] = useState(0); // remounts ConfirmCard on a new draft

  // Two-pane: collapsible + VS-Code-style resizable inspector (docked right).
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorW, setInspectorW] = useState(480);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const onGutterDown = useCallback(() => setDragging(true), []);
  // Restore a previously dragged width after mount (SSR-safe — fallback renders first).
  useEffect(() => {
    void Promise.resolve().then(() => {
      setInspectorW((w) => Math.min(MAX_W, Math.max(MIN_W, loadInspectorWidth(W_KEY, w))));
    });
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: MouseEvent) => {
      const right = rootRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      setInspectorW(Math.min(MAX_W, Math.max(MIN_W, right - ev.clientX)));
    };
    const onUp = () => {
      setDragging(false);
      setInspectorW((w) => {
        saveInspectorWidth(W_KEY, w);
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const update = (patch: Partial<Analysis>) => onChange({ ...analysis, ...patch });

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const additions: ContextSource[] = [];
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) continue; // v1: PDF + image only (native Claude blocks)
      const blobId = await putBlob(file);
      additions.push({
        id: crypto.randomUUID(),
        kind: "file",
        name: file.name,
        mime: file.type,
        fileKind: isImage ? "image" : "pdf",
        blobId,
        createdAt: Date.now(),
      });
    }
    if (additions.length) update({ sources: [...analysis.sources, ...additions] });
  }

  function addLink() {
    const raw = linkDraft.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    update({
      sources: [...analysis.sources, { id: crypto.randomUUID(), kind: "link", url, createdAt: Date.now() }],
    });
    setLinkDraft("");
  }

  async function removeSource(s: ContextSource) {
    if (s.kind === "file") await deleteBlob(s.blobId);
    update({ sources: analysis.sources.filter((x) => x.id !== s.id) });
  }

  async function runAI() {
    if (!isEngineAnalysis(analysis)) return;
    if (!apiKey) return onNeedSettings();
    setRunning(true);
    setAiError(null);
    try {
      // The provider orchestrates the research + structured-debate passes and
      // reports phase changes (RESEARCHING… → DEBATING…) via onPhase.
      const out = await getProvider(provider).runAnalysis({
        apiKey,
        model,
        analysis,
        onPhase: setRunPhase,
      });
      const persona = personaFor(analysis.vertical);
      update({
        debate: out.debate,
        advisory: out.advisory,
        stance: out.stance,
        persona: { id: persona.id, label: persona.label },
        model,
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setRunPhase("");
    }
  }

  async function runReview() {
    if (!isEngineAnalysis(analysis)) return;
    if (!apiKey) return onNeedSettings();
    setReviewing(true);
    setAiError(null);
    try {
      const review = await getProvider(provider).runExpertReview({ apiKey, model, analysis });
      update({ expertReview: review });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewing(false);
    }
  }

  /** Composer submit — routes by mode: intake (no debate yet) vs grounded follow-up. */
  function onComposerSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (manualMode) return;
    const text = chatInput.trim();
    if (!text || chatBusy || intakeBusy || running) return;
    if (!apiKey) return onNeedSettings();
    setChatInput("");
    if (analysis.reviewMode === "kickoff") {
      update({ reviewMode: "fact_check" });
    }
    if (intakeMode) submitIntake(text);
    else sendFollowUp(text);
  }

  /** Grounded follow-up chat (only after a debate exists). */
  async function sendFollowUp(text: string) {
    if (!isEngineAnalysis(analysis)) return;
    const recovery = unsupportedSavedReviewRecovery(text, analysis);
    if (recovery) {
      const now = Date.now();
      const userMsg: ChatMessage = { id: `${now}-u`, role: "user", content: text, createdAt: now };
      const aiMsg: ChatMessage = { id: `${now}-a`, role: "assistant", content: recovery.message, kind: "answer", createdAt: now + 1 };
      update({ chat: [...analysis.chat, userMsg, aiMsg] });
      setRecoveryCta(recovery);
      return;
    }
    setPendingUser(text);
    setStreamingText("");
    setChatBusy(true);
    setAiError(null);
    setRecoveryCta(null);
    try {
      const full = await getProvider(provider).streamChat({
        apiKey,
        model,
        analysis,
        userText: text,
        onDelta: (d) => setStreamingText((p) => p + d),
      });
      const now = Date.now();
      const userMsg: ChatMessage = { id: `${now}-u`, role: "user", content: text, createdAt: now };
      const aiMsg: ChatMessage = { id: `${now}-a`, role: "assistant", content: full, kind: "answer", createdAt: now + 1 };
      update({ chat: [...analysis.chat, userMsg, aiMsg] });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingUser(null);
      setStreamingText("");
      setChatBusy(false);
    }
  }

  /** Intake: structured pass that detects the vertical + extracts figures. */
  async function submitIntake(text: string) {
    if (manualMode) return;
    const now = Date.now();
    const userMsg: ChatMessage = { id: `${now}-u`, role: "user", content: text, createdAt: now };
    // Persist the user turn explicitly so we don't read the stale `analysis` prop later.
    const withUser: Analysis = { ...analysis, chat: [...analysis.chat, userMsg] };
    if (withUser.reviewMode === "kickoff") withUser.reviewMode = "fact_check";
    onChange(withUser);
    setIntakeBusy(true);
    setIntakePhase(withUser.allowWebSearch || withUser.sources.some((s) => s.kind === "link") ? "research" : "extract");
    setAiError(null);
    try {
      const conversationText = buildIntakeConversationText(withUser.chat);
      let intakeText = conversationText;
      if (withUser.allowWebSearch || withUser.sources.some((s) => s.kind === "link")) {
        const evidence = await gatherIntakeWebEvidence({
          conversationText,
          sources: withUser.sources,
          allowWebSearch: withUser.allowWebSearch,
        });
        const hasEvidence =
          evidence.fetchedLinks.length > 0 ||
          evidence.marketData.length > 0 ||
          evidence.searchResults.length > 0 ||
          evidence.searchedPages.length > 0;
        if (!hasEvidence && evidence.errors.length > 0) {
          throw new Error(`Web research failed: ${evidence.errors.join("; ")}`);
        }
        intakeText = buildResearchAugmentedIntakeText(conversationText, evidence);
        setIntakePhase("extract");
      }
      const result = await getProvider(provider).runIntake({
        apiKey,
        model,
        userText: intakeText,
        sources: withUser.sources,
      });
      if (result.mode === "scoping" && !hasThesisDraft(result.thesis)) {
        const aiMsg: ChatMessage = {
          id: `${now}-a`,
          role: "assistant",
          kind: "answer",
          content: result.note || "I need a few more numbers before I can value this — tell me the key figures.",
          createdAt: now + 1,
        };
        onChange({ ...withUser, chat: [...withUser.chat, aiMsg] });
      } else {
        setPendingIntake(result);
        setIntakeNonce((n) => n + 1);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setIntakeBusy(false);
      setIntakePhase("extract");
    }
  }

  /**
   * Confirm handler: lock the (possibly edited) figures via the engine and auto-run
   * the persona debate, then post the written report. Builds the next Analysis
   * EXPLICITLY (the `analysis` prop won't reflect onChange synchronously).
   */
  async function confirmIntake(
    vertical: Vertical,
    values: Record<string, number>,
    thesis: ThesisIntakeDraft,
    stockFields?: StockFieldRecord[],
  ) {
    if (!pendingIntake) return;
    const shouldRunDebate =
      vertical === "stocks"
        ? Number.isFinite(values.price) && Number.isFinite(values.eps)
        : pendingIntake.mode === "figures";
    if (shouldRunDebate && !apiKey) return onNeedSettings();
    const parameters: AssetParameters = { ...BLANK_PARAMS[vertical], ...values };
    // Stocks DCF cashflows aren't user-facing — proxy from the (confirmed) EPS.
    if (vertical === "stocks") parameters.cashflows = Array(5).fill(Number(parameters.eps ?? 0));
    const persona = personaFor(vertical);
    const next: Analysis = {
      ...analysis,
      vertical,
      assetType: assetTypeForVertical(vertical),
      assetName: pendingIntake.assetName || analysis.assetName,
      title: pendingIntake.title || analysis.title,
      stockFields: vertical === "stocks" ? stockFields ?? analysis.stockFields ?? [] : undefined,
      ic: buildICStateFromThesis(thesis, analysis.ic),
      parameters,
      metrics: computeMetrics(vertical, parameters),
      persona: { id: persona.id, label: persona.label },
      reviewMode: shouldRunDebate ? null : "fact_check",
      model: shouldRunDebate ? model : analysis.model,
    };
    onChange(next);
    setPendingIntake(null);
    if (!shouldRunDebate) {
      const savedMsg: ChatMessage = {
        id: `${Date.now()}-t`,
        role: "assistant",
        kind: "answer",
        content: "Your working view is saved. Add valuation figures when you're ready, then come back to check the facts before reviewing the investment.",
        createdAt: Date.now(),
      };
      onChange({ ...next, chat: [...next.chat, savedMsg] });
      return;
    }
    setRunning(true);
    setRunPhase("");
    setAiError(null);
    try {
      const out = await getProvider(provider).runAnalysis({ apiKey, model, analysis: next, onPhase: setRunPhase });
      const after: Analysis = { ...next, debate: out.debate, advisory: out.advisory, stance: out.stance, reviewMode: null };
      const reportMsg: ChatMessage = {
        id: `${Date.now()}-r`,
        role: "assistant",
        kind: "report",
        content: buildReport(after),
        createdAt: Date.now(),
      };
      onChange({ ...after, chat: [...after.chat, reportMsg] });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setRunPhase("");
    }
  }

  function setParam(key: keyof AssetParameters, value: number) {
    if (!isEngineAnalysis(analysis)) return;
    const parameters = { ...analysis.parameters, [key]: value } as AssetParameters;
    update({ parameters, metrics: computeMetrics(analysis.vertical, parameters) });
  }

  function addTag() {
    const t = tagDraft.trim().toLowerCase();
    if (t && !analysis.tags.includes(t)) update({ tags: [...analysis.tags, t] });
    setTagDraft("");
  }

  const groundingResult = useMemo(() => lintAnalysisGrounding(analysis), [analysis]);
  if (manualMode) {
    return (
      <ManualAnalysisView
        analysis={analysis}
        onChange={onChange}
        onOpenExplore={onOpenExplore}
        promptNote={importedExplorationNote?.note ?? ""}
      />
    );
  }

  const metrics = analysis.metrics!.metrics;
  const advisory = analysis.advisory ?? [];
  const surfaceMode = deriveReviewSurfaceMode(analysis, pendingIntake);
  const needsFactCheck = surfaceMode !== "review";
  const lifecycle = reviewLifecycleState(analysis, surfaceMode);
  const modeLabel = reviewModeLabel(surfaceMode);
  const savedLabel = savedSurfaceLabel(analysis);
  const importedExploration = importedExplorationNote !== null;
  // Deterministic grounding guard (P8): flag any number in the model's prose that
  // doesn't trace to the engine. Non-blocking — surfaced as a chip / message marker.
  const grounding = groundingResult;

  return (
    <div className="tp-root" ref={rootRef} data-qa="analysis-view" style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}>
      {/* ---- top bar: title + status + primary RUN AI + inspector toggle ---- */}
      <header className="tp-topbar">
        <div className="tp-title-wrap">
          <input className="tp-title" value={analysis.title} onChange={(e) => update({ title: e.target.value })} />
          <span className={`status-pill ${lifecycle.className}`}>{lifecycle.label}</span>
          {analysis.persona && (
            <span className="persona-badge" title="Domain expert that produced this investment review">{analysis.persona.label}</span>
          )}
          <span className={`tp-mode${analysis.tags.includes("watchlist") ? " is-watchlist" : " is-saved"}`} title="This record is already saved in your workspace">
            {savedLabel}
          </span>
          <span className={`sim-badge${needsFactCheck ? "" : " live"}`} title={needsFactCheck ? "Check the facts before reviewing the saved investment." : "Grounded review mode"}>
            {modeLabel}
          </span>
        </div>
        <div className="tp-topbar-actions">
          <button className="tp-run-btn" onClick={runAI} disabled={running || needsFactCheck} title={needsFactCheck ? "Check the facts before running the AI review" : "Run the AI review"}>
            {running ? (runPhase === "research" ? "RESEARCHING…" : "ANALYZING…") : "Run AI review"}
          </button>
          <button className="tp-ghost" onClick={() => setInspectorOpen((v) => !v)}>
            {inspectorOpen ? "Hide details ›" : "‹ Show details"}
          </button>
        </div>
      </header>
      {aiError && <div className="tp-error">⚠ {aiError}</div>}

      <div className="tp-split">
        {/* ================= LEFT: conversation ================= */}
        <main className="tp-convo">
          <div className="tp-stream scrollable">
            {importedExploration && surfaceMode !== "review" && (
              <div className="tp-imported-note" data-qa="exploration-note-banner">
                <span>Saved review opened. Your exploration prompt is in Evidence Locker as an unverified note.</span>
                <button
                  className="tp-mini-btn"
                  type="button"
                  onClick={() => {
                    update({ reviewMode: "fact_check" });
                    composerInputRef.current?.focus();
                  }}
                >
                  Check the facts
                </button>
              </div>
            )}
            {surfaceMode === "kickoff" && analysis.chat.length === 0 && !pendingUser && !pendingIntake && !intakeBusy && (
              <TriageKickoffPanel
                analysis={analysis}
                promptNote={importedExplorationNote?.note ?? ""}
                onBeginFactCheck={() => {
                  update({ reviewMode: "fact_check" });
                  composerInputRef.current?.focus();
                }}
              />
            )}
            {surfaceMode === "fact_check" && analysis.chat.length === 0 && !pendingUser && !pendingIntake && !intakeBusy && (
              <div className="tp-stream-empty">
                <div className="tp-stream-empty-h">Check the facts</div>
                Paste thesis notes, filings, links, or evidence for this concrete asset. The analyst will extract
                a working view and candidate figures for fact checking. Broad screening belongs in Explore an idea; this
                saved review only changes after you confirm the facts here.
              </div>
            )}
            {analysis.chat.map((m) => (
              <div key={m.id} className={`tp-msg tp-msg--${m.role}`}>
                <div className="tp-msg-role">{m.role === "user" ? "You" : "Analyst"}</div>
                {m.kind === "report" ? (
                  <ReportBody content={m.content} />
                ) : (
                  <div className="tp-msg-body">{m.content}</div>
                )}
                {m.role === "assistant" && m.kind !== "report" && (
                  <ChatGroundFlag result={lintChatReply(m.content, metrics)} />
                )}
              </div>
            ))}
            {pendingUser && (
              <>
                <div className="tp-msg tp-msg--user">
                  <div className="tp-msg-role">You</div>
                  <div className="tp-msg-body">{pendingUser}</div>
                </div>
                <div className="tp-msg tp-msg--assistant">
                  <div className="tp-msg-role">Analyst</div>
                  <div className="tp-msg-body">{streamingText || "…"}</div>
                </div>
              </>
            )}
            {intakeBusy && (
              <div className="tp-msg tp-msg--assistant">
                <div className="tp-msg-role">Analyst</div>
                <div className="tp-msg-body">
                  {intakePhase === "research" ? "Searching the web and reading sources…" : "Reading the deal and pulling the figures…"}
                </div>
              </div>
            )}
            {pendingIntake && !intakeBusy && surfaceMode === "fact_check" && (
              <ConfirmCard
                key={intakeNonce}
                intake={pendingIntake}
                busy={running}
                onConfirm={confirmIntake}
                onCancel={() => setPendingIntake(null)}
              />
            )}
            {running && intakeMode && (
              <div className="tp-msg tp-msg--assistant">
                <div className="tp-msg-role">Analyst</div>
                <div className="tp-msg-body">{runPhase === "research" ? "Checking sources…" : "Checking the facts and updating the review…"}</div>
              </div>
            )}
          </div>

          <div className="tp-composer">
            {recoveryCta && (
              <div className="tp-recovery-note" data-qa="saved-review-recovery">
                <span>{recoveryCta.message}</span>
                <button className="tp-mini-btn" type="button" onClick={onOpenExplore}>
                  {recoveryCta.actionLabel}
                </button>
              </div>
            )}
            {analysis.sources.length > 0 && (
              <div className="tp-sources">
                {analysis.sources.map((s) => (
                  <span key={s.id} className="source-chip">
                    <span className="source-kind">{s.kind === "file" ? (s.fileKind === "image" ? "🖼" : "📄") : "🔗"}</span>
                    <span className="source-name">{s.kind === "file" ? s.name : s.url}</span>
                    <button className="source-remove" onClick={() => removeSource(s)} title="Remove">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="tp-composer-tools">
              <button className="tp-tool" onClick={() => fileInputRef.current?.click()}>＋ File</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                className="tp-link-input"
                placeholder="paste a URL…"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <button className="tp-tool" onClick={addLink}>＋ Link</button>
              <label className="tp-tool tp-tool-toggle">
                <input type="checkbox" checked={analysis.allowWebSearch} onChange={(e) => update({ allowWebSearch: e.target.checked })} />
                Web research
              </label>
            </div>
            <form className="tp-composer-input" onSubmit={onComposerSubmit}>
              <textarea
                ref={composerInputRef}
                className="tp-input"
                rows={2}
                placeholder={
                  surfaceMode === "kickoff"
                    ? "Name a company, paste a ticker, or add notes to begin fact-checking..."
                    : needsFactCheck
                      ? "Paste notes or evidence so you can check the facts..."
                      : "Ask a grounded follow-up about this saved review..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onComposerSubmit(e);
                  }
                }}
                disabled={chatBusy || intakeBusy || running}
              />
              <button type="submit" className="tp-send" disabled={chatBusy || intakeBusy || running}>
                {needsFactCheck ? (intakeBusy ? "…" : "Check the facts ↵") : chatBusy ? "…" : "Send ↵"}
              </button>
            </form>
          </div>
        </main>

        {/* resizable gutter */}
        {inspectorOpen && (
          <div className={`tp-gutter${dragging ? " is-dragging" : ""}`} onMouseDown={onGutterDown} role="separator" aria-orientation="vertical" />
        )}

        {/* ================= RIGHT: inspector dashboard ================= */}
        {inspectorOpen && (
          <aside className="tp-inspector scrollable" style={{ width: inspectorW, flex: `0 0 ${inspectorW}px` }}>
            <div className="tp-inspector-head">
              <span>INVESTMENT REVIEW</span>
              <span className="tp-inspector-sub">{analysis.assetName || "—"}</span>
            </div>

            {analysis.stance && (
              <div className="tp-stance">
                <span className="tp-stance-label">{analysis.stance.label}</span>
                <span className="tp-stance-basis">{analysis.stance.basis}</span>
              </div>
            )}

            {/* verdict strip — deterministic metrics */}
            <div className="tp-verdict">
              {metrics.map((m) => (
                <div className="tp-vcell" key={m.key}>
                  <div className="tp-vlbl">{m.label}</div>
                  <div className={`tp-vval${toneFor(m.verdict)}`}>{m.display}</div>
                </div>
              ))}
            </div>

            <div className="tp-board">
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Why I might invest
                  <span className="tp-card-hint">{ASSET_TYPE_LABELS[analysis.assetType]}</span>
                </div>
                <ThesisMemoryPanel analysis={analysis} />
              </div>

              <ReviewCadencePanel analysis={analysis} onChange={onChange} />

              <EvidenceLocker analysis={analysis} onChange={onChange} />

              {/* locked figures (sliders) */}
              <div className="tp-card">
                <div className="tp-card-h">Key numbers <span className="tp-card-hint">editable</span></div>
                <form className="tp-figs" onSubmit={(e) => e.preventDefault()}>
                  {FIELDS[analysis.vertical!].map((f) => {
                    const val = Number(analysis.parameters[f.key] ?? f.min);
                    return (
                      <div className="tp-fig" key={f.key}>
                        <div className="tp-fig-row">
                          <span className="tp-fig-label">{f.label}</span>
                          <span className="tp-fig-val">{fmtVal(val, f.type)}</span>
                        </div>
                        <input type="range" className="tp-slider" min={f.min} max={f.max} step={f.step} value={val} onChange={(e) => setParam(f.key, parseFloat(e.target.value))} />
                      </div>
                    );
                  })}
                </form>
              </div>

              {/* chart */}
              <div className="tp-card">
                <div className="tp-card-h">Value snapshot <span className="tp-card-hint">deterministic</span></div>
                <div className="chart-wrapper">{chartFor(analysis.vertical!, analysis.parameters)}</div>
              </div>

              {/* debate */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Bull vs bear view
                  {analysis.debate && (
                    <span className="tp-badge tp-badge-support">THESIS {analysis.debate.thesisSupport}</span>
                  )}
                  {analysis.debate && <GroundChip result={grounding} />}
                </div>
                {!analysis.debate ? (
                  <div className="tp-muted-note">Run AI to generate a grounded bull vs bear view.</div>
                ) : (
                  <div className="tp-debate">
                    <DebateSide side="bull" label="▲ BULL" lines={analysis.debate.bull} />
                    <DebateSide side="bear" label="▼ BEAR" lines={analysis.debate.bear} />
                  </div>
                )}
              </div>

              {/* advisory lenses */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Extra perspectives <span className="tp-card-hint">{analysis.persona?.label ?? "lenses"}</span></div>
                <div className="tp-lenses">
                  {advisory.length === 0 ? (
                    <div className="tp-muted-note">Run AI to generate extra perspectives on this investment.</div>
                  ) : (
                    advisory.map((l) => (
                      <div className="tp-lens-row" key={l.id}>
                        <div className="tp-lens-top">
                          <span className="tp-lens-name">{l.name}</span>
                          <span className="tp-lens-verdict">{l.verdict}</span>
                        </div>
                        <div className="tp-lens-hook">{l.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* decision */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Decision history</div>
                <DecisionLedger
                  dataQa="analysis-decision-ledger"
                  history={analysis.decisionHistory}
                  subjectLabel="This investment review"
                  createEntry={(draft: DecisionDraft) => createAnalysisDecisionEntry(analysis, draft)}
                  onHistoryChange={(decisionHistory) =>
                    update({
                      decision: null,
                      decisionHistory,
                      status: deriveStatusFromDecisionHistory(decisionHistory),
                    })
                  }
                />
              </div>

              {/* expert review */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Second opinion
                  <button data-qa="analysis-run-review" className="tp-mini-btn" onClick={runReview} disabled={reviewing || !analysis.debate} title={analysis.debate ? "Red-team this analysis — one extra AI call" : "Run AI first"}>
                    {reviewing ? "REVIEWING…" : analysis.expertReview ? "Re-review" : "⚖ Get review"}
                  </button>
                </div>
                {!analysis.expertReview ? (
                  <div className="tp-muted-note">A second {analysis.persona?.label ?? "expert"} reviews the investment, highlights strengths and gaps, and checks the grounding. On demand — one extra AI call.</div>
                ) : (
                  <div className="review-body">
                    <div className="review-verdict">{analysis.expertReview.verdictLine}</div>
                    <div className="review-grid">
                      <ReviewList title="Strengths" items={analysis.expertReview.strengths} tone="bull" />
                      <ReviewList title="Gaps" items={analysis.expertReview.gaps} tone="bear" />
                      <ReviewList title="What would change the call" items={analysis.expertReview.whatWouldChangeMyMind} tone="warning" />
                    </div>
                    <div className="review-grounding">
                      <span className="review-grounding-label">Grounding check:</span> {analysis.expertReview.groundingCheck}
                    </div>
                  </div>
                )}
              </div>

              {/* asset details */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Investment details</div>
                <div className="tp-meta-grid">
                  <input className="meta-input" placeholder="Ticker" value={analysis.assetMeta.ticker ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, ticker: e.target.value } })} />
                  <input className="meta-input" placeholder="Sector" value={analysis.assetMeta.sector ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, sector: e.target.value } })} />
                  <input className="meta-input" placeholder="Data as of (YYYY-MM-DD)" value={analysis.assetMeta.dataAsOf ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, dataAsOf: e.target.value } })} />
                </div>
                <div className="tag-row">
                  {analysis.tags.map((t) => (
                    <span key={t} className="tag-chip" onClick={() => update({ tags: analysis.tags.filter((x) => x !== t) })}>#{t} ✕</span>
                  ))}
                  <input
                    className="tag-input"
                    placeholder="+ tag"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                </div>
              </div>

              {analysis.vertical === "stocks" && (analysis.stockFields?.length ?? 0) > 0 && (
                <div className="tp-card tp-card--wide" data-qa="stock-provenance">
                  <div className="tp-card-h">Source trail for key numbers</div>
                  <StockFieldInspectorPanel fields={analysis.stockFields!} />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ManualAnalysisView({
  analysis,
  onChange,
  onOpenExplore,
  promptNote,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
  onOpenExplore: () => void;
  promptNote: string;
}) {
  const surfaceMode: ReviewSurfaceMode = analysis.reviewMode === "kickoff" ? "kickoff" : "review";
  const lifecycle = reviewLifecycleState(analysis, surfaceMode);
  const savedLabel = savedSurfaceLabel(analysis);

  function jumpTo(selector: string) {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="tp-root" data-qa="analysis-view">
      <header className="tp-topbar">
        <div className="tp-title-wrap">
          <input className="tp-title" value={analysis.title} onChange={(e) => onChange({ ...analysis, title: e.target.value })} />
          <span className={`status-pill ${lifecycle.className}`}>{lifecycle.label}</span>
          <span className={`tp-mode${analysis.tags.includes("watchlist") ? " is-watchlist" : " is-saved"}`}>{savedLabel}</span>
          <span className="sim-badge">{ASSET_TYPE_LABELS[analysis.assetType]}</span>
        </div>
      </header>

      <div className="tp-split">
        <main className="tp-convo">
          <div className="tp-stream scrollable">
            {analysis.reviewMode === "kickoff" ? (
              <TriageKickoffPanel
                analysis={analysis}
                promptNote={promptNote}
                onBeginFactCheck={() => onChange({ ...analysis, reviewMode: "fact_check" })}
              />
            ) : (
              <>
                <div className="tp-stream-empty">
                  <div className="tp-stream-empty-h">Saved manual review</div>
                  No automatic market model is active for this asset. Capture your notes, valuation context, evidence, decisions, and risk checks here.
                </div>
                <div className="tp-recovery-panel" data-qa="manual-review-recovery">
                  <div className="tp-card-h">When this review can&apos;t do something yet</div>
                  <div className="tp-recovery-list">
                    <div className="tp-recovery-row">
                      <span>Can&apos;t sync live prices for a private asset? Use the saved check-in schedule to review it manually.</span>
                      <button className="tp-mini-btn" type="button" onClick={() => jumpTo('[data-qa=\"review-panel\"]')}>
                        Set review cadence
                      </button>
                    </div>
                    <div className="tp-recovery-row">
                      <span>No public chart or sentiment feed? Preserve the source material you do have in Evidence Locker.</span>
                      <button className="tp-mini-btn" type="button" onClick={() => jumpTo('[data-qa=\"evidence-locker\"]')}>
                        Add note
                      </button>
                    </div>
                    <div className="tp-recovery-row">
                      <span>Need a broader market screen before you decide what belongs here? Go back to Explore an idea.</span>
                      <button className="tp-mini-btn" type="button" onClick={onOpenExplore}>
                        Explore an idea
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <aside className="tp-inspector scrollable" style={{ width: 520, flex: "0 0 520px" }}>
          <div className="tp-inspector-head">
            <span>INVESTMENT REVIEW</span>
            <span className="tp-inspector-sub">{analysis.assetName || ASSET_TYPE_LABELS[analysis.assetType]}</span>
          </div>

          <div className="tp-board">
            <div className="tp-card tp-card--wide">
              <div className="tp-card-h">
                Thesis memory
                <span className="tp-card-hint">{ASSET_TYPE_LABELS[analysis.assetType]}</span>
              </div>
              <ManualThesisEditor analysis={analysis} onChange={onChange} />
            </div>

            <ManualAssetPanel analysis={analysis} onChange={onChange} />

            <ReviewCadencePanel analysis={analysis} onChange={onChange} />

            <EvidenceLocker analysis={analysis} onChange={onChange} />

            <div className="tp-card tp-card--wide">
              <div className="tp-card-h">Decision history</div>
              <DecisionLedger
                dataQa="analysis-decision-ledger"
                history={analysis.decisionHistory}
                subjectLabel="This investment review"
                createEntry={(draft: DecisionDraft) => createAnalysisDecisionEntry(analysis, draft)}
                onHistoryChange={(decisionHistory) =>
                  onChange({
                    ...analysis,
                    decision: null,
                    decisionHistory,
                    status: deriveStatusFromDecisionHistory(decisionHistory),
                  })
                }
              />
            </div>

            <div className="tp-card tp-card--wide">
              <div className="tp-card-h">Investment details</div>
              <div className="tp-meta-grid">
                <input
                  className="meta-input"
                  placeholder="Asset name"
                  value={analysis.assetName}
                  onChange={(e) => onChange({ ...analysis, assetName: e.target.value })}
                />
                <input
                  className="meta-input"
                  placeholder="Sector or theme"
                  value={analysis.assetMeta.sector ?? ""}
                  onChange={(e) => onChange({ ...analysis, assetMeta: { ...analysis.assetMeta, sector: e.target.value } })}
                />
                <input
                  className="meta-input"
                  placeholder="Data as of (YYYY-MM-DD)"
                  value={analysis.assetMeta.dataAsOf ?? ""}
                  onChange={(e) => onChange({ ...analysis, assetMeta: { ...analysis.assetMeta, dataAsOf: e.target.value } })}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ManualThesisEditor({
  analysis,
  onChange,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
}) {
  const thesis = analysis.ic.thesis;

  function updateList(
    key: "assumptions" | "thesisBreakers" | "watchItems" | "valuationAssumptions" | "catalysts" | "openQuestions",
    text: string,
  ) {
    const now = nowMs();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const nextThesis = { ...thesis };
    if (key === "assumptions") {
      nextThesis.assumptions = lines.map((line, index) => ({
        id: thesis.assumptions[index]?.id ?? uid(),
        text: line,
        status: thesis.assumptions[index]?.status ?? "active",
        createdAt: thesis.assumptions[index]?.createdAt ?? now,
        updatedAt: now,
      }));
    } else if (key === "thesisBreakers") {
      nextThesis.thesisBreakers = lines.map((line, index) => ({
        id: thesis.thesisBreakers[index]?.id ?? uid(),
        text: line,
        severity: thesis.thesisBreakers[index]?.severity ?? "material",
        createdAt: thesis.thesisBreakers[index]?.createdAt ?? now,
      }));
    } else if (key === "watchItems") {
      nextThesis.watchItems = lines.map((line, index) => ({
        id: thesis.watchItems[index]?.id ?? uid(),
        text: line,
        cadence: thesis.watchItems[index]?.cadence ?? "weekly",
        createdAt: thesis.watchItems[index]?.createdAt ?? now,
      }));
    } else if (key === "valuationAssumptions") {
      nextThesis.valuationAssumptions = lines.map((line, index) => ({
        id: thesis.valuationAssumptions[index]?.id ?? uid(),
        text: line,
        source: thesis.valuationAssumptions[index]?.source ?? "user",
        createdAt: thesis.valuationAssumptions[index]?.createdAt ?? now,
      }));
    } else if (key === "catalysts") {
      nextThesis.catalysts = lines.map((line, index) => ({
        id: thesis.catalysts[index]?.id ?? uid(),
        text: line,
        createdAt: thesis.catalysts[index]?.createdAt ?? now,
      }));
    } else {
      nextThesis.openQuestions = lines.map((line, index) => ({
        id: thesis.openQuestions[index]?.id ?? uid(),
        text: line,
        createdAt: thesis.openQuestions[index]?.createdAt ?? now,
      }));
    }

    onChange({ ...analysis, ic: { ...analysis.ic, thesis: nextThesis } });
  }

  return (
    <div className="tp-thesis-panel">
      <label className="tp-thesis-field">
        <span>Why I might invest</span>
        <textarea
          rows={3}
          value={thesis.summary}
          onChange={(e) => onChange({ ...analysis, ic: { ...analysis.ic, thesis: { ...thesis, summary: e.target.value } } })}
          placeholder="What this investment is, why it may be attractive, and what could go wrong."
        />
      </label>
      <div className="tp-thesis-confirm-grid">
        <ThesisListEditor label="Why this could work" value={thesis.assumptions.map((item) => item.text)} onChange={(text) => updateList("assumptions", text)} disabled={false} />
        <ThesisListEditor label="What could go wrong" value={thesis.thesisBreakers.map((item) => item.text)} onChange={(text) => updateList("thesisBreakers", text)} disabled={false} />
        <ThesisListEditor label="What to watch" value={thesis.watchItems.map((item) => item.text)} onChange={(text) => updateList("watchItems", text)} disabled={false} />
        <ThesisListEditor label="Price assumptions" value={thesis.valuationAssumptions.map((item) => item.text)} onChange={(text) => updateList("valuationAssumptions", text)} disabled={false} />
        <ThesisListEditor label="Catalysts" value={thesis.catalysts.map((item) => item.text)} onChange={(text) => updateList("catalysts", text)} disabled={false} />
        <ThesisListEditor label="What I still need to verify" value={thesis.openQuestions.map((item) => item.text)} onChange={(text) => updateList("openQuestions", text)} disabled={false} />
      </div>
    </div>
  );
}

function ManualAssetPanel({
  analysis,
  onChange,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
}) {
  const manualMeta = analysis.manualMeta;
  if (!manualMeta) return null;
  const prompts = manualRiskPromptsForAssetType(analysis.assetType);

  function updateManualMeta(patch: Partial<NonNullable<Analysis["manualMeta"]>>) {
    onChange({ ...analysis, manualMeta: { ...manualMeta, ...patch } as NonNullable<Analysis["manualMeta"]> });
  }

  return (
    <div className="tp-card tp-card--wide" data-qa="manual-asset-panel">
      <div className="tp-card-h">
        Private or custom asset
        <span className="tp-card-hint">Uses your own valuation and notes</span>
      </div>
      <div className="tp-meta-grid">
        <input data-qa="manual-asset-name" className="meta-input" placeholder="Asset name" value={analysis.assetName} onChange={(e) => onChange({ ...analysis, assetName: e.target.value })} />
        <input
          data-qa="manual-valuation-amount"
          className="meta-input"
          placeholder="Manual valuation"
          type="number"
          value={manualMeta.valuationAmount ?? ""}
          onChange={(e) => updateManualMeta({ valuationAmount: e.target.value ? Number(e.target.value) : null })}
        />
        <input data-qa="manual-valuation-date" className="meta-input" placeholder="Valuation date" value={manualMeta.valuationDate} onChange={(e) => updateManualMeta({ valuationDate: e.target.value })} />
        <input data-qa="manual-valuation-source" className="meta-input" placeholder="Valuation source" value={manualMeta.valuationSource} onChange={(e) => updateManualMeta({ valuationSource: e.target.value })} />
        <input data-qa="manual-pricing-freshness" className="meta-input" placeholder="Pricing freshness" value={manualMeta.pricingFreshness} onChange={(e) => updateManualMeta({ pricingFreshness: e.target.value })} />
        <input data-qa="manual-liquidity" className="meta-input" placeholder="Liquidity" value={manualMeta.liquidity} onChange={(e) => updateManualMeta({ liquidity: e.target.value })} />
        <input data-qa="manual-expected-duration" className="meta-input" placeholder="Expected duration" value={manualMeta.expectedDuration} onChange={(e) => updateManualMeta({ expectedDuration: e.target.value })} />
        <input data-qa="manual-portfolio-role" className="meta-input" placeholder="Portfolio role" value={manualMeta.portfolioRole} onChange={(e) => updateManualMeta({ portfolioRole: e.target.value })} />
        <input data-qa="manual-sizing-intent" className="meta-input" placeholder="Sizing intent" value={manualMeta.sizingIntent} onChange={(e) => updateManualMeta({ sizingIntent: e.target.value })} />
      </div>
      <label className="tp-thesis-field">
        <span>Outside forces to watch</span>
        <textarea
          data-qa="manual-macro-dependencies"
          rows={2}
          value={manualMeta.macroDependencies.join("\n")}
          onChange={(e) =>
            updateManualMeta({
              macroDependencies: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
            })
          }
          placeholder="Rates, FX, regulation, commodity prices, or other outside forces..."
        />
      </label>
      <div className="tp-card-h" style={{ marginTop: 12 }}>Risk notes</div>
      <div className="tp-thesis-confirm-grid">
        {prompts.map((prompt) => {
          const note = manualMeta.riskNotes.find((item) => item.promptId === prompt.id)?.note ?? "";
          return (
            <label className="tp-thesis-field" key={prompt.id}>
              <span>{prompt.label}</span>
              <textarea
                data-qa={`manual-risk-note-${prompt.id}`}
                rows={3}
                value={note}
                onChange={(e) =>
                  updateManualMeta({
                    riskNotes: manualMeta.riskNotes.map((item) =>
                      item.promptId === prompt.id ? { ...item, note: e.target.value } : item,
                    ),
                  })
                }
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCadencePanel({
  analysis,
  onChange,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
}) {
  const review = analysis.ic.review;

  function updateReview(patch: Partial<ICState["review"]>) {
    onChange({
      ...analysis,
      ic: {
        ...analysis.ic,
        review: {
          ...review,
          ...patch,
        },
      },
    });
  }

  function markReviewed() {
    const reviewedAt = nowMs();
    updateReview({
      lastReviewedAt: reviewedAt,
      nextReviewDue: nextReviewDueAfter(review, reviewedAt),
    });
  }

  const status = reviewStatus(review);

  return (
    <div className="tp-card tp-card--wide" data-qa="review-panel">
      <div className="tp-card-h">
        Check-in schedule
        <span className={`review-status is-${status.tone}`} data-qa="review-status">{status.label}</span>
      </div>
      <div className="review-summary" data-qa="review-summary">
        <span>Last reviewed: {formatReviewDate(review.lastReviewedAt)}</span>
        <span>Next check-in: {formatReviewDate(review.nextReviewDue)}</span>
        {review.cadence === "event_driven" && <span>Event-driven dates stay manual.</span>}
      </div>
      <div className="tp-meta-grid">
        <label className="tp-thesis-field">
          <span>Check-in rhythm</span>
          <select
            data-qa="review-cadence"
            className="meta-input"
            value={review.cadence}
            onChange={(e) => updateReview({ cadence: e.target.value as ReviewCadence })}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="event_driven">Event driven</option>
          </select>
        </label>
        <label className="tp-thesis-field">
          <span>Next check-in</span>
          <input
            data-qa="review-next-due"
            className="meta-input"
            type="date"
            value={toDateInputValue(review.nextReviewDue)}
            onChange={(e) => updateReview({ nextReviewDue: fromDateInputValue(e.target.value) })}
          />
        </label>
        <label className="tp-thesis-field">
          <span>Last review</span>
          <input
            data-qa="review-last-reviewed"
            className="meta-input"
            type="date"
            value={toDateInputValue(review.lastReviewedAt)}
            onChange={(e) => updateReview({ lastReviewedAt: fromDateInputValue(e.target.value) })}
          />
        </label>
      </div>
      <button type="button" className="tp-mini-btn" data-qa="review-mark-reviewed" onClick={markReviewed}>
        Mark reviewed today
      </button>
    </div>
  );
}

/** Saved IC thesis memory shown in the inspector. */
function ThesisMemoryPanel({ analysis }: { analysis: Analysis }) {
  const thesis = analysis.ic.thesis;
  const hasMemory = hasThesisDraft({
    summary: thesis.summary,
    assumptions: thesis.assumptions.map((item) => item.text),
    thesisBreakers: thesis.thesisBreakers.map((item) => item.text),
    watchItems: thesis.watchItems.map((item) => item.text),
    valuationAssumptions: thesis.valuationAssumptions.map((item) => item.text),
    catalysts: thesis.catalysts.map((item) => item.text),
    openQuestions: thesis.openQuestions.map((item) => item.text),
    evidenceCandidates: thesis.evidenceCandidates,
  });

  if (!hasMemory) {
    return (
      <div className="tp-muted-note">
        Paste rough notes in intake to extract your investment summary, what could make it work, what could go wrong, and the evidence you still need.
      </div>
    );
  }

  return (
    <div className="tp-thesis-panel">
      {thesis.summary && <div className="tp-thesis-summary">{thesis.summary}</div>}
      <div className="tp-thesis-grid">
        <ThesisMiniList title="Why this could work" items={thesis.assumptions.map((item) => item.text)} tone="neutral" />
        <ThesisMiniList title="What could go wrong" items={thesis.thesisBreakers.map((item) => item.text)} tone="bear" />
        <ThesisMiniList title="What to watch" items={thesis.watchItems.map((item) => item.text)} tone="warning" />
        <ThesisMiniList title="Price assumptions" items={thesis.valuationAssumptions.map((item) => item.text)} tone="neutral" />
        <ThesisMiniList title="Catalysts" items={thesis.catalysts.map((item) => item.text)} tone="bull" />
        <ThesisMiniList title="What I still need to verify" items={thesis.openQuestions.map((item) => item.text)} tone="warning" />
      </div>
    </div>
  );
}

function TriageKickoffPanel({
  analysis,
  promptNote,
  onBeginFactCheck,
}: {
  analysis: Analysis;
  promptNote: string;
  onBeginFactCheck: () => void;
}) {
  const thesis = analysis.ic.thesis;

  return (
    <div className="tp-stream-empty" data-qa="triage-kickoff">
      <div className="tp-stream-empty-h">Saved kickoff</div>
      <p>
        You saved <strong>{analysis.title}</strong> from Explore. This is now a real review, but the facts are not confirmed yet.
      </p>
      {thesis.summary && <div className="tp-thesis-summary">{thesis.summary}</div>}
      <div className="tp-thesis-grid">
        <ThesisMiniList title="What I still need to verify" items={thesis.openQuestions.map((item) => item.text)} tone="warning" />
        <ThesisMiniList title="What could go wrong" items={thesis.thesisBreakers.map((item) => item.text)} tone="bear" />
      </div>
      {promptNote && (
        <div className="tp-muted-note">
          <strong>From Explore:</strong> {promptNote}
        </div>
      )}
      <div className="tp-recovery-list">
        <div className="tp-recovery-row">
          <span>Next step: name a company, paste a ticker, add notes, or attach a source so the review can start checking the facts.</span>
          <button className="tp-mini-btn" type="button" data-qa="triage-kickoff-begin" onClick={onBeginFactCheck}>
            Check the facts
          </button>
        </div>
      </div>
    </div>
  );
}

const EVIDENCE_RELATIONS: EvidenceRelation[] = ["supporting", "contradictory", "neutral", "unresolved"];
const EVIDENCE_TYPES: EvidenceType[] = [
  "filing",
  "article",
  "note",
  "transcript",
  "market_data",
  "pitch_deck",
  "memo",
  "screenshot",
  "pdf",
  "deal_document",
  "other",
];
const EVIDENCE_RELIABILITIES: EvidenceReliability[] = ["official", "third_party", "user_provided", "unknown"];

function evidenceMatchesCandidate(item: EvidenceItem, candidate: Analysis["ic"]["thesis"]["evidenceCandidates"][number]): boolean {
  const candidateUrl = candidate.url?.trim().toLowerCase();
  if (candidateUrl && item.url?.trim().toLowerCase() === candidateUrl) return true;
  return !candidateUrl && !item.url && item.title.trim().toLowerCase() === candidate.title.trim().toLowerCase();
}

function refKey(ref: ThesisRef): string {
  return `${ref.target}:${ref.id ?? "summary"}`;
}

function EvidenceLocker({ analysis, onChange }: { analysis: Analysis; onChange: (next: Analysis) => void }) {
  const [relationFilter, setRelationFilter] = useState<EvidenceRelation | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EvidenceType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EvidenceItem | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const thesis = analysis.ic.thesis;
  const evidence = analysis.evidence ?? [];
  const visibleEvidence = filterEvidence(evidence, { relation: relationFilter, type: typeFilter });
  const grouped = groupEvidenceByRelation(visibleEvidence);
  const thesisOptions = thesisRefOptions(thesis);
  const sourceIds = new Set(analysis.sources.map((source) => source.id));

  function setEvidence(next: EvidenceItem[]) {
    onChange({ ...analysis, evidence: next });
  }

  function addItem(kind: "note" | "link") {
    setError(null);
    const title = kind === "note" ? noteTitle.trim() : linkTitle.trim();
    const url = linkUrl.trim();
    if (!title) {
      setError("Evidence title is required.");
      return;
    }
    if (kind === "link" && !isValidEvidenceUrl(url)) {
      setError("Enter a valid http(s) URL.");
      return;
    }
    const item = createEvidenceItem({
      title,
      type: kind === "link" ? "article" : "note",
      url: kind === "link" ? url : undefined,
    });
    setEvidence([item, ...evidence]);
    setExpandedId(item.id);
    setDraft(item);
    setNoteTitle("");
    setLinkTitle("");
    setLinkUrl("");
  }

  function promoteCandidate(candidate: Analysis["ic"]["thesis"]["evidenceCandidates"][number]) {
    if (evidence.some((item) => evidenceMatchesCandidate(item, candidate))) return;
    const item = promoteEvidenceCandidate(candidate);
    setEvidence([item, ...evidence]);
    setExpandedId(item.id);
    setDraft(item);
  }

  function openEditor(item: EvidenceItem) {
    setError(null);
    setExpandedId(expandedId === item.id ? null : item.id);
    setDraft(expandedId === item.id ? null : { ...item, sourceRefIds: [...item.sourceRefIds], thesisRefs: [...item.thesisRefs] });
  }

  function saveDraft() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      setError("Evidence title is required.");
      return;
    }
    if (draft.url && !isValidEvidenceUrl(draft.url)) {
      setError("Enter a valid http(s) URL.");
      return;
    }
    const next: EvidenceItem = {
      ...draft,
      title,
      sourceDate: draft.sourceDate?.trim() || null,
      ...(draft.url?.trim() ? { url: draft.url.trim() } : { url: undefined }),
      ...(draft.note?.trim() ? { note: draft.note.trim() } : { note: undefined }),
      updatedAt: nowMs(),
    };
    setEvidence(evidence.map((item) => (item.id === next.id ? next : item)));
    setExpandedId(null);
    setDraft(null);
    setError(null);
  }

  function deleteItem(id: string) {
    setEvidence(evidence.filter((item) => item.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
      setDraft(null);
    }
  }

  function toggleSource(sourceId: string, checked: boolean) {
    if (!draft) return;
    setDraft(checked ? linkEvidenceSource(draft, sourceId) : unlinkEvidenceSource(draft, sourceId));
  }

  function toggleThesisRef(ref: ThesisRef, checked: boolean) {
    if (!draft) return;
    const key = refKey(ref);
    const refs = checked
      ? [...draft.thesisRefs.filter((item) => refKey(item) !== key), ref]
      : draft.thesisRefs.filter((item) => refKey(item) !== key);
    setDraft({ ...draft, thesisRefs: refs, updatedAt: nowMs() });
  }

  return (
    <div className="tp-card tp-card--wide" data-qa="evidence-locker">
      <div className="tp-card-h">
        What I still need to verify
        <span className="tp-card-hint">{evidence.length} item{evidence.length === 1 ? "" : "s"}</span>
      </div>

      <div className="tp-evidence-create">
        <input data-qa="evidence-note-title" className="tp-evidence-input" placeholder="New note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
        <button type="button" data-qa="evidence-add-note" className="tp-mini-btn" onClick={() => addItem("note")}>Add note</button>
        <input data-qa="evidence-link-title" className="tp-evidence-input" placeholder="Link title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
        <input data-qa="evidence-link-url" className="tp-evidence-input" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <button type="button" data-qa="evidence-add-link" className="tp-mini-btn" onClick={() => addItem("link")}>Add link</button>
      </div>

      {thesis.evidenceCandidates.length > 0 && (
        <div className="tp-evidence-candidates">
          <div className="tp-thesis-evidence-h">Candidate queue</div>
          {thesis.evidenceCandidates.map((candidate) => {
            const promoted = evidence.some((item) => evidenceMatchesCandidate(item, candidate));
            return (
              <div className="tp-evidence-candidate" key={candidate.id}>
                <span>{candidate.title}</span>
                <em>{candidate.relation}</em>
                <button type="button" data-qa={`evidence-promote-${candidate.id}`} className="tp-mini-btn" onClick={() => promoteCandidate(candidate)} disabled={promoted}>
                  {promoted ? "In locker" : "Promote"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="tp-evidence-filters">
        <select value={relationFilter} onChange={(e) => setRelationFilter(e.target.value as EvidenceRelation | "all")}>
          <option value="all">All relations</option>
          {EVIDENCE_RELATIONS.map((relation) => <option key={relation} value={relation}>{relation}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as EvidenceType | "all")}>
          <option value="all">All types</option>
          {EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {error && <div className="tp-evidence-error">{error}</div>}

      {evidence.length === 0 ? (
        <div className="tp-muted-note">Create a note or link, or promote an intake candidate to preserve evidence for this investment review.</div>
      ) : (
        <div className="tp-evidence-list">
          {EVIDENCE_RELATIONS.map((relation) => {
            const rows = grouped[relation];
            if (!rows.length) return null;
            return (
              <div className="tp-evidence-group" key={relation}>
                <div className="tp-thesis-evidence-h">{relation}</div>
                {rows.map((item) => {
                  const activeRefs = item.sourceRefIds.filter((id) => sourceIds.has(id)).length;
                  const brokenRefs = item.sourceRefIds.length - activeRefs;
                  const isOpen = expandedId === item.id && draft?.id === item.id;
                  return (
                    <div className="tp-evidence-row" key={item.id}>
                      <button type="button" className="tp-evidence-row-main" onClick={() => openEditor(item)}>
                        <span className="tp-evidence-title">{item.title}</span>
                        <span className="tp-evidence-meta">
                          {item.type.replace(/_/g, " ")} / {item.reliability.replace(/_/g, " ")}
                          {activeRefs > 0 && ` / ${activeRefs} active source${activeRefs === 1 ? "" : "s"}`}
                          {brokenRefs > 0 && ` / ${brokenRefs} broken ref${brokenRefs === 1 ? "" : "s"}`}
                        </span>
                      </button>
                      {item.url && <a className="tp-evidence-url" href={item.url} target="_blank" rel="noreferrer">open</a>}
                      <button type="button" className="tp-pos-del" onClick={() => deleteItem(item.id)} title="Delete evidence">x</button>
                      {isOpen && draft && (
                        <div className="tp-evidence-editor">
                          <input className="tp-evidence-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
                          <div className="tp-evidence-editor-grid">
                            <select value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value as EvidenceRelation })}>
                              {EVIDENCE_RELATIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                            <select value={draft.reliability} onChange={(e) => setDraft({ ...draft, reliability: e.target.value as EvidenceReliability })}>
                              {EVIDENCE_RELIABILITIES.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
                            </select>
                            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as EvidenceType })}>
                              {EVIDENCE_TYPES.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
                            </select>
                            <input data-qa="evidence-source-date" className="tp-evidence-input" value={draft.sourceDate ?? ""} onChange={(e) => setDraft({ ...draft, sourceDate: e.target.value })} placeholder="Source date" />
                          </div>
                          <input data-qa="evidence-url" className="tp-evidence-input" value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://..." />
                          <textarea data-qa="evidence-note" className="tp-evidence-note" rows={3} value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Note" />

                          <div className="tp-evidence-linkers">
                            <div>
                              <div className="tp-thesis-evidence-h">Source links</div>
                              {analysis.sources.length === 0 ? (
                                <div className="tp-evidence-empty">No attached sources.</div>
                              ) : (
                                analysis.sources.map((source) => (
                                  <label className="tp-evidence-check" key={source.id}>
                                    <input type="checkbox" checked={draft.sourceRefIds.includes(source.id)} onChange={(e) => toggleSource(source.id, e.target.checked)} />
                                    <span>{formatSourceRefLabel(source.id, analysis.sources)}</span>
                                  </label>
                                ))
                              )}
                              {draft.sourceRefIds.filter((id) => !sourceIds.has(id)).map((id) => (
                                <div className="tp-evidence-broken" key={id}>{formatSourceRefLabel(id, analysis.sources)}</div>
                              ))}
                            </div>
                            <div>
                              <div className="tp-thesis-evidence-h">Thesis refs</div>
                              {thesisOptions.length === 0 ? (
                                <div className="tp-evidence-empty">No thesis refs available.</div>
                              ) : (
                                thesisOptions.map(({ ref, label }) => (
                                  <label className="tp-evidence-check" key={refKey(ref)}>
                                    <input type="checkbox" checked={draft.thesisRefs.some((item) => refKey(item) === refKey(ref))} onChange={(e) => toggleThesisRef(ref, e.target.checked)} />
                                    <span>{label}</span>
                                  </label>
                                ))
                              )}
                              {draft.thesisRefs.filter((ref) => !thesisOptions.some((option) => refKey(option.ref) === refKey(ref))).map((ref) => (
                                <div className="tp-evidence-broken" key={refKey(ref)}>{formatThesisRefLabel(ref, thesis)}</div>
                              ))}
                            </div>
                          </div>

                          <div className="tp-evidence-actions">
                            <button type="button" data-qa="evidence-save" className="tp-confirm-btn" onClick={saveDraft}>Save</button>
                            <button type="button" className="tp-ghost" onClick={() => { setExpandedId(null); setDraft(null); setError(null); }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StockFieldBadgePill({ field }: { field: StockFieldRecord }) {
  return <span className={`tp-stock-pill${stockFieldBadgeTone(field)}`}>{stockFieldBadge(field)}</span>;
}

function StockFieldSourceDetails({ field }: { field: StockFieldRecord }) {
  const provenance = field.provenance;
  const title = provenance?.title || "";
  const url = provenance?.url || "";
  const meta = stockFieldMeta(field);
  const note = field.note?.trim() || "";

  if (!title && !url && !meta.length && !note) return null;

  return (
    <div className="tp-stock-source">
      {(title || url) && (
        <div className="tp-stock-source-head">
          {url ? (
            <a className="tp-stock-source-link" href={url} target="_blank" rel="noreferrer">
              {title || url}
            </a>
          ) : (
            <span className="tp-stock-source-title">{title}</span>
          )}
        </div>
      )}
      {meta.length > 0 && (
        <div className="tp-stock-meta">
          {meta.map((item) => (
            <span className="tp-stock-meta-item" key={`${field.key}-${item}`}>
              {item}
            </span>
          ))}
        </div>
      )}
      {note && <div className="tp-stock-note">{note}</div>}
    </div>
  );
}

function StockFieldInspectorPanel({ fields }: { fields: StockFieldRecord[] }) {
  return (
    <div className="tp-stock-fields" data-qa="stock-fields">
      {fields.map((field) => (
        <div className={`tp-stock-row${stockFieldTone(field)}`} data-qa={`stock-field-${field.key}`} key={`${field.key}-${field.origin}-${field.value}`}>
          <div className="tp-stock-row-top">
            <div className="tp-stock-row-copy">
              <div className="tp-stock-label">{stockFieldLabel(field)}</div>
              <div className="tp-stock-value">{stockFieldValue(field)}</div>
            </div>
            <StockFieldBadgePill field={field} />
          </div>
          <StockFieldSourceDetails field={field} />
        </div>
      ))}
    </div>
  );
}

function ThesisMiniList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "bull" | "bear" | "warning" | "neutral";
}) {
  if (!items.length) return null;
  return (
    <div className="tp-thesis-mini">
      <div className={`tp-thesis-mini-h ${tone === "neutral" ? "" : `${tone}-text`}`}>{title}</div>
      <ul>
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function GroundChip({ result }: { result: GroundingResult }) {
  if (result.clean) {
    return <span className="tp-ground" title="Every figure in the analysis traces to the deterministic engine">✓ Grounded</span>;
  }
  return (
    <span className="tp-ground tp-ground--warn" title={`Unverified figure(s): ${result.flagged.map((f) => f.raw).join(", ")}`}>
      ⚠ {result.flagged.length} unverified
    </span>
  );
}

/** Inline marker under a chat reply when it contains an ungrounded number. */
function ChatGroundFlag({ result }: { result: GroundingResult }) {
  if (result.clean) return null;
  return (
    <div className="tp-ground-msg" title={`Not traced to the engine: ${result.flagged.map((f) => f.raw).join(", ")}`}>
      ⚠ {result.flagged.length} unverified figure{result.flagged.length > 1 ? "s" : ""}
    </div>
  );
}

function DebateSide({ side, label, lines }: { side: "bull" | "bear"; label: string; lines: DebateLine[] }) {
  return (
    <div className="tp-debate-col">
      <div className={`tp-debate-h ${side === "bull" ? "tp-bull-text" : "tp-bear-text"}`}>{label}</div>
      <ul className="tp-points">
        {lines.map((l, i) => (
          <li key={i}>
            {l.slot && <span className="tp-slot">{l.slot}</span>}
            <b>{l.agent}</b> — {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewList({ title, items, tone }: { title: string; items: string[]; tone: "bull" | "bear" | "warning" }) {
  if (!items?.length) return null;
  return (
    <div className="review-list">
      <div className={`review-list-title ${tone}-text`}>{title}</div>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

const VERTICAL_CYCLE: Vertical[] = ["stocks", "startups", "conventional"];

/**
 * The intake confirm card. Renders the extracted, source-tagged figures for the
 * (overridable) vertical: amber editable inputs for inferred values, static "✓ you
 * typed" rows for stated ones. Confirming hands the chosen vertical + final values
 * up to `confirmIntake`, which locks them through the engine and runs the debate.
 * Remounted on each new draft via a `key`, so local edits reset cleanly.
 */
function ConfirmCard({
  intake,
  busy,
  onConfirm,
  onCancel,
}: {
  intake: IntakeResult;
  busy: boolean;
  onConfirm: (
    vertical: Vertical,
    values: Record<string, number>,
    thesis: ThesisIntakeDraft,
    stockFields?: StockFieldRecord[],
  ) => void;
  onCancel: () => void;
}) {
  const [vertical, setVertical] = useState<Vertical>(intake.vertical);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(intake.fields.map((f) => [f.key, f.value])),
  );
  const [thesis, setThesis] = useState<ThesisIntakeDraft>(intake.thesis);
  const [manualUse, setManualUse] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      intake.fields
        .filter((field) => field.origin === "candidate" || field.origin === "derived_candidate")
        .map((field) => [field.key, false]),
    ),
  );

  const known = new Map(intake.fields.map((f) => [String(f.key), f]));
  // Only show this vertical's fields that we actually extracted a value for.
  const rows = FIELDS[vertical].filter((f) => known.has(String(f.key)));

  function cycleVertical() {
    setVertical((v) => VERTICAL_CYCLE[(VERTICAL_CYCLE.indexOf(v) + 1) % VERTICAL_CYCLE.length]);
  }

  function confirm() {
    const out: Record<string, number> = {};
    const confirmedStockFields: StockFieldRecord[] = [];
    const now = nowMs();
    for (const f of rows) {
      const key = String(f.key);
      const meta = known.get(key)!;
      const value = Number(values[key] ?? meta.value);
      if (!Number.isFinite(value)) continue;
      if (vertical !== "stocks") {
        out[key] = value;
        continue;
      }

      const origin = meta.origin ?? (meta.source === "stated" ? "user_fact" : "candidate");
      const autoLock = origin === "user_fact" || origin === "sourced_fact";
      const manualLock = manualUse[key] === true;
      const shouldLock = autoLock || manualLock;

      let record: StockFieldRecord = {
        key,
        value,
        source: meta.source,
        origin,
        lockable: Boolean(meta.lockable),
        provenance: meta.provenance ?? null,
        ...(meta.note ? { note: meta.note } : {}),
      };

      if (origin === "user_fact" || manualLock) {
        record = {
          key,
          value,
          source: "stated",
          origin: "user_fact",
          lockable: true,
          provenance: buildUserProvidedStockProvenance(now),
        };
      }

      confirmedStockFields.push(record);
      if (shouldLock && key !== "invested") out[key] = value;
    }

    if (vertical === "stocks" && Number.isFinite(out.price) && !Number.isFinite(out.invested)) {
      out.invested = out.price;
      const invested = confirmedStockFields.find((field) => field.key === "invested");
      if (invested) {
        invested.value = out.price;
        invested.provenance = buildDerivedStockProvenance(now);
      } else {
        confirmedStockFields.push({
          key: "invested",
          value: out.price,
          source: "inferred",
          origin: "derived_candidate",
          lockable: false,
          provenance: buildDerivedStockProvenance(now),
          note: "Derived from the locked share price for engine continuity.",
        });
      }
    }
    onConfirm(vertical, out, thesis, vertical === "stocks" ? confirmedStockFields : undefined);
  }

  function setThesisList(key: keyof Pick<ThesisIntakeDraft, "assumptions" | "thesisBreakers" | "watchItems" | "valuationAssumptions" | "catalysts" | "openQuestions">, text: string) {
    setThesis((current) => ({ ...current, [key]: text.split("\n").map((line) => line.trim()).filter(Boolean) }));
  }

  return (
    <div className="tp-confirm">
      <div className="tp-confirm-h">Check the facts before you review</div>
      <div className="tp-confirm-vrow">
        <span className="tp-confirm-vlbl">Investment type</span>
        <span className="tp-confirm-vchip">{VERTICAL_SHORT[vertical]}</span>
        <button type="button" className="tp-confirm-change" onClick={cycleVertical} disabled={busy}>
          change
        </button>
      </div>
      <div className="tp-confirm-note">
        Amber rows were <b>inferred</b> — check them first. The ✓ rows you typed are ready.
        {vertical === "stocks" && " DCF cashflows are proxied from EPS until refined."}
      </div>
      <div className="tp-thesis-confirm">
        <label className="tp-thesis-field">
          <span>Why I might invest</span>
          <textarea
            rows={2}
            value={thesis.summary}
            onChange={(e) => setThesis((current) => ({ ...current, summary: e.target.value }))}
            disabled={busy}
            placeholder="Why this investment may deserve attention..."
          />
        </label>
        <div className="tp-thesis-confirm-grid">
          <ThesisListEditor label="Why this could work" value={thesis.assumptions} onChange={(text) => setThesisList("assumptions", text)} disabled={busy} />
          <ThesisListEditor label="What could go wrong" value={thesis.thesisBreakers} onChange={(text) => setThesisList("thesisBreakers", text)} disabled={busy} />
          <ThesisListEditor label="What to watch" value={thesis.watchItems} onChange={(text) => setThesisList("watchItems", text)} disabled={busy} />
          <ThesisListEditor label="Price assumptions" value={thesis.valuationAssumptions} onChange={(text) => setThesisList("valuationAssumptions", text)} disabled={busy} />
          <ThesisListEditor label="Catalysts" value={thesis.catalysts} onChange={(text) => setThesisList("catalysts", text)} disabled={busy} />
          <ThesisListEditor label="What I still need to verify" value={thesis.openQuestions} onChange={(text) => setThesisList("openQuestions", text)} disabled={busy} />
        </div>
        {thesis.evidenceCandidates.length > 0 && (
          <div className="tp-thesis-evidence">
            <div className="tp-thesis-evidence-h">Evidence to review</div>
            {thesis.evidenceCandidates.map((candidate, i) => (
              <div className="tp-thesis-evidence-row" key={`${candidate.title}-${i}`}>
                <span>{candidate.title}</span>
                <em>{candidate.relation ?? "unresolved"}</em>
              </div>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="tp-muted-note">
            No figures map to {VERTICAL_SHORT[vertical]} yet. You can still save the working view now and add valuation figures later.
        </div>
      ) : (
        rows.map((f) => {
          const meta = known.get(String(f.key))!;
          const inferred = meta.source === "inferred";
          const candidate = meta.origin === "candidate" || meta.origin === "derived_candidate";
          const stockMeta = meta as StockFieldRecord;
          const rowTone = vertical === "stocks" ? stockFieldTone(stockMeta) : inferred ? " is-inferred" : "";
          return (
            <div className={`tp-confirm-row${rowTone}`} key={String(f.key)}>
              <div className="tp-confirm-main">
                <span className="tp-confirm-k">{f.label}</span>
              {inferred ? (
                <input
                  className="tp-confirm-input"
                  type="number"
                  value={Number.isFinite(values[String(f.key)]) ? values[String(f.key)] : ""}
                  onChange={(e) => setValues((s) => ({ ...s, [String(f.key)]: parseFloat(e.target.value) }))}
                  disabled={busy}
                />
              ) : (
                <span className="tp-confirm-v">{fmtVal(Number(values[String(f.key)] ?? meta.value), f.type)}</span>
              )}
              {vertical === "stocks" && <StockFieldBadgePill field={stockMeta} />}
              <span className={inferred ? "tp-confirm-flag" : "tp-confirm-ok"} style={vertical === "stocks" ? { display: "none" } : undefined}>
                {inferred ? "inferred · check" : "✓ you typed"}
              </span>
              </div>
              {vertical === "stocks" && (
                <div className="tp-confirm-prov">
                  {candidate && (
                    <label className="tp-confirm-checkbox">
                      <input
                        type="checkbox"
                        checked={manualUse[String(f.key)] === true}
                        onChange={(e) => setManualUse((current) => ({ ...current, [String(f.key)]: e.target.checked }))}
                        disabled={busy}
                      />
                      <span>Use as my locked value</span>
                    </label>
                  )}
                  <StockFieldSourceDetails field={stockMeta} />
                </div>
              )}
            </div>
          );
        })
      )}
      <div className="tp-confirm-actions">
        <button type="button" className="tp-confirm-btn" onClick={confirm} disabled={busy}>
          {busy ? "Saving..." : intake.mode === "scoping" ? "Save working view" : "Confirm these facts"}
        </button>
        <button type="button" className="tp-ghost" onClick={onCancel} disabled={busy}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ThesisListEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="tp-thesis-field">
      <span>{label}</span>
      <textarea rows={3} value={value.join("\n")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </label>
  );
}

/** Render inline **bold** / _italic_ markdown in a report line. */
function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("_") && p.endsWith("_")) return <i key={i}>{p.slice(1, -1)}</i>;
    return <span key={i}>{p}</span>;
  });
}

/** Renders a templated `kind:"report"` chat message (paragraphs + bullet lists). */
function ReportBody({ content }: { content: string }) {
  const blocks = content.split("\n\n");
  return (
    <div className="tp-report">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
          return (
            <ul className="tp-report-list" key={i}>
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p className="tp-report-p" key={i}>
            {renderInline(b)}
          </p>
        );
      })}
    </div>
  );
}
