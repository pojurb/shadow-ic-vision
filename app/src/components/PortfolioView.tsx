"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Analysis,
  PortfolioAnalysis,
  ChatMessage,
  DebateLine,
  Vertical,
} from "@/lib/domain/types";
import { computePortfolioMetrics } from "@/lib/finance/portfolio";
import { getProvider } from "@/lib/ai/registry";
import { portfolioPersona } from "@/lib/ai/personas";
import {
  lintPortfolioGrounding,
  lintChatReply,
  portfolioChatExtras,
  type GroundingResult,
} from "@/lib/ai/grounding";
import type { ProviderId } from "@/lib/ai/types";

const MIN_W = 360;
const MAX_W = 820;

const VERTICAL_TAG: Record<Vertical, string> = { stocks: "EQ", startups: "VC", conventional: "RE" };

function toneFor(verdict?: string): string {
  if (!verdict) return "";
  if (["BALANCED", "CONSTRUCTIVE"].includes(verdict)) return " bull-text";
  if (["CONCENTRATED", "DEFENSIVE"].includes(verdict)) return " warning-text";
  return "";
}

export default function PortfolioView({
  portfolio,
  analyses,
  onChange,
  provider,
  apiKey,
  model,
  onNeedSettings,
}: {
  portfolio: PortfolioAnalysis;
  analyses: Analysis[];
  onChange: (next: PortfolioAnalysis) => void;
  provider: ProviderId;
  apiKey: string;
  model: string;
  onNeedSettings: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [addPick, setAddPick] = useState("");

  // Two-pane: collapsible + VS-Code-style resizable inspector (docked right).
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorW, setInspectorW] = useState(520);
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

  const byId = useMemo(() => new Map(analyses.map((a) => [a.id, a] as const)), [analyses]);
  const metrics = useMemo(
    () => computePortfolioMetrics(portfolio.members, byId),
    [portfolio.members, byId],
  );
  const weightById = useMemo(
    () => new Map(metrics.positions.map((p) => [p.analysisId, p.weight] as const)),
    [metrics],
  );
  const available = useMemo(
    () => analyses.filter((a) => !portfolio.members.some((m) => m.analysisId === a.id)),
    [analyses, portfolio.members],
  );

  const update = (patch: Partial<PortfolioAnalysis>) => onChange({ ...portfolio, ...patch });

  function addMember(analysisId: string) {
    if (!analysisId || portfolio.members.some((m) => m.analysisId === analysisId)) return;
    update({ members: [...portfolio.members, { analysisId, capital: 0 }] });
    setAddPick("");
  }
  function removeMember(analysisId: string) {
    update({ members: portfolio.members.filter((m) => m.analysisId !== analysisId) });
  }
  function setCapital(analysisId: string, capital: number) {
    update({
      members: portfolio.members.map((m) =>
        m.analysisId === analysisId ? { ...m, capital } : m,
      ),
    });
  }

  async function runAnalyze() {
    if (!apiKey) return onNeedSettings();
    if (portfolio.members.length === 0) return;
    setRunning(true);
    setAiError(null);
    try {
      const out = await getProvider(provider).runPortfolioAnalysis({
        apiKey,
        model,
        portfolio,
        metrics,
        byId,
      });
      const persona = portfolioPersona();
      update({
        debate: out.debate,
        advisory: out.advisory,
        stance: out.stance,
        persona: { id: persona.id, label: persona.label },
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function onComposerSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy || running) return;
    if (!apiKey) return onNeedSettings();
    setChatInput("");
    sendFollowUp(text);
  }

  /** Grounded cross-asset follow-up chat over the composed portfolio. */
  async function sendFollowUp(text: string) {
    setPendingUser(text);
    setStreamingText("");
    setChatBusy(true);
    setAiError(null);
    try {
      const full = await getProvider(provider).streamPortfolioChat({
        apiKey,
        model,
        portfolio,
        metrics,
        byId,
        userText: text,
        onDelta: (d) => setStreamingText((p) => p + d),
      });
      const now = Date.now();
      const userMsg: ChatMessage = { id: `${now}-u`, role: "user", content: text, createdAt: now };
      const aiMsg: ChatMessage = {
        id: `${now}-a`,
        role: "assistant",
        content: full,
        kind: "answer",
        contextRefs: portfolio.members.map((m) => m.analysisId),
        createdAt: now + 1,
      };
      update({ chat: [...portfolio.chat, userMsg, aiMsg] });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingUser(null);
      setStreamingText("");
      setChatBusy(false);
    }
  }

  const verticalMetrics = metrics.metrics;
  const advisory = portfolio.advisory ?? [];
  const hasMembers = portfolio.members.length > 0;
  // Deterministic grounding guard (P8) over the portfolio debate + per-holding figures.
  const grounding = useMemo(() => lintPortfolioGrounding(portfolio, metrics, byId), [portfolio, metrics, byId]);
  const chatGround = useMemo(() => portfolioChatExtras(metrics, byId), [metrics, byId]);

  return (
    <div className="tp-root" ref={rootRef} style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}>
      {/* ---- top bar ---- */}
      <header className="tp-topbar">
        <div className="tp-title-wrap">
          <input className="tp-title" value={portfolio.title} onChange={(e) => update({ title: e.target.value })} />
          <span className="persona-badge" title="Cross-asset strategist for this portfolio">
            {portfolio.persona?.label ?? "Portfolio Strategist"}
          </span>
          <span className="tp-mode is-locked" title="Portfolio figures are deterministic (capital + weights)">
            ● PORTFOLIO
          </span>
        </div>
        <div className="tp-topbar-actions">
          <button className="tp-run-btn" onClick={runAnalyze} disabled={running || !hasMembers} title={hasMembers ? "Run the cross-asset strategist debate" : "Add a holding first"}>
            {running ? "DEBATING…" : "⚡ ANALYZE PORTFOLIO"}
          </button>
          <button className="tp-ghost" onClick={() => setInspectorOpen((v) => !v)}>
            {inspectorOpen ? "Hide inspector ›" : "‹ Show inspector"}
          </button>
        </div>
      </header>
      {aiError && <div className="tp-error">⚠ {aiError}</div>}

      <div className="tp-split">
        {/* ================= LEFT: cross-asset conversation ================= */}
        <main className="tp-convo">
          <div className="tp-stream scrollable">
            {portfolio.chat.length === 0 && !pendingUser && (
              <div className="tp-stream-empty">
                <div className="tp-stream-empty-h">Cross-asset chat</div>
                Compose the portfolio in the inspector — add holdings and set the capital for each. Then run the
                strategist debate, and ask grounded questions across the book — e.g. <b>&quot;which holding has the
                strongest margin of safety?&quot;</b>, <b>&quot;is the book too concentrated?&quot;</b>. Numbers stay
                locked to the deterministic portfolio engine and each holding&apos;s figures.
              </div>
            )}
            {portfolio.chat.map((m) => (
              <div key={m.id} className={`tp-msg tp-msg--${m.role}`}>
                <div className="tp-msg-role">{m.role === "user" ? "You" : "Strategist"}</div>
                <div className="tp-msg-body">{m.content}</div>
                {m.role === "assistant" && (
                  <ChatGroundFlag result={lintChatReply(m.content, chatGround.metrics, chatGround.extra)} />
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
                  <div className="tp-msg-role">Strategist</div>
                  <div className="tp-msg-body">{streamingText || "…"}</div>
                </div>
              </>
            )}
          </div>

          <div className="tp-composer">
            <form className="tp-composer-input" onSubmit={onComposerSubmit}>
              <textarea
                className="tp-input"
                rows={2}
                placeholder={hasMembers ? "Ask a grounded cross-asset question…" : "Add holdings in the inspector first…"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onComposerSubmit(e);
                  }
                }}
                disabled={chatBusy || running || !hasMembers}
              />
              <button type="submit" className="tp-send" disabled={chatBusy || running || !hasMembers}>
                {chatBusy ? "…" : "Send ↵"}
              </button>
            </form>
          </div>
        </main>

        {inspectorOpen && (
          <div className={`tp-gutter${dragging ? " is-dragging" : ""}`} onMouseDown={onGutterDown} role="separator" aria-orientation="vertical" />
        )}

        {/* ================= RIGHT: inspector dashboard ================= */}
        {inspectorOpen && (
          <aside className="tp-inspector scrollable" style={{ width: inspectorW, flex: `0 0 ${inspectorW}px` }}>
            <div className="tp-inspector-head">
              <span>PORTFOLIO</span>
              <span className="tp-inspector-sub">{portfolio.members.length} holdings</span>
            </div>

            {portfolio.stance && (
              <div className="tp-stance">
                <span className="tp-stance-label">{portfolio.stance.label}</span>
                <span className="tp-stance-basis">{portfolio.stance.basis}</span>
              </div>
            )}

            {/* verdict strip — deterministic portfolio metrics */}
            <div className="tp-verdict">
              {verticalMetrics.map((m) => (
                <div className="tp-vcell" key={m.key}>
                  <div className="tp-vlbl">{m.label}</div>
                  <div className={`tp-vval${toneFor(m.verdict)}`}>{m.display}</div>
                </div>
              ))}
            </div>

            <div className="tp-board">
              {/* composition — the editable core of P7b */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Composition <span className="tp-card-hint">capital drives weights</span></div>
                {!hasMembers ? (
                  <div className="tp-muted-note">No holdings yet. Add an existing analysis below to start composing.</div>
                ) : (
                  <div className="tp-pos-list">
                    {portfolio.members.map((m) => {
                      const a = byId.get(m.analysisId);
                      const weight = weightById.get(m.analysisId) ?? 0;
                      return (
                        <div className="tp-pos-row" key={m.analysisId}>
                          <span className={`library-vtag${a ? "" : " library-vtag--pf"}`}>
                            {a ? VERTICAL_TAG[a.vertical] : "?"}
                          </span>
                          <span className="tp-pos-name">
                            {a ? a.assetName || a.title : "(missing analysis)"}
                            {a?.stance && <span className="tp-pos-stance">{a.stance.label}</span>}
                          </span>
                          <span className="tp-pos-weight">{Math.round(weight * 100)}%</span>
                          <input
                            className="tp-pos-cap"
                            type="number"
                            min={0}
                            step={1_000_000}
                            placeholder="capital"
                            value={Number.isFinite(m.capital) ? m.capital : ""}
                            onChange={(e) => setCapital(m.analysisId, parseFloat(e.target.value))}
                          />
                          <button className="tp-pos-del" title="Remove holding" onClick={() => removeMember(m.analysisId)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="tp-add-holding">
                  <select value={addPick} onChange={(e) => addMember(e.target.value)} disabled={available.length === 0}>
                    <option value="">{available.length === 0 ? "No more analyses to add" : "+ Add holding…"}</option>
                    {available.map((a) => (
                      <option key={a.id} value={a.id}>
                        {VERTICAL_TAG[a.vertical]} · {a.assetName || a.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* allocation bars (grounded weights) */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Allocation <span className="tp-card-hint">by capital weight</span></div>
                {!hasMembers || metrics.totalCapital === 0 ? (
                  <div className="tp-muted-note">Set capital on the holdings to see weights.</div>
                ) : (
                  <div className="tp-alloc">
                    {metrics.positions.map((p) => (
                      <div className="tp-alloc-row" key={p.analysisId}>
                        <span className="tp-alloc-name">{p.name}</span>
                        <span className="tp-alloc-track">
                          <span className="tp-alloc-fill" style={{ width: `${Math.round(p.weight * 100)}%` }} />
                        </span>
                        <span className="tp-alloc-pct">{Math.round(p.weight * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* portfolio debate */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">
                  Strategist debate
                  {portfolio.debate && (
                    <span className="tp-badge tp-badge-support">THESIS {portfolio.debate.thesisSupport}</span>
                  )}
                  {portfolio.debate && <GroundChip result={grounding} />}
                </div>
                {!portfolio.debate ? (
                  <div className="tp-muted-note">Compose the portfolio, then ⚡ ANALYZE PORTFOLIO for a grounded bull/bear debate across the book.</div>
                ) : (
                  <div className="tp-debate">
                    <DebateSide side="bull" label="▲ BULL" lines={portfolio.debate.bull} />
                    <DebateSide side="bear" label="▼ BEAR" lines={portfolio.debate.bear} />
                  </div>
                )}
              </div>

              {/* advisory lenses */}
              <div className="tp-card tp-card--wide">
                <div className="tp-card-h">Advisory board <span className="tp-card-hint">{portfolio.persona?.label ?? "lenses"}</span></div>
                <div className="tp-lenses">
                  {advisory.length === 0 ? (
                    <div className="tp-muted-note">Run the portfolio analysis to generate the advisory lenses.</div>
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
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Grounding chip for a card header: ✓ when every figure traces to the engine. */
function GroundChip({ result }: { result: GroundingResult }) {
  if (result.clean) {
    return <span className="tp-ground" title="Every figure in the portfolio analysis traces to the deterministic engine">✓ Grounded</span>;
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
