"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, AssetParameters, DecisionAction, ChatMessage, ContextSource } from "@/lib/domain/types";
import { calcDCF, calcBEP, formatIDR, formatNum } from "@/lib/finance";
import { computeMetrics } from "@/lib/finance/compute";
import { putBlob, deleteBlob } from "@/lib/repo";
import { getProvider } from "@/lib/ai/registry";
import { personaFor } from "@/lib/ai/personas";
import type { ProviderId } from "@/lib/ai/types";
import { StocksChart, StartupsChart, ConventionalChart } from "./charts";
import type { Vertical } from "@/data/presets";

interface Field {
  key: keyof AssetParameters;
  label: string;
  min: number;
  max: number;
  step: number;
  type: "currency" | "percent" | "percent_raw" | "number";
}

const FIELDS: Record<Vertical, Field[]> = {
  stocks: [
    { key: "price", label: "Share Price (IDR)", min: 100, max: 20000, step: 100, type: "currency" },
    { key: "eps", label: "Earnings Per Share (EPS)", min: 10, max: 2000, step: 10, type: "currency" },
    { key: "roe", label: "Return on Equity (ROE %)", min: 1, max: 50, step: 0.5, type: "percent" },
    { key: "discountRate", label: "Discount Rate %", min: 0.05, max: 0.25, step: 0.01, type: "percent_raw" },
    { key: "terminalMult", label: "Terminal DCF Multiple", min: 5, max: 25, step: 1, type: "number" },
    { key: "invested", label: "Invested / Buy Price", min: 100, max: 20000, step: 100, type: "currency" },
  ],
  startups: [
    { key: "cash", label: "Cash Balance", min: 1e9, max: 5e10, step: 5e8, type: "currency" },
    { key: "burn", label: "Monthly Cash Burn", min: 1e8, max: 5e9, step: 5e7, type: "currency" },
    { key: "cac", label: "CAC (Acquisition Cost)", min: 50000, max: 5e6, step: 50000, type: "currency" },
    { key: "arpu", label: "Monthly ARPU", min: 10000, max: 2e6, step: 10000, type: "currency" },
    { key: "margin", label: "Gross Profit Margin %", min: 0.1, max: 0.95, step: 0.05, type: "percent_raw" },
    { key: "churn", label: "Monthly Churn Rate %", min: 0.01, max: 0.15, step: 0.005, type: "percent_raw" },
  ],
  conventional: [
    { key: "invested", label: "Initial CapEx Investment", min: 5e7, max: 2e9, step: 2.5e7, type: "currency" },
    { key: "fixed", label: "Annual Fixed Cost", min: 2e7, max: 1e9, step: 1e7, type: "currency" },
    { key: "price", label: "Avg Customer Billing / Unit", min: 5000, max: 500000, step: 2000, type: "currency" },
    { key: "variable", label: "Variable Cost / Unit (COGS)", min: 1000, max: 200000, step: 1000, type: "currency" },
  ],
};

const MIN_W = 340;
const MAX_W = 760;

function fmtVal(v: number, type: Field["type"]): string {
  if (type === "currency") return formatIDR(v);
  if (type === "percent") return `${v}%`;
  if (type === "percent_raw") return `${(v * 100).toFixed(1)}%`;
  return formatNum(v, 0);
}

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

  async function sendChat(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    if (!apiKey) return onNeedSettings();
    setChatInput("");
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
            {analysis.chat.length === 0 && !pendingUser && (
              <div className="tp-stream-empty">
                <div className="tp-stream-empty-h">Discuss with {analysis.persona?.label ?? "the analyst"}</div>
                Paste a deal or ask a question. Hit <b>⚡ RUN AI</b> to generate the grounded debate, then
                follow up here — e.g. &quot;stress-test the discount rate&quot;, &quot;why is the bear wrong?&quot;.
                Numbers stay locked to the deterministic engine.
              </div>
            )}
            {analysis.chat.map((m) => (
              <div key={m.id} className={`tp-msg tp-msg--${m.role}`}>
                <div className="tp-msg-role">{m.role === "user" ? "You" : "Analyst"}</div>
                <div className="tp-msg-body">{m.content}</div>
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
            <form className="tp-composer-input" onSubmit={sendChat}>
              <textarea
                className="tp-input"
                rows={2}
                placeholder="Ask a grounded follow-up…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat(e);
                  }
                }}
                disabled={chatBusy}
              />
              <button type="submit" className="tp-send" disabled={chatBusy}>{chatBusy ? "…" : "Send ↵"}</button>
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
              <div className="stance-banner">
                <span className="stance-label">{analysis.stance.label}</span>
                <span className="stance-basis">{analysis.stance.basis}</span>
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
                <form className="parameter-form" onSubmit={(e) => e.preventDefault()}>
                  {FIELDS[analysis.vertical].map((f) => {
                    const val = Number(analysis.parameters[f.key] ?? f.min);
                    return (
                      <div className="form-group" key={f.key}>
                        <div className="form-label-row">
                          <span className="field-label">{f.label}</span>
                          <span className="field-value">{fmtVal(val, f.type)}</span>
                        </div>
                        <input type="range" className="slider-input" min={f.min} max={f.max} step={f.step} value={val} onChange={(e) => setParam(f.key, parseFloat(e.target.value))} />
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
                    <span className={`thesis-chip thesis-${analysis.debate.thesisSupport.toLowerCase()}`}>THESIS {analysis.debate.thesisSupport}</span>
                  )}
                </div>
                {!analysis.debate ? (
                  <div className="tp-muted-note">Run AI to generate the grounded bull/bear debate.</div>
                ) : (
                  <div className="split-debate-logs">
                    <div className="debate-col bull-col">
                      <div className="col-title bull-text">▲ BULL</div>
                      <div className="log-stream">
                        {analysis.debate.bull.map((l, i) => (
                          <DebateEntry key={i} type="bull" agent={l.agent} text={l.text} slot={l.slot} />
                        ))}
                      </div>
                    </div>
                    <div className="debate-col bear-col">
                      <div className="col-title bear-text">▼ BEAR</div>
                      <div className="log-stream">
                        {analysis.debate.bear.map((l, i) => (
                          <DebateEntry key={i} type="bear" agent={l.agent} text={l.text} slot={l.slot} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* advisory lenses */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Advisory board <span className="tp-card-hint">{analysis.persona?.label ?? "lenses"}</span></div>
                <div className="lens-list">
                  {advisory.length === 0 ? (
                    <div className="lens-empty">Run AI to generate the advisory lenses.</div>
                  ) : (
                    advisory.map((l) => (
                      <div className="lens-row" key={l.id}>
                        <div className="lens-row-head">
                          <span className="lens-row-name">{l.name}</span>
                          <span className="lens-row-verdict">{l.verdict}</span>
                        </div>
                        <div className="lens-row-text">{l.text}</div>
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

function DebateEntry({ type, agent, text, slot }: { type: "bull" | "bear"; agent: string; text: string; slot?: string }) {
  return (
    <div className={`log-entry ${type}-entry`}>
      <div className="log-agent">
        {type === "bull" ? "▲" : "▼"} <span className={`${type}-text`}>{agent}</span>
        {slot && <span className="slot-tag">{slot}</span>}
      </div>
      <div className="log-text">{text}</div>
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
