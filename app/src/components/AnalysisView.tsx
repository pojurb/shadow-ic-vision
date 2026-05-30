"use client";

import { useRef, useState } from "react";
import type { Analysis, AssetParameters, DecisionAction, ChatMessage, ContextSource } from "@/lib/domain/types";
import { calcDCF, calcBEP, formatIDR, formatNum } from "@/lib/finance";
import { computeMetrics } from "@/lib/finance/compute";
import { putBlob, deleteBlob } from "@/lib/repo";
import { runAnalysis, runResearch, needsResearch } from "@/lib/ai/analyze";
import { streamChat } from "@/lib/ai/chat";
import { StocksChart, StartupsChart, ConventionalChart } from "./charts";
import type { Vertical } from "@/data/presets";

type Lens = "operator" | "risk" | "predator";

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
  apiKey,
  model,
  onNeedSettings,
}: {
  analysis: Analysis;
  onChange: (next: Analysis) => void;
  apiKey: string;
  model: string;
  onNeedSettings: () => void;
}) {
  const [lens, setLens] = useState<Lens>("operator");
  const [action, setAction] = useState<DecisionAction>(analysis.decision?.action ?? "APPROVE");
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
      // Pass 1 (only when there are links / web research): free-form research with
      // web tools. Pass 2: structured debate, with the notes as qualitative context.
      let notes: string | undefined;
      if (needsResearch(analysis)) {
        setRunPhase("research");
        notes = await runResearch(apiKey, model, analysis);
      }
      setRunPhase("debate");
      const out = await runAnalysis(apiKey, model, analysis, notes);
      update({
        debate: { confidence: out.confidence, bull: out.bull, bear: out.bear },
        advisory: out.advisory,
        model,
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setRunPhase("");
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
      const full = await streamChat({
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
  const advisory = analysis.advisory?.[lens];

  return (
    <div className="analysis-view">
      {/* Title + meta */}
      <div className="analysis-head panel">
        <div className="analysis-title-row">
          <input
            className="analysis-title-input"
            value={analysis.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <span className={`status-pill status-${analysis.status}`}>{analysis.status.toUpperCase()}</span>
        </div>
        <div className="meta-grid">
          <input className="meta-input" placeholder="Ticker" value={analysis.assetMeta.ticker ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, ticker: e.target.value } })} />
          <input className="meta-input" placeholder="Sector" value={analysis.assetMeta.sector ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, sector: e.target.value } })} />
          <input className="meta-input" placeholder="Data as of (YYYY-MM-DD)" value={analysis.assetMeta.dataAsOf ?? ""} onChange={(e) => update({ assetMeta: { ...analysis.assetMeta, dataAsOf: e.target.value } })} />
        </div>
        <div className="tag-row">
          {analysis.tags.map((t) => (
            <span key={t} className="tag-chip" onClick={() => update({ tags: analysis.tags.filter((x) => x !== t) })}>
              #{t} ✕
            </span>
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

      {/* Sandbox + chart */}
      <div className="middle-row-grid">
        <section className="panel input-controls-panel">
          <div className="panel-header">
            <span className="panel-title">PARAMETER INPUT SANDBOX</span>
            <span className="panel-subtitle">{analysis.assetName}</span>
          </div>
          <div className="panel-body">
            <form className="parameter-form" onSubmit={(e) => e.preventDefault()}>
              {FIELDS[analysis.vertical].map((f) => {
                const val = Number(analysis.parameters[f.key] ?? f.min);
                return (
                  <div className="form-group" key={f.key}>
                    <div className="form-label-row">
                      <span className="field-label">{f.label}</span>
                      <span className="field-value">{fmtVal(val, f.type)}</span>
                    </div>
                    <input
                      type="range"
                      className="slider-input"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={val}
                      onChange={(e) => setParam(f.key, parseFloat(e.target.value))}
                    />
                  </div>
                );
              })}
            </form>
          </div>
        </section>

        <section className="panel chart-visualizer-panel">
          <div className="panel-header">
            <span className="panel-title">QUANTITATIVE VISUALIZER (RETRO CHART)</span>
            <span className="panel-subtitle">Deterministic Engine Output</span>
          </div>
          <div className="panel-body centered-content">
            <div className="chart-wrapper">{chartFor(analysis.vertical, analysis.parameters)}</div>
            <div className="chart-stats-grid">
              {metrics.map((m) => (
                <div className="stat-box" key={m.key}>
                  <div className="stat-lbl">{m.label}</div>
                  <div className={`stat-val${toneFor(m.verdict)}`}>{m.display}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Debate + advisory */}
      <div className="bottom-row-grid">
        <section className="panel debate-panel">
          <div className="panel-header">
            <span className="panel-title">
              MULTI-AGENT RED TEAM DEBATE{" "}
              <span
                className={`sim-badge${isLive ? " live" : ""}`}
                title={isLive ? `Live AI output (${analysis.model})` : "Seed content — run AI to replace with a grounded live debate"}
              >
                {isLive ? "LIVE" : "SEED"}
              </span>
            </span>
            <div className="debate-control-header">
              {analysis.debate && (
                <span className="confidence-indicator">
                  Confidence: <strong>{analysis.debate.confidence}%</strong>
                </span>
              )}
              <button className="run-ai-btn" onClick={runAI} disabled={running}>
                {running ? (runPhase === "research" ? "RESEARCHING…" : "DEBATING…") : "⚡ RUN AI"}
              </button>
            </div>
          </div>
          {aiError && <div className="ai-error">⚠ {aiError}</div>}
          <div className="panel-body split-debate-logs">
            <div className="debate-col bull-col">
              <div className="col-title bull-text">▲ BULL ADVOCATE</div>
              <div className="log-stream scrollable">
                {analysis.debate?.bull.map((l, i) => (
                  <DebateEntry key={i} type="bull" agent={l.agent} text={l.text} />
                ))}
              </div>
            </div>
            <div className="debate-col bear-col">
              <div className="col-title bear-text">▼ BEAR ADVERSARY</div>
              <div className="log-stream scrollable">
                {analysis.debate?.bear.map((l, i) => (
                  <DebateEntry key={i} type="bear" agent={l.agent} text={l.text} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel advisory-panel">
          <div className="panel-header warning-stripes">
            <span className="panel-title">THE ADVISORY BOARD LENSES</span>
            <span className="panel-subtitle">Three Scenario Lenses for Human Decision</span>
          </div>
          <div className="panel-body scrollable">
            <div className="lenses-tab-control">
              {(["operator", "risk", "predator"] as Lens[]).map((l) => (
                <button key={l} className={`lens-tab${l === lens ? " active" : ""}`} onClick={() => setLens(l)}>
                  {l === "operator" ? "OPERATOR" : l === "risk" ? "RISK MANAGER" : "PREDATOR"}
                </button>
              ))}
            </div>
            {advisory && (
              <div className="lens-content-viewer">
                <div className="lens-scenario-title">{advisory.title}</div>
                <div className="lens-scenario-text">{advisory.text}</div>
              </div>
            )}

            <div className="decision-logger">
              <div className="logger-title">⚡ COMMIT HUMAN DECISION LOG</div>
              {analysis.decision && (
                <div className={`current-decision ${analysis.decision.action}`}>
                  Current: <strong>{analysis.decision.action}</strong> — &quot;{analysis.decision.rationale}&quot;
                </div>
              )}
              <form className="decision-form" onSubmit={commitDecision}>
                <div className="form-row">
                  <label htmlFor="decision-select">EXECUTIVE ACTION:</label>
                  <select id="decision-select" value={action} onChange={(e) => setAction(e.target.value as DecisionAction)}>
                    <option value="APPROVE">APPROVE / SWING CAPITAL</option>
                    <option value="HOLD">HOLD / MONITOR STATE</option>
                    <option value="REJECT">REJECT OPPORTUNITY</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="decision-notes">RATIONALE / METRIC TARGETS:</label>
                  <textarea id="decision-notes" rows={2} placeholder="Write the investor's rationale..." value={notes} onChange={(e) => setNotes(e.target.value)} required />
                </div>
                <button type="submit" className="commit-btn">COMMIT DECISION</button>
              </form>
            </div>
          </div>
        </section>
      </div>

      <section className="panel context-panel">
        <div className="panel-header">
          <span className="panel-title">CONTEXT SOURCES</span>
          <label className="web-toggle">
            <input
              type="checkbox"
              checked={analysis.allowWebSearch}
              onChange={(e) => update({ allowWebSearch: e.target.checked })}
            />
            WEB RESEARCH
          </label>
        </div>
        <div className="panel-body">
          <div className="source-add-row">
            <button className="source-add-btn" onClick={() => fileInputRef.current?.click()}>
              + FILE (PDF / IMAGE)
            </button>
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
              className="meta-input source-link-input"
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
            <button className="source-add-btn" onClick={addLink}>+ LINK</button>
          </div>
          {analysis.sources.length === 0 ? (
            <div className="source-empty">
              No context attached. Add a PDF/image or a link to ground the AI in source material.
            </div>
          ) : (
            <div className="source-list">
              {analysis.sources.map((s) => (
                <div key={s.id} className="source-chip">
                  <span className="source-kind">
                    {s.kind === "file" ? (s.fileKind === "image" ? "🖼" : "📄") : "🔗"}
                  </span>
                  <span className="source-name">{s.kind === "file" ? s.name : s.url}</span>
                  <button className="source-remove" onClick={() => removeSource(s)} title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel chat-panel">
        <div className="panel-header">
          <span className="panel-title">DISCUSS WITH AI</span>
          <span className="panel-subtitle">Grounded follow-up chat</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="chat-stream scrollable">
            {analysis.chat.length === 0 && !pendingUser && (
              <div className="chat-empty">
                No messages yet. Run the analysis, then ask follow-ups grounded in the locked figures
                — e.g. &quot;stress test at 8% rates&quot;, &quot;why is the bear wrong?&quot;.
              </div>
            )}
            {analysis.chat.map((m) => (
              <div key={m.id} className={`chat-msg ${m.role}`}>
                <div className="chat-role">{m.role === "user" ? "You" : "Analyst"}</div>
                {m.content}
              </div>
            ))}
            {pendingUser && (
              <>
                <div className="chat-msg user">
                  <div className="chat-role">You</div>
                  {pendingUser}
                </div>
                <div className="chat-msg assistant">
                  <div className="chat-role">Analyst</div>
                  {streamingText || "…"}
                </div>
              </>
            )}
          </div>
          <form className="chat-input-row" onSubmit={sendChat}>
            <textarea
              className="chat-input"
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
            <button type="submit" className="commit-btn" disabled={chatBusy}>
              {chatBusy ? "…" : "SEND"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function DebateEntry({ type, agent, text }: { type: "bull" | "bear"; agent: string; text: string }) {
  return (
    <div className={`log-entry ${type}-entry`}>
      <div className="log-agent">
        {type === "bull" ? "▲" : "▼"} <span className={`${type}-text`}>{agent}</span>
      </div>
      <div className="log-text">{text}</div>
    </div>
  );
}
