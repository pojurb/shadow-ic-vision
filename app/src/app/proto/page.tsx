"use client";

/* ============================================================
   THROWAWAY PROTOTYPE — Option C two-pane redesign
   Route: /proto  ·  Safe to delete. Touches nothing in the app.
   Now covers all three verticals (Stocks / Startups / Conventional)
   so the two-pane + dashboard + per-vertical chart can be judged
   against the cases that actually differ. All data is hand-mocked.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_W = 300;
const MAX_W = 760;

type Vertical = "stocks" | "startups" | "conventional";

export default function ProtoPage() {
  const [vertical, setVertical] = useState<Vertical>("stocks");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorW, setInspectorW] = useState(440);
  const [dragging, setDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const onGutterDown = useCallback(() => setDragging(true), []);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const right = rootRef.current?.getBoundingClientRect().right ?? window.innerWidth;
      const w = Math.min(MAX_W, Math.max(MIN_W, right - e.clientX));
      setInspectorW(w);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const c = CASES[vertical];

  return (
    <div className="proto-root" ref={rootRef} style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}>
      <style>{CSS}</style>

      {/* ---- slim top bar ---- */}
      <header className="px-topbar">
        <div className="px-brand">
          <span className="px-dot" />
          JP FAMILY OFFICE
          <span className="px-sep">/</span>
          <span className="px-crumb">Library</span>
          <span className="px-sep">›</span>
          <span className="px-crumb-active">{c.crumb}</span>
        </div>

        {/* vertical switcher — prototype-only, to inspect each case */}
        <div className="px-vert-seg">
          {(Object.keys(CASES) as Vertical[]).map((v) => (
            <button key={v} className={`px-vert-btn ${v === vertical ? "is-active" : ""}`} onClick={() => setVertical(v)}>
              {CASES[v].name}
            </button>
          ))}
        </div>

        <div className="px-topbar-right">
          <span className="px-mode px-mode-locked">● FIGURES LOCKED</span>
          <button className="px-ghost-btn" onClick={() => setInspectorOpen((v) => !v)}>
            {inspectorOpen ? "Hide inspector ›" : "‹ Show inspector"}
          </button>
        </div>
      </header>

      <div className="px-split">
        {/* ===================== LEFT: CONVERSATION (front door) ===================== */}
        <main className="px-convo">
          <div className="px-stream" key={vertical}>
            <Msg role="you">
              {c.userPaste}
              <div className="px-attach">📄 {c.attach}</div>
            </Msg>

            <Msg role="ai">
              This reads as a <b>{c.verticalLabel}</b> analysis. I pulled the figures from your
              message and the attachment — here&apos;s what I&apos;ll lock before we debate. The
              amber rows I inferred, so check those:
              <ExtractCard rows={c.extractRows} />
              <div className="px-note">
                Vertical detected: <b>{c.name}</b> · <button className="px-link">change</button>
              </div>
            </Msg>

            <Msg role="you">{c.confirmLine}</Msg>

            <Msg role="ai">
              {c.lockSummary}
              <div className="px-followups">
                {c.followups.map((f) => (
                  <button className="px-chip" key={f}>
                    {f}
                  </button>
                ))}
              </div>
            </Msg>
          </div>

          {/* composer */}
          <div className="px-composer">
            <div className="px-composer-tools">
              <button className="px-tool">＋ Attach</button>
              <label className="px-tool px-tool-toggle">
                <input type="checkbox" defaultChecked /> Web research
              </label>
            </div>
            <div className="px-composer-input">
              <textarea rows={2} placeholder="Ask a grounded follow-up, or paste another deal…" defaultValue="" />
              <button className="px-send">Send ↵</button>
            </div>
          </div>
        </main>

        {/* draggable gutter — VS Code style */}
        {inspectorOpen && (
          <div className={`px-gutter ${dragging ? "is-dragging" : ""}`} onMouseDown={onGutterDown} role="separator" aria-orientation="vertical" />
        )}

        {/* ===================== RIGHT: INSPECTOR (dashboard, resizable) ===================== */}
        {inspectorOpen && (
          <aside className="px-inspector" style={{ width: inspectorW, flex: `0 0 ${inspectorW}px` }}>
            <div className="px-inspector-head">
              <span>INSPECTOR</span>
              <span className="px-inspector-sub">{c.sub}</span>
            </div>

            {/* STANCE — the AI's one allowed verdict: an engine-derived valuation
                label (from P/E verdict + sign of MoS), not a buy/sell action */}
            {c.stance && (
              <div className="px-stance">
                <span className={`px-stance-label ${c.stance.tone}`}>{c.stance.label}</span>
                <span className="px-stance-basis">{c.stance.basis}</span>
              </div>
            )}

            {/* VERDICT STRIP — the punchline, always visible */}
            <div className="px-verdict">
              {c.stats.map((s) => (
                <div className="px-v-cell" key={s.label}>
                  <div className="px-v-lbl">{s.label}</div>
                  <div className={`px-v-val ${s.tone}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* TILED BOARD — everything open; widen to flow into columns */}
            <div className="px-board">
              {/* DEBATE */}
              <div className="px-card px-card--wide">
                <div className="px-card-h">
                  Red-team debate <span className="px-badge px-badge-live">LIVE</span>
                  {c.thesisSupport && <span className="px-badge px-badge-support">THESIS {c.thesisSupport}</span>}
                </div>
                <div className="px-debate">
                  <DebateSide side="bull" label="▲ Bull" points={c.debate.bull} />
                  <DebateSide side="bear" label="▼ Bear" points={c.debate.bear} />
                </div>
              </div>

              {/* ADVISORY */}
              <div className="px-card px-card--wide">
                <div className="px-card-h">Advisory board · three lenses</div>
                <div className="px-lenses">
                  {c.lenses.map((l) => (
                    <LensRow key={l.name} lens={l} />
                  ))}
                </div>
              </div>

              {/* FIGURES */}
              <div className="px-card">
                <div className="px-card-h">
                  Locked figures <span className="px-card-hint">editable</span>
                </div>
                <div className="px-figs">
                  {c.figs.map((f) => (
                    <div className="px-fig" key={f.label}>
                      <div className="px-fig-row">
                        <span className="px-fig-label">{f.label}</span>
                        <span className="px-fig-val">{f.val}</span>
                      </div>
                      <input type="range" className="px-slider" defaultValue={f.pct} />
                    </div>
                  ))}
                </div>
              </div>

              {/* PER-VERTICAL CHART(S) */}
              {vertical === "stocks" && (
                <>
                  <div className="px-card">
                    <div className="px-card-h">
                      Margin of safety <span className="px-card-hint">intrinsic vs cost basis</span>
                    </div>
                    <MosGapChart />
                  </div>
                  <div className="px-card">
                    <div className="px-card-h">
                      DCF value bridge <span className="px-card-hint">how much is terminal value</span>
                    </div>
                    <DcfBridgeChart />
                  </div>
                </>
              )}
              {vertical === "startups" && (
                <div className="px-card">
                  <div className="px-card-h">
                    Cash runway <span className="px-card-hint">months to zero</span>
                  </div>
                  <RunwayChart />
                </div>
              )}
              {vertical === "conventional" && (
                <div className="px-card">
                  <div className="px-card-h">
                    Break-even <span className="px-card-hint">units / month</span>
                  </div>
                  <BreakEvenChart />
                </div>
              )}

              {/* DECISION */}
              <div className="px-card px-card--wide">
                <div className="px-card-h">Make the call</div>
                <div className="px-decision">
                  <select className="px-input" defaultValue="APPROVE">
                    <option>APPROVE / SWING CAPITAL</option>
                    <option>HOLD / MONITOR</option>
                    <option>REJECT</option>
                  </select>
                  <textarea className="px-input" rows={2} placeholder="Investor rationale…" />
                  <button className="px-primary-btn">Commit decision</button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ---------- small components ---------- */

function Msg({ role, children }: { role: "you" | "ai"; children: React.ReactNode }) {
  return (
    <div className={`px-msg px-msg--${role}`}>
      <div className="px-msg-role">{role === "you" ? "You" : "Analyst"}</div>
      <div className="px-msg-body">{children}</div>
    </div>
  );
}

type ExtractRow = { k: string; v: string; unit: string; src: "you" | "pdf" };

function ExtractCard({ rows }: { rows: ExtractRow[] }) {
  const [locked, setLocked] = useState(false);
  if (locked) {
    return (
      <div className="px-extract px-extract--locked">
        <div className="px-extract-h px-extract-h--locked">🔒 Figures locked via the deterministic engine</div>
        <button className="px-link" onClick={() => setLocked(false)}>
          review again
        </button>
      </div>
    );
  }
  return (
    <div className="px-extract">
      <div className="px-extract-h">Confirm before locking</div>
      <div className="px-extract-note">
        The amber rows were <b>inferred from the attachment</b> — check them. The rest you typed, so they&apos;re ready.
      </div>
      {rows.map((r) => {
        const inferred = r.src === "pdf";
        return (
          <div className={`px-extract-row ${inferred ? "is-inferred" : ""}`} key={r.k}>
            <span className="px-extract-k">{r.k}</span>
            {inferred ? (
              <span className="px-extract-edit">
                <input defaultValue={r.v} className="px-extract-input" />
                <span className="px-extract-unit">{r.unit}</span>
              </span>
            ) : (
              <span className="px-extract-v">
                {r.v} <span className="px-extract-unit">{r.unit}</span>
              </span>
            )}
            {inferred ? <span className="px-extract-flag">inferred · check</span> : <span className="px-extract-ok">✓ you typed</span>}
          </div>
        );
      })}
      <div className="px-extract-actions">
        <button className="px-primary-btn px-extract-confirm" onClick={() => setLocked(true)}>
          Confirm &amp; lock figures
        </button>
        <button className="px-ghost-btn">Edit in inspector</button>
      </div>
    </div>
  );
}

type Point = { hook: string; text: string; slot?: string };

function DebateSide({ side, label, points }: { side: "bull" | "bear"; label: string; points: Point[] }) {
  const [expanded, setExpanded] = useState(false);
  // Rubric mode (stocks): every point carries a slot — show all four, no expander,
  // so the reader sees valuation/quality/catalyst/risk coverage at a glance.
  const rubric = points.some((p) => p.slot);
  const shown = rubric || expanded ? points : points.slice(0, 1);
  const rest = points.length - 1;
  return (
    <div className="px-debate-col">
      <div className={`px-debate-h ${side === "bull" ? "px-bull" : "px-bear"}`}>{label}</div>
      <ul className="px-points">
        {shown.map((p, i) => (
          <li key={i}>
            {p.slot && <span className="px-slot">{p.slot}</span>}
            <b>{p.hook}</b> — {p.text}
          </li>
        ))}
      </ul>
      {!rubric && rest > 0 && (
        <button className="px-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : `+${rest} more`}
        </button>
      )}
    </div>
  );
}

type Lens = { name: string; verdict: string; tone: string; hook: string; points: string[] };

function LensRow({ lens }: { lens: Lens }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-lens-row">
      <div className="px-lens-top">
        <span className="px-lens-name">{lens.name}</span>
        <span className={`px-lens-verdict ${lens.tone}`}>{lens.verdict}</span>
      </div>
      <div className="px-lens-hook">
        <b>{lens.hook}.</b>{" "}
        <button className="px-more px-more-inline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "less" : "why"}
        </button>
      </div>
      {expanded && (
        <ul className="px-points px-points-tight">
          {lens.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- charts (illustrative; real ones read from computeMetrics) ---------- */

// STOCKS — the two honest, groundable charts (P0).
// MoS gap: both markers are TOTALS the engine actually produces — cost basis
// (invested) vs intrinsic value (totalNPV). No per-share "fair value" is claimed.
function MosGapChart() {
  const cost = 4200; // invested / cost basis
  const npv = 4940; // intrinsic value (totalNPV)
  const lo = 3800;
  const hi = 5400;
  const xm = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="px-pvf">
      <div className="px-mos2-track">
        <div className="px-mos2-gap" style={{ left: `${xm(cost)}%`, width: `${xm(npv) - xm(cost)}%` }} />
        <div className="px-mos2-tick px-mos2-cost" style={{ left: `${xm(cost)}%` }}>
          <span>cost 4,200</span>
        </div>
        <div className="px-mos2-tick px-mos2-npv" style={{ left: `${xm(npv)}%` }}>
          <span>NPV 4,940</span>
        </div>
      </div>
      <div className="px-mos-axis">
        <span>3,800</span>
        <span>5,400</span>
      </div>
      <div className="px-pvf-legend">
        <span className="px-leg-fair">● intrinsic value (NPV)</span>
        <span className="px-leg-gap">margin of safety +15%</span>
      </div>
    </div>
  );
}

// DCF value bridge: PV of explicit cashflows + terminal value = totalNPV.
// Uses pvSum / terminalValue / totalNPV the engine already computes and discards.
function DcfBridgeChart() {
  const pvSum = 2140;
  const terminal = 2800;
  const total = pvSum + terminal;
  const tPct = Math.round((terminal / total) * 100);
  return (
    <div className="px-bridge">
      <div className="px-bridge-bar">
        <div className="px-bridge-seg px-bridge-pv" style={{ width: `${(pvSum / total) * 100}%` }}>
          PV cashflows
        </div>
        <div className="px-bridge-seg px-bridge-term" style={{ width: `${(terminal / total) * 100}%` }}>
          terminal
        </div>
      </div>
      <div className="px-bridge-legend">
        <span>
          <b>2,140</b> PV of cashflows
        </span>
        <span>
          <b>2,800</b> terminal value
        </span>
        <span className="px-bridge-total">= 4,940 NPV</span>
      </div>
      <div className="px-bridge-flag">⚠ {tPct}% of intrinsic value is terminal value — leans on the exit multiple.</div>
    </div>
  );
}

// STARTUPS — cash declining to zero; raise-window before cash-out
function RunwayChart() {
  const H = 18; // horizon, months
  const toZero = 13.85; // 18B / 1.3B
  const raise = 9;
  const zx = (toZero / H) * 240;
  const rx = (raise / H) * 240;
  const base = 88; // y of "zero cash"
  return (
    <div className="px-pvf">
      <svg viewBox="0 0 240 96" className="px-vsvg" preserveAspectRatio="none">
        <polygon points={`0,14 ${zx},${base} ${zx},96 0,96`} className="px-chart-fill" />
        <polyline points={`0,14 ${zx},${base}`} className="px-chart-line" />
        <line x1={0} y1={base} x2={240} y2={base} className="px-ref px-ref-zero" />
        <line x1={rx} y1={0} x2={rx} y2={96} className="px-ref px-ref-raise" />
      </svg>
      <div className="px-pvf-legend">
        <span className="px-leg-fair">● 14 mo to zero</span>
        <span className="px-leg-raise">● raise window · mo 9</span>
        <span className="px-leg-gap">−1.30B / mo</span>
      </div>
    </div>
  );
}

// CONVENTIONAL — revenue vs total cost crossing at break-even
function BreakEvenChart() {
  const bepX = 163; // crossing
  return (
    <div className="px-pvf">
      <svg viewBox="0 0 240 96" className="px-vsvg" preserveAspectRatio="none">
        <rect x={bepX} y={0} width={240 - bepX} height={96} className="px-be-profit" />
        <rect x={0} y={0} width={bepX} height={96} className="px-be-loss" />
        <polyline points="0,90 240,12" className="px-be-rev" />
        <polyline points="0,52 240,30" className="px-be-cost" />
        <line x1={bepX} y1={0} x2={bepX} y2={96} className="px-ref px-ref-bep" />
      </svg>
      <div className="px-pvf-legend">
        <span className="px-leg-rev">● revenue</span>
        <span className="px-leg-cost">● total cost</span>
        <span className="px-leg-gap">BEP · 1,850/mo</span>
      </div>
    </div>
  );
}

/* ---------- per-vertical mock cases ---------- */

const CASES: Record<Vertical, {
  name: string;
  crumb: string;
  sub: string;
  verticalLabel: string;
  attach: string;
  userPaste: React.ReactNode;
  confirmLine: string;
  lockSummary: React.ReactNode;
  followups: string[];
  extractRows: ExtractRow[];
  stance?: { label: string; tone: string; basis: string };
  thesisSupport?: string;
  stats: { label: string; val: string; tone: string }[];
  figs: { label: string; val: string; pct: number }[];
  debate: { bull: Point[]; bear: Point[] };
  lenses: Lens[];
}> = {
  /* ===================== STOCKS ===================== */
  stocks: {
    name: "Stocks",
    crumb: "BBRI · Bank Rakyat",
    sub: "BBRI · everything at a glance",
    verticalLabel: "listed-equity",
    attach: "BBRI_factsheet_Q1.pdf",
    userPaste: (
      <>Looking at BBRI at 4,200. EPS around 380, ROE has been strong ~19%. Worth a position? Pasting the latest factsheet too.</>
    ),
    confirmLine: "Looks right. Lock it and run the debate.",
    lockSummary: (
      <>
        Locked via the deterministic engine. Against your <b>4,200</b> cost basis, intrinsic value (DCF) is{" "}
        <b className="px-bull">4,940</b> — a <b className="px-bull">margin of safety of ~15%</b>, and P/E at 11.1× screens as a{" "}
        <b className="px-bull">DISCOUNT</b>. Note ~57% of that value sits in the terminal multiple, so the call leans on the exit
        assumption. Engine stance: <b className="px-bull">UNDERVALUED</b>. Debate and the four lenses are in the inspector.
      </>
    ),
    followups: ["Stress-test the discount rate", "How much value is terminal?", "Compare to BBCA"],
    extractRows: [
      { k: "Share price", v: "4,200", unit: "IDR", src: "you" },
      { k: "EPS", v: "380", unit: "IDR", src: "you" },
      { k: "ROE", v: "19", unit: "%", src: "you" },
      { k: "Cost basis / buy price", v: "4,200", unit: "IDR", src: "you" },
      { k: "Discount rate", v: "11", unit: "%", src: "pdf" },
    ],
    // Engine-derived stance: P/E verdict DISCOUNT + positive margin of safety → UNDERVALUED.
    stance: { label: "UNDERVALUED", tone: "px-bull", basis: "engine-derived · P/E DISCOUNT + positive margin of safety" },
    thesisSupport: "MIXED",
    stats: [
      { label: "P/E · DISCOUNT", val: "11.1×", tone: "px-bull" },
      { label: "Margin of Safety", val: "+15%", tone: "px-bull" },
      { label: "Intrinsic Val. (NPV)", val: "4,940", tone: "" },
      { label: "Earnings Yield", val: "9.0%", tone: "" },
    ],
    figs: [
      { label: "Share Price (IDR)", val: "4,200", pct: 21 },
      { label: "EPS (IDR)", val: "380", pct: 19 },
      { label: "ROE %", val: "19%", pct: 38 },
      { label: "Discount Rate %", val: "11%", pct: 30 },
      { label: "Terminal Multiple", val: "12×", pct: 48 },
    ],
    // Fixed 4-slot rubric: each side must cover valuation / quality / catalyst / risk;
    // valuation + quality + risk cite a locked figure verbatim.
    debate: {
      bull: [
        { slot: "Valuation", hook: "P/E 11.1× = DISCOUNT", text: "below the 13× cheap threshold and the 5-yr mean; a ~6% yield pays you to wait." },
        { slot: "Quality", hook: "ROE ~19%", text: "a low-cost deposit franchise compounds book value faster than peers." },
        { slot: "Catalyst", hook: "Rate-cut re-rate", text: "a shallow cut cycle lets NIM hold while the multiple normalizes toward the mean." },
        { slot: "Risk", hook: "Margin of safety +15%", text: "intrinsic value sits above your cost basis even before any re-rate." },
      ],
      bear: [
        { slot: "Valuation", hook: "Cheap for a reason", text: "the discount may be pricing a real earnings cut, not a mispricing." },
        { slot: "Quality", hook: "ROE mean-reverts", text: "19% isn't permanent; competition and rate cuts pull it toward the cost of equity." },
        { slot: "Catalyst", hook: "No visible trigger", text: "without a catalyst a cheap stock stays cheap — the classic value trap." },
        { slot: "Risk", hook: "57% terminal value", text: "most of the DCF rests on the exit multiple; a small haircut erases the margin of safety." },
      ],
    },
    // Equity lenses (not the operator/PE frame). Verdicts are stance/quality words, not actions.
    lenses: [
      { name: "Valuation", verdict: "CHEAP", tone: "px-bull", hook: "Trades at a discount to intrinsic value", points: ["P/E 11.1× screens DISCOUNT; margin of safety +15% vs cost basis.", "Earnings yield 9.0% beats the discount rate — value accretes by holding."] },
      { name: "Quality", verdict: "DURABLE", tone: "px-bull", hook: "ROE ~19% funds the compounding", points: ["Deposit franchise + scale keep returns above the cost of equity.", "PEG reasonable given the ROE — growth isn't being overpaid for."] },
      { name: "Catalyst", verdict: "CATALYST-LIGHT", tone: "px-amber", hook: "The re-rate needs a trigger that isn't visible yet", points: ["Cheapness alone doesn't close the gap — watch for the rate-cycle turn.", "Until then, the dividend is the carry while you wait."] },
      { name: "Risk Manager", verdict: "FRAGILE TO RATES", tone: "px-bear", hook: "Most of the value is rate-sensitive terminal value", points: ["57% of NPV is terminal — stress the discount rate before sizing.", "Set a review trigger if ROE prints below 16% or the MoS turns negative."] },
    ],
  },

  /* ===================== STARTUPS ===================== */
  startups: {
    name: "Startups",
    crumb: "Acme · Seed extension",
    sub: "Acme SaaS · everything at a glance",
    verticalLabel: "early-stage startup",
    attach: "Acme_board_deck.pdf",
    userPaste: (
      <>Evaluating a seed extension for Acme (B2B SaaS). ~18B in the bank, burning about 1.3B a month. Deck attached — pull what you need.</>
    ),
    confirmLine: "Yep, lock it and run the read.",
    lockSummary: (
      <>
        Locked. At 1.3B/mo you have <b>~14 months</b> of cash, but the raise window closes around <b className="px-amber">month 9</b> — that&apos;s
        the real clock. Unit economics hold (<b className="px-bull">LTV:CAC 3.2×</b>); the burn multiple at 1.8× is the soft spot. Lenses on the
        right. Confidence <b>61%</b>.
      </>
    ),
    followups: ["What burn hits default-alive?", "Model a 20% burn cut", "Compare to last round"],
    extractRows: [
      { k: "Cash balance", v: "18.0", unit: "B", src: "you" },
      { k: "Monthly burn", v: "1.30", unit: "B", src: "pdf" },
      { k: "CAC", v: "450", unit: "k", src: "pdf" },
      { k: "ARPU", v: "95", unit: "k/mo", src: "you" },
      { k: "Churn", v: "4.0", unit: "%/mo", src: "pdf" },
    ],
    stats: [
      { label: "Runway", val: "14 mo", tone: "" },
      { label: "Burn mult.", val: "1.8×", tone: "px-amber" },
      { label: "LTV : CAC", val: "3.2×", tone: "px-bull" },
      { label: "Confidence", val: "61%", tone: "px-acc" },
    ],
    figs: [
      { label: "Cash Balance", val: "18.0B", pct: 36 },
      { label: "Monthly Burn", val: "1.30B", pct: 26 },
      { label: "CAC", val: "450k", pct: 22 },
      { label: "ARPU /mo", val: "95k", pct: 30 },
      { label: "Gross Margin %", val: "78%", pct: 78 },
      { label: "Churn %/mo", val: "4.0%", pct: 27 },
    ],
    debate: {
      bull: [
        { hook: "Net revenue retention >115%", text: "expansion offsets churn; the installed base compounds without new logos." },
        { hook: "14 months of runway", text: "enough to hit the metrics that de-risk a priced Series A." },
        { hook: "LTV:CAC at 3.2×", text: "the unit economics already work — growth is a funding question, not a model question." },
        { hook: "Founder-led sales engine", text: "a repeatable motion with a short ramp on new reps." },
      ],
      bear: [
        { hook: "Burn multiple 1.8×", text: "nearly two rupiah burned per rupiah of net-new ARR — inefficient growth." },
        { hook: "Churn at 4%/mo", text: "~38% annual logo churn quietly caps the ceiling." },
        { hook: "Single-channel acquisition", text: "CAC rises the moment the one working channel saturates." },
        { hook: "Raise needed by month 9", text: "real runway to a round is shorter than the cash-out date." },
      ],
    },
    lenses: [
      { name: "Operator", verdict: "EXTEND RUNWAY", tone: "px-bull", hook: "Get to default-alive", points: ["A 20% burn cut pushes the raise window past month 12.", "Concentrate spend on the one channel that's actually converting."] },
      { name: "Risk", verdict: "CUT BURN", tone: "px-amber", hook: "The raise window is the risk, not the runway", points: ["Plan the round to open by month 6, not 9 — markets gap.", "Model the down-round case; a 1.8× burn multiple won't impress a lead."] },
      { name: "Predator", verdict: "NEGOTIATE", tone: "px-acc", hook: "Time the raise from strength", points: ["Two more quarters of NRR data resets the valuation anchor.", "An insider-led extension buys leverage for the priced round."] },
    ],
  },

  /* ===================== CONVENTIONAL ===================== */
  conventional: {
    name: "Conventional",
    crumb: "Kopi Senja · Outlet 3",
    sub: "Kopi Senja · everything at a glance",
    verticalLabel: "conventional / cash-flow business",
    attach: "KopiSenja_outlet3_PnL.pdf",
    userPaste: (
      <>Third Kopi Senja outlet. ~850M fit-out, fixed run-rate around 420M/year, sells at ~28k a cup, COGS ~11k. Worth opening? P&amp;L attached.</>
    ),
    confirmLine: "Correct. Lock and run it.",
    lockSummary: (
      <>
        Locked. Break-even sits near <b>1,850 cups/month</b> against a location already running above that, with a <b>~26-month payback</b> and a{" "}
        <b className="px-bull">positive NPV at 12%</b>. The 850M CapEx is the irreversible piece. Lenses on the right. Confidence <b>68%</b>.
      </>
    ),
    followups: ["Break-even if footfall −20%?", "Phase the CapEx?", "Cannibalization vs outlet 2"],
    extractRows: [
      { k: "Initial CapEx", v: "850", unit: "M", src: "you" },
      { k: "Annual fixed cost", v: "420", unit: "M", src: "pdf" },
      { k: "Price / unit", v: "28", unit: "k", src: "you" },
      { k: "Variable / unit", v: "11", unit: "k", src: "pdf" },
    ],
    stats: [
      { label: "Break-even", val: "1,850", tone: "" },
      { label: "Payback", val: "26 mo", tone: "px-amber" },
      { label: "NPV @12%", val: "+1.4B", tone: "px-bull" },
      { label: "Confidence", val: "68%", tone: "px-acc" },
    ],
    figs: [
      { label: "Initial CapEx", val: "850M", pct: 42 },
      { label: "Annual Fixed Cost", val: "420M", pct: 40 },
      { label: "Price / Unit", val: "28k", pct: 55 },
      { label: "Variable / Unit", val: "11k", pct: 22 },
    ],
    debate: {
      bull: [
        { hook: "Contribution margin 61%", text: "every cup past break-even drops mostly to profit." },
        { hook: "Break-even below run-rate", text: "1,850/mo sits under the location's existing footfall from day one." },
        { hook: "26-month payback", text: "reasonable for a hard-asset outlet that retains resale value." },
        { hook: "Proven format", text: "third outlet, not a first bet — the playbook is known." },
      ],
      bear: [
        { hook: "850M CapEx upfront", text: "concentrated, illiquid, hard to reverse if footfall disappoints." },
        { hook: "Fixed cost 420M/yr", text: "operating leverage cuts both ways in a slow quarter." },
        { hook: "Cannibalization risk", text: "a third outlet may pull customers from the existing two." },
        { hook: "Lease & wage inflation", text: "fixed costs creep faster than you can push price." },
      ],
    },
    lenses: [
      { name: "Operator", verdict: "APPROVE", tone: "px-bull", hook: "Greenlight with a ramp plan", points: ["Margin structure is healthy; the model works above 1,850 cups.", "Pre-open marketing to clear break-even inside the first quarter."] },
      { name: "Risk", verdict: "STAGE CAPEX", tone: "px-amber", hook: "Phase the fit-out spend", points: ["Release the second tranche only after week-4 footfall confirms demand.", "Stress break-even at −20% footfall before committing the full 850M."] },
      { name: "Predator", verdict: "RENEGOTIATE", tone: "px-acc", hook: "The landlord needs the anchor more than you", points: ["A rent-free fit-out period shortens payback by months.", "Push a turnover-linked lease to cap the fixed-cost downside."] },
    ],
  },
};

/* ---------- scoped softened styles ---------- */

const CSS = `
.proto-root{
  position:fixed; inset:0; z-index:9999;
  display:flex; flex-direction:column;
  background:#16181d;
  color:#e6e9ef;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size:15px; line-height:1.55;
  --acc:#22d3ee; --amber:#f0a829; --bull:#34d399; --bear:#f87171;
  --line:#2a2e37; --panel:#1c1f26; --panel2:#21252e; --muted:#9aa3b2;
  --mono:"JetBrains Mono", ui-monospace, monospace;
}
.proto-root *{box-sizing:border-box;}
.px-bull{color:var(--bull);} .px-bear{color:var(--bear);} .px-amber{color:var(--amber);} .px-acc{color:var(--acc);}

/* top bar */
.px-topbar{display:flex; justify-content:space-between; align-items:center;
  padding:12px 18px; background:#1a1d23; border-bottom:1px solid var(--line); gap:16px;}
.px-brand{display:flex; align-items:center; gap:8px; font-weight:600; letter-spacing:.3px; font-size:13px; min-width:0;}
.px-dot{width:8px;height:8px;border-radius:50%;background:var(--bull);box-shadow:0 0 8px var(--bull);flex:0 0 auto;}
.px-sep{color:#4b515e;}
.px-crumb{color:var(--muted);font-weight:500;}
.px-crumb-active{color:#fff;font-weight:600;white-space:nowrap;}
.px-vert-seg{display:flex;gap:2px;background:#13161b;border:1px solid var(--line);border-radius:8px;padding:2px;flex:0 0 auto;}
.px-vert-btn{background:transparent;border:none;color:var(--muted);padding:5px 14px;border-radius:6px;
  cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;}
.px-vert-btn.is-active{background:var(--panel2);color:#fff;box-shadow:inset 0 -2px 0 var(--acc);}
.px-topbar-right{display:flex;align-items:center;gap:14px;flex:0 0 auto;}
.px-mode{font-size:12px;font-weight:600;letter-spacing:.4px;padding:3px 10px;border-radius:999px;}
.px-mode-locked{color:var(--acc);background:rgba(34,211,238,.12);}
.px-ghost-btn{background:transparent;border:1px solid var(--line);color:var(--muted);
  padding:5px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;}
.px-ghost-btn:hover{color:#fff;border-color:#3c424d;}

/* split */
.px-split{flex:1;display:flex;min-height:0;}
.px-gutter{flex:0 0 6px;cursor:col-resize;background:var(--line);position:relative;}
.px-gutter::after{content:"";position:absolute;inset:0 -3px;}
.px-gutter:hover,.px-gutter.is-dragging{background:var(--acc);}

/* conversation */
.px-convo{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:#16181d;}
.px-stream{flex:1;overflow-y:auto;padding:28px 0;}
.px-msg{max-width:760px;margin:0 auto 22px;padding:0 28px;}
.px-msg-role{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.px-msg--ai .px-msg-role{color:var(--acc);}
.px-msg-body{font-size:15.5px;line-height:1.6;}
.px-msg--you .px-msg-body{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;}
.px-msg b{color:#fff;font-weight:600;}
.px-attach{margin-top:10px;font-size:13px;color:var(--muted);font-family:var(--mono);
  background:#14161b;border:1px solid var(--line);border-radius:6px;padding:6px 10px;display:inline-block;}
.px-note{margin-top:12px;font-size:13px;color:var(--muted);}
.px-link{background:none;border:none;color:var(--acc);cursor:pointer;font-size:13px;text-decoration:underline;padding:0;font-family:inherit;}
.px-followups{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
.px-chip{background:var(--panel2);border:1px solid var(--line);color:#cdd3dd;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px;font-family:inherit;}
.px-chip:hover{border-color:var(--acc);color:#fff;}

/* extraction confirm card */
.px-extract{margin-top:14px;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:10px;padding:14px 16px;}
.px-extract--locked{border-left-color:var(--bull);display:flex;justify-content:space-between;align-items:center;gap:12px;}
.px-extract-h{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--amber);margin-bottom:6px;}
.px-extract-h--locked{color:var(--bull);margin-bottom:0;}
.px-extract-note{font-size:13px;color:var(--muted);margin-bottom:10px;line-height:1.5;}
.px-extract-note b{color:var(--amber);font-weight:600;}
.px-extract-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #23262e;}
.px-extract-row.is-inferred{background:rgba(240,168,41,.05);margin:0 -8px;padding:8px;border-radius:6px;border-bottom:1px solid transparent;}
.px-extract-row:last-child{border-bottom:none;}
.px-extract-k{color:#cdd3dd;font-size:14px;}
.px-extract-v{font-family:var(--mono);color:#fff;font-weight:600;font-size:14px;}
.px-extract-edit{display:flex;align-items:center;gap:5px;}
.px-extract-input{width:82px;background:#14161b;border:1px solid var(--amber);border-radius:5px;color:#fff;font-family:var(--mono);font-weight:600;font-size:14px;padding:4px 7px;text-align:right;}
.px-extract-input:focus{outline:none;box-shadow:0 0 0 2px rgba(240,168,41,.25);}
.px-extract-unit{font-family:var(--mono);font-size:12px;color:var(--muted);}
.px-extract-flag{font-size:11px;color:var(--amber);background:rgba(240,168,41,.12);padding:2px 8px;border-radius:999px;white-space:nowrap;}
.px-extract-ok{font-size:11px;color:var(--bull);white-space:nowrap;}
.px-extract-actions{display:flex;gap:8px;align-items:center;margin-top:14px;}
.px-extract-actions .px-extract-confirm{width:auto;flex:1;}

/* composer */
.px-composer{border-top:1px solid var(--line);background:#1a1d23;padding:12px 28px 16px;}
.px-composer-tools{display:flex;gap:10px;margin-bottom:8px;max-width:760px;margin:0 auto 8px;}
.px-tool{background:transparent;border:1px solid var(--line);color:var(--muted);padding:5px 12px;border-radius:999px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
.px-tool-toggle input{accent-color:var(--acc);}
.px-composer-input{display:flex;gap:10px;align-items:flex-end;max-width:760px;margin:0 auto;}
.px-composer-input textarea{flex:1;resize:none;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:#e6e9ef;padding:12px 14px;font-size:15px;font-family:inherit;line-height:1.5;}
.px-composer-input textarea:focus{outline:none;border-color:var(--acc);}
.px-send{background:var(--acc);color:#0a0c0f;border:none;border-radius:10px;font-weight:700;padding:12px 18px;cursor:pointer;font-size:14px;white-space:nowrap;font-family:inherit;}

/* inspector */
.px-inspector{background:var(--panel);overflow-y:auto;min-height:0;}
.px-inspector-head{display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);z-index:2;}
.px-inspector-head span:first-child{font-size:12px;font-weight:700;letter-spacing:1px;}
.px-inspector-sub{font-size:12px;color:var(--muted);font-family:var(--mono);}

/* verdict strip */
.px-verdict{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line);position:sticky;top:49px;z-index:1;}
.px-v-cell{background:var(--panel);padding:12px 8px;text-align:center;}
.px-v-lbl{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;}
.px-v-val{font-family:var(--mono);font-size:18px;font-weight:700;}

/* board */
.px-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;padding:14px;align-content:start;}
.px-card{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:13px 14px;}
.px-card--wide{grid-column:1 / -1;}
.px-card-h{font-weight:600;font-size:13.5px;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.px-card-hint{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:400;}
.px-badge{font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;}
.px-badge-live{color:var(--acc);background:rgba(34,211,238,.14);}

/* debate */
.px-debate{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.px-debate-h{font-weight:700;font-size:12.5px;margin-bottom:8px;}

/* bolded-hook bullets */
.px-points{list-style:none;display:flex;flex-direction:column;gap:9px;margin:0;padding:0;}
.px-points li{font-size:13.5px;line-height:1.5;color:#cdd3dd;}
.px-points b{color:#fff;font-weight:600;}
.px-points-tight li{font-size:13px;color:var(--muted);}
.px-more{background:none;border:none;color:var(--acc);cursor:pointer;font-size:12px;padding:6px 0 0;font-weight:600;font-family:inherit;}
.px-more-inline{padding:0;font-size:12px;}

/* advisory */
.px-lenses{display:flex;flex-direction:column;gap:13px;}
.px-lens-row{border-left:2px solid var(--line);padding-left:12px;}
.px-lens-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.px-lens-name{font-size:11.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}
.px-lens-verdict{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.5px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.04);}
.px-lens-hook{font-size:14px;line-height:1.5;color:#cdd3dd;}
.px-lens-hook b{color:#fff;font-weight:600;}
.px-lens-row .px-points{margin-top:8px;}

/* figures */
.px-figs{display:flex;flex-direction:column;gap:14px;}
.px-fig-row{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px;}
.px-fig-label{color:var(--muted);}
.px-fig-val{font-family:var(--mono);color:var(--acc);font-weight:600;}
.px-slider{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:#2c313b;outline:none;}
.px-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--acc);cursor:pointer;border:2px solid #16181d;}

.px-decision{display:flex;flex-direction:column;}
.px-input{width:100%;background:#13161b;border:1px solid var(--line);border-radius:8px;color:#e6e9ef;padding:10px 12px;font-size:14px;font-family:inherit;margin-bottom:10px;}
.px-input:focus{outline:none;border-color:var(--acc);}
.px-primary-btn{width:100%;background:var(--amber);color:#1a1205;border:none;border-radius:8px;font-weight:700;padding:11px;cursor:pointer;font-size:14px;font-family:inherit;}

/* shared chart shell */
.px-vsvg{width:100%;height:96px;background:#13161b;border:1px solid var(--line);border-radius:8px;display:block;}
.px-chart-line{fill:none;stroke:var(--acc);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-chart-fill{fill:rgba(34,211,238,.1);}
.px-ref{stroke-width:1.5;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;}
.px-pvf-legend{display:flex;gap:12px;margin-top:8px;font-size:11.5px;flex-wrap:wrap;align-items:center;}
.px-leg-gap{margin-left:auto;font-weight:600;font-family:var(--mono);color:#cdd3dd;}

/* chart A: price vs fair value */
.px-pvf-gap{fill:rgba(52,211,153,.08);}
.px-ref-now{stroke:#cdd3dd;} .px-ref-fair{stroke:var(--bull);}
.px-leg-now{color:#cdd3dd;} .px-leg-fair{color:var(--bull);}

/* chart B: football field */
.px-ff{position:relative;padding-top:4px;}
.px-ff-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.px-ff-label{width:56px;flex:0 0 56px;font-size:11.5px;color:var(--muted);text-align:right;}
.px-ff-track{position:relative;flex:1;height:14px;background:#13161b;border:1px solid var(--line);border-radius:3px;}
.px-ff-bar{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,var(--bear),var(--amber),var(--bull));opacity:.55;border-radius:3px;}
.px-ff-marker{position:absolute;top:0;bottom:18px;width:2px;background:#fff;}
.px-ff-marker-lbl{position:absolute;top:-2px;left:5px;font-size:10px;color:#fff;white-space:nowrap;font-family:var(--mono);}
.px-ff-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);padding-left:64px;margin-top:2px;}

/* chart C: margin-of-safety band */
.px-mos-track{position:relative;height:46px;background:#13161b;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.px-mos-band{position:absolute;top:0;bottom:0;background:rgba(52,211,153,.16);border-left:1.5px solid var(--bull);border-right:1.5px solid var(--bull);}
.px-mos-band-lbl{position:absolute;top:3px;left:5px;font-size:9.5px;color:var(--bull);font-family:var(--mono);white-space:nowrap;}
.px-mos-fair{position:absolute;top:0;bottom:0;width:2px;background:var(--bull);}
.px-mos-gap{position:absolute;top:50%;height:0;border-top:1.5px dashed var(--amber);}
.px-mos-price{position:absolute;top:0;bottom:0;width:2px;background:#fff;}
.px-mos-price-lbl{position:absolute;bottom:3px;left:5px;font-size:10px;color:#fff;font-family:var(--mono);white-space:nowrap;}
.px-mos-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:3px;}

/* chart D: sensitivity tornado */
.px-tor{display:flex;flex-direction:column;gap:11px;}
.px-tor-head{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);}
.px-tor-label{font-size:12px;color:#cdd3dd;margin-bottom:4px;display:flex;justify-content:space-between;gap:8px;}
.px-tor-label span{color:var(--muted);font-family:var(--mono);font-size:11px;}
.px-tor-track{position:relative;height:14px;background:#13161b;border:1px solid var(--line);border-radius:3px;}
.px-tor-bar{position:absolute;top:0;bottom:0;background:rgba(34,211,238,.4);border-radius:3px;}
.px-tor-mid{position:absolute;top:-2px;bottom:-2px;width:1px;background:#fff;opacity:.65;}

/* runway chart */
.px-ref-zero{stroke:var(--bear);} .px-ref-raise{stroke:var(--amber);}
.px-leg-raise{color:var(--amber);}

/* break-even chart */
.px-be-rev{fill:none;stroke:var(--bull);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-be-cost{fill:none;stroke:var(--bear);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-be-profit{fill:rgba(52,211,153,.07);}
.px-be-loss{fill:rgba(248,113,113,.05);}
.px-ref-bep{stroke:#fff;}
.px-leg-rev{color:var(--bull);} .px-leg-cost{color:var(--bear);}

/* stance banner — engine-derived valuation verdict */
.px-stance{display:flex;align-items:baseline;gap:10px;padding:11px 16px;background:rgba(52,211,153,.06);border-bottom:1px solid var(--line);flex-wrap:wrap;}
.px-stance-label{font-family:var(--mono);font-size:16px;font-weight:700;letter-spacing:.5px;}
.px-stance-basis{font-size:11.5px;color:var(--muted);}

/* thesis-support chip (replaces the ungrounded % confidence) */
.px-badge-support{color:var(--amber);background:rgba(240,168,41,.14);}

/* debate slot tag (4-slot rubric) */
.px-slot{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
  color:var(--muted);background:rgba(255,255,255,.05);border-radius:4px;padding:1px 6px;margin-right:6px;vertical-align:middle;}

/* P0 chart — MoS gap (intrinsic vs cost basis, both totals) */
.px-mos2-track{position:relative;height:46px;background:#13161b;border:1px solid var(--line);border-radius:8px;margin-top:14px;}
.px-mos2-gap{position:absolute;top:0;bottom:0;background:rgba(52,211,153,.14);}
.px-mos2-tick{position:absolute;top:0;bottom:0;width:2px;}
.px-mos2-cost{background:#cdd3dd;}
.px-mos2-npv{background:var(--bull);}
.px-mos2-tick span{position:absolute;bottom:3px;left:5px;font-size:10px;font-family:var(--mono);white-space:nowrap;}
.px-mos2-cost span{color:#cdd3dd;}
.px-mos2-npv span{color:var(--bull);top:3px;bottom:auto;}

/* P0 chart — DCF value bridge */
.px-bridge-bar{display:flex;height:30px;border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.px-bridge-seg{display:flex;align-items:center;justify-content:center;font-size:11px;color:#0a0c0f;font-weight:600;white-space:nowrap;}
.px-bridge-pv{background:rgba(34,211,238,.65);}
.px-bridge-term{background:rgba(240,168,41,.6);}
.px-bridge-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:12px;color:var(--muted);align-items:center;}
.px-bridge-legend b{color:#fff;font-family:var(--mono);font-weight:600;}
.px-bridge-total{margin-left:auto;color:#cdd3dd;font-family:var(--mono);font-weight:600;}
.px-bridge-flag{margin-top:10px;font-size:12px;line-height:1.5;color:var(--amber);background:rgba(240,168,41,.07);border-radius:6px;padding:8px 10px;}
`;
