"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, AssetParameters, DecisionAction, ChatMessage, ContextSource, DebateLine } from "@/lib/domain/types";
import { calcDCF, calcBEP } from "@/lib/finance";
import { computeMetrics } from "@/lib/finance/compute";
import { putBlob, deleteBlob } from "@/lib/repo";
import { getProvider } from "@/lib/ai/registry";
import { personaFor } from "@/lib/ai/personas";
import { buildReport } from "@/lib/ai/report";
import type { ProviderId } from "@/lib/ai/types";
import type { IntakeResult } from "@/lib/ai/schemas";
import { StocksChart, StartupsChart, ConventionalChart } from "./charts";
import { BLANK_PARAMS, VERTICAL_SHORT, type Vertical } from "@/data/presets";
import { FIELDS, fmtVal } from "@/data/fields";

const MIN_W = 340;
const MAX_W = 760;

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

export default function AnalysisView({
  analysis,
  onChange,
  provider,
  apiKey,
  model,
  onNeedSettings,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
  provider: ProviderId;
  apiKey: string;
  model: string;
  onNeedSettings: () => void;
}) {
  const [action, setAction] = useState<DecisionAction>(analysis.decision?.action ?? "APPROVE");
  const [reviewing, setReviewing] = useState(false);
  const [notes, setNotes] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [runPhase, setRunPhase] = useState<"" | "research" | "debate">("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Intake (Option C): when there's no debate yet, the composer drives a structured
  // intake → confirm-card → lock → debate flow instead of grounded follow-up chat.
  const intakeMode = !analysis.debate;
  const [pendingIntake, setPendingIntake] = useState<IntakeResult | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [intakeNonce, setIntakeNonce] = useState(0); // remounts ConfirmCard on a new draft

  // Two-pane: collapsible + VS-Code-style resizable inspector (docked right).
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorW, setInspectorW] = useState(460);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const onGutterDown = useCallback(() => setDragging(true), []);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: MouseEvent) => {
      const right = rootRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      setInspectorW(Math.min(MAX_W, Math.max(MIN_W, right - ev.clientX)));
    };
    const onUp = () => setDragging(false);
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

  const isLive = !!analysis.model && analysis.model !== "seed";

  async function runAI() {
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
    const text = chatInput.trim();
    if (!text || chatBusy || intakeBusy || running) return;
    if (!apiKey) return onNeedSettings();
    setChatInput("");
    if (intakeMode) submitIntake(text);
    else sendFollowUp(text);
  }

  /** Grounded follow-up chat (only after a debate exists). */
  async function sendFollowUp(text: string) {
    setPendingUser(text);
    setStreamingText("");
    setChatBusy(true);
    setAiError(null);
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
    const now = Date.now();
    const userMsg: ChatMessage = { id: `${now}-u`, role: "user", content: text, createdAt: now };
    // Persist the user turn explicitly so we don't read the stale `analysis` prop later.
    const withUser: Analysis = { ...analysis, chat: [...analysis.chat, userMsg] };
    onChange(withUser);
    setIntakeBusy(true);
    setAiError(null);
    try {
      const result = await getProvider(provider).runIntake({
        apiKey,
        model,
        userText: text,
        sources: analysis.sources,
      });
      if (result.mode === "scoping") {
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
    }
  }

  /**
   * Confirm handler: lock the (possibly edited) figures via the engine and auto-run
   * the persona debate, then post the written report. Builds the next Analysis
   * EXPLICITLY (the `analysis` prop won't reflect onChange synchronously).
   */
  async function confirmIntake(vertical: Vertical, values: Record<string, number>) {
    if (!pendingIntake) return;
    if (!apiKey) return onNeedSettings();
    const parameters: AssetParameters = { ...BLANK_PARAMS[vertical], ...values };
    // Stocks DCF cashflows aren't user-facing — proxy from the (confirmed) EPS.
    if (vertical === "stocks") parameters.cashflows = Array(5).fill(Number(parameters.eps ?? 0));
    const persona = personaFor(vertical);
    const next: Analysis = {
      ...analysis,
      vertical,
      assetName: pendingIntake.assetName || analysis.assetName,
      title: pendingIntake.title || analysis.title,
      parameters,
      metrics: computeMetrics(vertical, parameters),
      persona: { id: persona.id, label: persona.label },
      model,
    };
    onChange(next);
    setPendingIntake(null);
    setRunning(true);
    setRunPhase("");
    setAiError(null);
    try {
      const out = await getProvider(provider).runAnalysis({ apiKey, model, analysis: next, onPhase: setRunPhase });
      const after: Analysis = { ...next, debate: out.debate, advisory: out.advisory, stance: out.stance };
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
    const parameters = { ...analysis.parameters, [key]: value } as AssetParameters;
    update({ parameters, metrics: computeMetrics(analysis.vertical, parameters) });
  }

  function addTag() {
    const t = tagDraft.trim().toLowerCase();
    if (t && !analysis.tags.includes(t)) update({ tags: [...analysis.tags, t] });
    setTagDraft("");
  }

  function commitDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) return;
    update({
      decision: { action, rationale: notes.trim(), decidedAt: Date.now() },
      status: "decided",
    });
    setNotes("");
  }

  const metrics = analysis.metrics.metrics;
  const advisory = analysis.advisory ?? [];

  return (
    <div className="tp-root" ref={rootRef} style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}>
      {/* ---- top bar: title + status + primary RUN AI + inspector toggle ---- */}
      <header className="tp-topbar">
        <div className="tp-title-wrap">
          <input className="tp-title" value={analysis.title} onChange={(e) => update({ title: e.target.value })} />
          <span className={`status-pill status-${analysis.status}`}>{analysis.status.toUpperCase()}</span>
          {analysis.persona && (
            <span className="persona-badge" title="Domain expert that produced this analysis">{analysis.persona.label}</span>
          )}
          <span className={`tp-mode${intakeMode ? " is-intake" : " is-locked"}`} title={intakeMode ? "Intake — describe a deal to extract & confirm figures" : "Figures locked through the deterministic engine"}>
            ● {intakeMode ? "INTAKE" : "FIGURES LOCKED"}
          </span>
          <span className={`sim-badge${isLive ? " live" : ""}`} title={isLive ? `Live AI (${analysis.model})` : "Seed content — run AI for a grounded debate"}>
            {isLive ? "LIVE" : "SEED"}
          </span>
        </div>
        <div className="tp-topbar-actions">
          <button className="tp-run-btn" onClick={runAI} disabled={running}>
            {running ? (runPhase === "research" ? "RESEARCHING…" : "DEBATING…") : "⚡ RUN AI"}
          </button>
          <button className="tp-ghost" onClick={() => setInspectorOpen((v) => !v)}>
            {inspectorOpen ? "Hide inspector ›" : "‹ Show inspector"}
          </button>
        </div>
      </header>
      {aiError && <div className="tp-error">⚠ {aiError}</div>}

      <div className="tp-split">
        {/* ================= LEFT: conversation ================= */}
        <main className="tp-convo">
          <div className="tp-stream scrollable">
            {analysis.chat.length === 0 && !pendingUser && !pendingIntake && !intakeBusy && (
              <div className="tp-stream-empty">
                <div className="tp-stream-empty-h">Start with {analysis.persona?.label ?? "the analyst"}</div>
                Paste or describe a deal — I&apos;ll detect the type, pull the figures, and confirm before
                locking. Once the figures lock, the persona debate runs and a written read posts here; then
                you can follow up — e.g. &quot;stress-test the discount rate&quot;, &quot;why is the bear wrong?&quot;.
                Numbers stay locked to the deterministic engine.
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
                <div className="tp-msg-body">Reading the deal and pulling the figures…</div>
              </div>
            )}
            {pendingIntake && !intakeBusy && (
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
                <div className="tp-msg-body">{runPhase === "research" ? "Researching…" : "Locking figures and running the debate…"}</div>
              </div>
            )}
          </div>

          <div className="tp-composer">
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
                className="tp-input"
                rows={2}
                placeholder={intakeMode ? "Paste or describe a deal to analyze…" : "Ask a grounded follow-up…"}
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
                {intakeMode ? (intakeBusy ? "…" : "Analyze ↵") : chatBusy ? "…" : "Send ↵"}
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
              <span>INSPECTOR</span>
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
              {/* locked figures (sliders) */}
              <div className="tp-card">
                <div className="tp-card-h">Locked figures <span className="tp-card-hint">editable</span></div>
                <form className="tp-figs" onSubmit={(e) => e.preventDefault()}>
                  {FIELDS[analysis.vertical].map((f) => {
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
                <div className="tp-card-h">Engine chart <span className="tp-card-hint">deterministic</span></div>
                <div className="chart-wrapper">{chartFor(analysis.vertical, analysis.parameters)}</div>
              </div>

              {/* debate */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Red-team debate
                  {analysis.debate && (
                    <span className="tp-badge tp-badge-support">THESIS {analysis.debate.thesisSupport}</span>
                  )}
                </div>
                {!analysis.debate ? (
                  <div className="tp-muted-note">Run AI to generate the grounded bull/bear debate.</div>
                ) : (
                  <div className="tp-debate">
                    <DebateSide side="bull" label="▲ BULL" lines={analysis.debate.bull} />
                    <DebateSide side="bear" label="▼ BEAR" lines={analysis.debate.bear} />
                  </div>
                )}
              </div>

              {/* advisory lenses */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Advisory board <span className="tp-card-hint">{analysis.persona?.label ?? "lenses"}</span></div>
                <div className="tp-lenses">
                  {advisory.length === 0 ? (
                    <div className="tp-muted-note">Run AI to generate the advisory lenses.</div>
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
                <div className="tp-card-h">Make the call</div>
                {analysis.decision && (
                  <div className={`current-decision ${analysis.decision.action}`}>
                    Current: <strong>{analysis.decision.action}</strong> — &quot;{analysis.decision.rationale}&quot;
                  </div>
                )}
                <form className="decision-form" onSubmit={commitDecision}>
                  <div className="form-row">
                    <label htmlFor="decision-select">Executive action</label>
                    <select id="decision-select" value={action} onChange={(e) => setAction(e.target.value as DecisionAction)}>
                      <option value="APPROVE">APPROVE / SWING CAPITAL</option>
                      <option value="HOLD">HOLD / MONITOR</option>
                      <option value="REJECT">REJECT</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="decision-notes">Rationale</label>
                    <textarea id="decision-notes" rows={2} placeholder="Investor's rationale…" value={notes} onChange={(e) => setNotes(e.target.value)} required />
                  </div>
                  <button type="submit" className="commit-btn">COMMIT DECISION</button>
                </form>
              </div>

              {/* expert review */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Expert review
                  <button className="tp-mini-btn" onClick={runReview} disabled={reviewing || !analysis.debate} title={analysis.debate ? "Red-team this analysis — one extra AI call" : "Run AI first"}>
                    {reviewing ? "REVIEWING…" : analysis.expertReview ? "Re-review" : "⚖ Get review"}
                  </button>
                </div>
                {!analysis.expertReview ? (
                  <div className="tp-muted-note">A second {analysis.persona?.label ?? "expert"} red-teams the analysis (strengths, gaps, grounding check). On demand — one extra AI call.</div>
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
                <div className="tp-card-h">Asset details</div>
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
            </div>
          </aside>
        )}
      </div>
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
  onConfirm: (vertical: Vertical, values: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const [vertical, setVertical] = useState<Vertical>(intake.vertical);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(intake.fields.map((f) => [f.key, f.value])),
  );

  const known = new Map(intake.fields.map((f) => [String(f.key), f]));
  // Only show this vertical's fields that we actually extracted a value for.
  const rows = FIELDS[vertical].filter((f) => known.has(String(f.key)));

  function cycleVertical() {
    setVertical((v) => VERTICAL_CYCLE[(VERTICAL_CYCLE.indexOf(v) + 1) % VERTICAL_CYCLE.length]);
  }

  function confirm() {
    // Pass only finite values for keys valid in the chosen vertical.
    const out: Record<string, number> = {};
    for (const f of rows) {
      const v = Number(values[String(f.key)] ?? known.get(String(f.key))!.value);
      if (Number.isFinite(v)) out[String(f.key)] = v;
    }
    onConfirm(vertical, out);
  }

  return (
    <div className="tp-confirm">
      <div className="tp-confirm-h">Confirm before locking</div>
      <div className="tp-confirm-vrow">
        <span className="tp-confirm-vlbl">Type</span>
        <span className="tp-confirm-vchip">{VERTICAL_SHORT[vertical]}</span>
        <button type="button" className="tp-confirm-change" onClick={cycleVertical} disabled={busy}>
          change
        </button>
      </div>
      <div className="tp-confirm-note">
        Amber rows were <b>inferred</b> — check them. The ✓ rows you typed are ready.
        {vertical === "stocks" && " DCF cashflows are proxied from EPS until refined."}
      </div>
      {rows.length === 0 ? (
        <div className="tp-muted-note">
          No figures map to {VERTICAL_SHORT[vertical]} — it will start from defaults; tune them in the inspector after locking.
        </div>
      ) : (
        rows.map((f) => {
          const meta = known.get(String(f.key))!;
          const inferred = meta.source === "inferred";
          return (
            <div className={`tp-confirm-row${inferred ? " is-inferred" : ""}`} key={String(f.key)}>
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
              <span className={inferred ? "tp-confirm-flag" : "tp-confirm-ok"}>
                {inferred ? "inferred · check" : "✓ you typed"}
              </span>
            </div>
          );
        })
      )}
      <div className="tp-confirm-actions">
        <button type="button" className="tp-confirm-btn" onClick={confirm} disabled={busy}>
          {busy ? "Locking…" : "Confirm & lock figures"}
        </button>
        <button type="button" className="tp-ghost" onClick={onCancel} disabled={busy}>
          Dismiss
        </button>
      </div>
    </div>
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
