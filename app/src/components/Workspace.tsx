"use client";

import { useEffect, useRef, useState } from "react";
import {
  PRESETS,
  BLANK_PARAMS,
  VERTICAL_SHORT,
  type Vertical,
  type AssetPreset,
} from "@/data/presets";
import { computeMetrics } from "@/lib/finance/compute";
import { personaFor } from "@/lib/ai/personas";
import {
  listAnalyses,
  getAnalysis,
  saveAnalysis,
  deleteAnalysis,
  createAnalysis,
  createManualAnalysis,
  listPortfolios,
  getPortfolio,
  savePortfolio,
  deletePortfolio,
  createPortfolio,
} from "@/lib/repo";
import type { Analysis, AssetType, PortfolioAnalysis } from "@/lib/domain/types";
import { ASSET_TYPE_LABELS } from "@/lib/domain/ic";
import { storage, DEFAULT_SETTINGS, type Settings } from "@/lib/storage";
import { importAll } from "@/lib/repo";
import { serializeBackup } from "@/lib/repo/backup";
import Library from "./Library";
import AgendaView from "./AgendaView";
import IdeaTriageView from "./IdeaTriageView";
import AnalysisView from "./AnalysisView";
import PortfolioView from "./PortfolioView";
import SettingsModal from "./Settings";
import { buildQaBackup, type QaFixtureName, qaFixtureNames } from "@/lib/qa/fixtures";
import {
  buildExplorationCarryForwardEvidence,
  seedICStateFromExploration,
  seedICStateFromTriageCandidate,
  type ExploreDeeperResult,
  type ExploreDirection,
  type TriageCandidate,
  type TriageMode,
} from "@/lib/domain/triage";

/** What the main pane is showing — a single analysis, a portfolio, or nothing. */
type Active =
  | { type: "agenda" }
  | { type: "triage" }
  | { type: "analysis"; data: Analysis }
  | { type: "portfolio"; data: PortfolioAnalysis };

type WorkspaceNoticeAction =
  | { type: "open-analysis"; id: string }
  | { type: "open-agenda" }
  | null;

type WorkspaceNotice = {
  message: string;
  actionLabel?: string;
  action: WorkspaceNoticeAction;
};

export default function Workspace({ initialQaFixtureRequested = false }: { initialQaFixtureRequested?: boolean }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioAnalysis[]>([]);
  const [active, setActive] = useState<Active>({ type: "agenda" });
  const [showNew, setShowNew] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [qaBootstrapped, setQaBootstrapped] = useState(false);
  const [qaFixtureRequested, setQaFixtureRequested] = useState(initialQaFixtureRequested);
  const [qaError, setQaError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portfolioSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAnalysisId = active?.type === "analysis" ? active.data.id : null;
  const activePortfolioId = active?.type === "portfolio" ? active.data.id : null;
  const qaLoading = qaFixtureRequested && !qaBootstrapped;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const fixture = params.get("qaFixture");
        const mock = params.get("qaMode") === "mock";
        setQaFixtureRequested(Boolean(fixture));
        const seedKey = fixture ? `jp-qa-seeded:${fixture}:${mock ? "mock" : "real"}` : null;
        if (fixture && qaFixtureNames().includes(fixture as QaFixtureName)) {
          const shouldSeed = !window.sessionStorage.getItem(seedKey!);
          if (shouldSeed) {
            try {
              const backup = buildQaBackup(fixture as QaFixtureName);
              await importAll(serializeBackup(backup), "replace");
              window.sessionStorage.setItem(seedKey!, "1");
              if (mock) {
                storage.saveSettings({
                  ...DEFAULT_SETTINGS,
                  apiKeys: { anthropic: "qa-mock", openai: "qa-mock", gemini: "qa-mock" },
                  model: "qa-mock",
                });
              }
            } catch (error) {
              setQaError(error instanceof Error ? error.message : String(error));
            }
          }
        }
      }

      const [nextAnalyses, nextPortfolios] = await Promise.all([listAnalyses(), listPortfolios()]);
      if (cancelled) return;
      setAnalyses(nextAnalyses);
      setPortfolios(nextPortfolios);
      setSettings(storage.getSettings());
      setQaBootstrapped(true);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setAnalyses(await listAnalyses());
  }

  async function refreshPortfolios() {
    setPortfolios(await listPortfolios());
  }

  async function open(id: string) {
    const a = await getAnalysis(id);
    if (a) setActive({ type: "analysis", data: a });
  }

  async function openPortfolio(id: string) {
    const p = await getPortfolio(id);
    if (p) setActive({ type: "portfolio", data: p });
  }

  function openAgenda() {
    setActive({ type: "agenda" });
  }

  function openTriage() {
    setActive({ type: "triage" });
  }

  function openSettings() {
    setShowSettings(true);
  }

  function runNoticeAction(action: WorkspaceNoticeAction) {
    if (!action) return;
    if (action.type === "open-agenda") {
      openAgenda();
      return;
    }
    void open(action.id);
  }

  function handleChange(next: Analysis) {
    setActive({ type: "analysis", data: next });
    // optimistic list update
    setAnalyses((list) => {
      const others = list.filter((a) => a.id !== next.id);
      return [{ ...next, updatedAt: Date.now() }, ...others];
    });
    // debounced persist
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAnalysis(next);
    }, 500);
  }

  function handlePortfolioChange(next: PortfolioAnalysis) {
    setActive({ type: "portfolio", data: next });
    setPortfolios((list) => {
      const others = list.filter((p) => p.id !== next.id);
      return [{ ...next, updatedAt: Date.now() }, ...others];
    });
    if (portfolioSaveTimer.current) clearTimeout(portfolioSaveTimer.current);
    portfolioSaveTimer.current = setTimeout(() => {
      savePortfolio(next);
    }, 500);
  }

  async function newPortfolio() {
    const p = createPortfolio("New portfolio");
    setActive({ type: "portfolio", data: p });
    await savePortfolio(p);
    await refreshPortfolios();
  }

  async function removePortfolio(id: string) {
    await deletePortfolio(id);
    if (activePortfolioId === id) setActive({ type: "agenda" });
    await refreshPortfolios();
  }

  async function newFromPreset(preset: AssetPreset) {
    const parameters = { ...preset.parameters };
    const metrics = computeMetrics(preset.vertical, parameters);
    const persona = personaFor(preset.vertical);
    const derived = persona.stance.derive(metrics);
    const analysis = createAnalysis({
      title: preset.name,
      vertical: preset.vertical,
      assetName: preset.name,
      parameters,
      metrics,
      debate: { thesisSupport: preset.seed.thesisSupport, bull: preset.seed.bull, bear: preset.seed.bear },
      advisory: preset.seed.advisory,
      persona: { id: persona.id, label: persona.label },
      stance: derived ? { label: derived.label, basis: preset.seed.stanceBasis || derived.basis } : null,
      model: "seed",
    });
    setActive({ type: "analysis", data: analysis });
    setShowNew(false);
    await saveAnalysis(analysis);
    await refresh();
  }

  function buildCaseFromTriage(
    selection: { candidate?: TriageCandidate; direction?: ExploreDirection; deeperExploration?: ExploreDeeperResult | null },
    prompt: string,
    triageMode: TriageMode,
    saveKind: "review" | "watchlist",
  ): Analysis {
    const candidate = selection.candidate;
    const direction = selection.direction;
    const deeperExploration = selection.deeperExploration ?? null;
    const assetType = candidate?.assetType ?? direction?.assetType;
    const assetName = candidate?.assetName ?? direction?.assetName ?? "";
    const title = candidate?.title ?? direction?.title ?? (assetName ? `${assetName} review` : "New investment review");
    const shouldSeedFromExplore = Boolean(direction);
    const imported = buildExplorationCarryForwardEvidence(prompt);

    if (!assetType) {
      throw new Error("Triage selection is missing an asset type.");
    }

    if (assetType === "public_equity") {
      const vertical: Vertical = "stocks";
      const analysis = createAnalysis({
        title,
        vertical,
        assetName,
        parameters: { ...BLANK_PARAMS[vertical] },
        metrics: computeMetrics(vertical, { ...BLANK_PARAMS[vertical] }),
        model: "seed",
      });
      analysis.tags = saveKind === "watchlist" ? ["triage", "watchlist"] : ["triage"];
      if (shouldSeedFromExplore && direction) {
        analysis.ic = seedICStateFromExploration(direction, deeperExploration, analysis.ic);
        if (imported) analysis.evidence = [imported, ...analysis.evidence];
        analysis.reviewMode = "kickoff";
      } else if (candidate) {
        analysis.ic = seedICStateFromTriageCandidate(candidate, analysis.ic);
        if (imported) analysis.evidence = [imported, ...analysis.evidence];
        analysis.reviewMode = triageMode === "broad_screen" ? "kickoff" : "fact_check";
      }
      return analysis;
    }

    const analysis = createManualAnalysis({
      title,
      assetName,
      assetType: assetType as Exclude<AssetType, "public_equity">,
      model: "manual",
    });
    analysis.tags = saveKind === "watchlist" ? ["triage", "watchlist"] : ["triage"];
    if (shouldSeedFromExplore && direction) {
      analysis.ic = seedICStateFromExploration(direction, deeperExploration, analysis.ic);
      if (imported) analysis.evidence = [imported, ...analysis.evidence];
      analysis.reviewMode = "kickoff";
    } else if (candidate) {
      analysis.ic = seedICStateFromTriageCandidate(candidate, analysis.ic);
      if (imported) analysis.evidence = [imported, ...analysis.evidence];
      analysis.reviewMode = triageMode === "broad_screen" ? "kickoff" : "fact_check";
    }
    return analysis;
  }

  async function startCaseFromTriage(
    selection: { candidate?: TriageCandidate; direction?: ExploreDirection; deeperExploration?: ExploreDeeperResult | null },
    prompt: string,
    triageMode: TriageMode,
  ) {
    const analysis = buildCaseFromTriage(selection, prompt, triageMode, "review");
    setActive({ type: "analysis", data: analysis });
    await saveAnalysis(analysis);
    await refresh();
    setNotice({
      message: selection.direction
        ? "Saved review opened. Your selected idea, risks, and open questions are ready. Use Check the facts when you want to start the concrete fact-check step."
        : "Saved review opened. The raw exploration prompt is in Evidence Locker as an unverified note.",
      actionLabel: "Check the facts",
      action: { type: "open-analysis", id: analysis.id },
    });
  }

  async function addWatchlistFromTriage(
    selection: { candidate?: TriageCandidate; direction?: ExploreDirection; deeperExploration?: ExploreDeeperResult | null },
    prompt: string,
    triageMode: TriageMode,
  ) {
    const analysis = buildCaseFromTriage(selection, prompt, triageMode, "watchlist");
    await saveAnalysis(analysis);
    await refresh();
    setNotice({
      message: "Saved to your watchlist in Library. Open the saved draft when you're ready to check the facts.",
      actionLabel: "Open saved draft",
      action: { type: "open-analysis", id: analysis.id },
    });
  }

  async function newBlank(vertical: Vertical) {
    const parameters = { ...BLANK_PARAMS[vertical] };
    const analysis = createAnalysis({
      title: `New ${VERTICAL_SHORT[vertical]} Analysis`,
      vertical,
      assetName: "",
      parameters,
      metrics: computeMetrics(vertical, parameters),
      // No seed debate — a blank entry starts empty and waits for ⚡ RUN AI.
      model: "seed",
    });
    setActive({ type: "analysis", data: analysis });
    setShowNew(false);
    await saveAnalysis(analysis);
    await refresh();
  }

  async function newManualAsset(assetType: Exclude<AssetType, "public_equity">) {
    const analysis = createManualAnalysis({
      title: `New ${ASSET_TYPE_LABELS[assetType]}`,
      assetType,
      model: "manual",
    });
    setActive({ type: "analysis", data: analysis });
    setShowNew(false);
    await saveAnalysis(analysis);
    await refresh();
  }

  async function remove(id: string) {
    await deleteAnalysis(id);
    if (activeAnalysisId === id) setActive({ type: "agenda" });
    await refresh();
  }

  return (
    <div className="workspace" data-qa="workspace">
      {qaError && (
        <div className="workspace-qa-error" data-qa="qa-error">
          {qaError}
        </div>
      )}
      {qaLoading ? (
        <div className="workspace-qa-loading" data-qa="qa-loading">
          Loading QA fixture...
        </div>
      ) : (
        <>
      <Library
        analyses={analyses}
        portfolios={portfolios}
        activeView={active.type}
        activeId={activeAnalysisId}
        activePortfolioId={activePortfolioId}
        onOpenAgenda={openAgenda}
        onOpenTriage={openTriage}
        onOpen={open}
        onOpenPortfolio={openPortfolio}
        onDelete={remove}
        onDeletePortfolio={removePortfolio}
      />

      <main className="workspace-main">
        <header className="cockpit-header">
          <div className="branding">
            <span className="system-tag">MY WEALTH WORKSPACE</span>
            <span className="status-light-container">
              <span className="status-light blinking-green" />
              <span className="status-text">Private on this device</span>
            </span>
          </div>
          <div className="header-actions">
            <button className="gear-btn" onClick={openSettings}>
              Settings{settings.apiKeys?.[settings.provider] ? "" : " *"}
            </button>
          </div>
        </header>
        {notice && (
          <div className="workspace-notice" data-qa="workspace-notice">
            <span>{notice.message}</span>
            <div className="workspace-notice-actions">
              {notice.actionLabel && notice.action && (
                <button className="tp-mini-btn" type="button" onClick={() => runNoticeAction(notice.action)}>
                  {notice.actionLabel}
                </button>
              )}
              <button className="tp-ghost" type="button" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {active.type === "agenda" ? (
          <AgendaView
            analyses={analyses}
            portfolios={portfolios}
            onOpenAnalysis={open}
            onOpenPortfolio={openPortfolio}
            onInvestigateIdea={openTriage}
            onNewInvestment={() => setShowNew(true)}
            onNewPortfolio={newPortfolio}
          />
        ) : active.type === "triage" ? (
          <IdeaTriageView
            onStartCase={startCaseFromTriage}
            onAddToWatchlist={addWatchlistFromTriage}
            onBackAgenda={openAgenda}
            provider={settings.provider}
            apiKey={settings.apiKeys?.[settings.provider] ?? ""}
            model={settings.model}
            onNeedSettings={openSettings}
          />
        ) : active.type === "analysis" ? (
          <AnalysisView
            analysis={active.data}
            onChange={handleChange}
            provider={settings.provider}
            apiKey={settings.apiKeys?.[settings.provider] ?? ""}
            model={settings.model}
            onNeedSettings={openSettings}
            onOpenExplore={openTriage}
          />
        ) : active.type === "portfolio" ? (
          <PortfolioView
            portfolio={active.data}
            analyses={analyses}
            onChange={handlePortfolioChange}
            provider={settings.provider}
            apiKey={settings.apiKeys?.[settings.provider] ?? ""}
            model={settings.model}
            onNeedSettings={openSettings}
          />
        ) : (
          <div className="workspace-empty">
            <div className="empty-card">
              <h2>Start managing your wealth</h2>
              <p>Add an investment you already own, explore a new idea, or create a portfolio to see everything together.</p>
              <button className="commit-btn" data-qa="empty-new-analysis" onClick={() => setShowNew(true)}>Add investment</button>
              <button className="example-link" data-qa="empty-new-manual" onClick={openTriage}>Explore an idea</button>
              <button className="example-link" onClick={() => setShowNew(true)}>Track a private or custom asset</button>
              <button className="example-link" onClick={newPortfolio}>Create a portfolio</button>
            </div>
          </div>
        )}
      </main>

      {showNew && (
        <NewInvestmentDialog
          onBlank={newBlank}
          onManual={newManualAsset}
          onPick={newFromPreset}
          onExploreIdea={openTriage}
          onCreatePortfolio={newPortfolio}
          onClose={() => setShowNew(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          initial={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
          onImported={async () => {
            await Promise.all([refresh(), refreshPortfolios()]);
            setActive({ type: "agenda" });
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

function NewInvestmentDialog({
  onBlank,
  onManual,
  onPick,
  onExploreIdea,
  onCreatePortfolio,
  onClose,
}: {
  onBlank: (vertical: Vertical) => void;
  onManual: (assetType: Exclude<AssetType, "public_equity">) => void;
  onPick: (preset: AssetPreset) => void;
  onExploreIdea: () => void;
  onCreatePortfolio: () => Promise<void>;
  onClose: () => void;
}) {
  const [intent, setIntent] = useState<"owned" | "research" | "private" | "portfolio">("owned");
  const [vertical, setVertical] = useState<Vertical>("stocks");
  const [privatePath, setPrivatePath] = useState<"structured" | "manual">("manual");

  function openExploreIdea() {
    onClose();
    onExploreIdea();
  }

  function createPortfolioFromModal() {
    onClose();
    void onCreatePortfolio();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header warning-stripes">
          <span className="panel-title">ADD TO YOUR WEALTH WORKSPACE</span>
          <button className="new-btn" onClick={onClose}>×</button>
        </div>
        <div className="panel-body new-analysis-body">
          <div className="new-investment-intro">
            <h3>What do you want to do?</h3>
            <p>Start from your goal, not from the system setup.</p>
          </div>

          <div className="intent-grid">
            <button className={`intent-card${intent === "owned" ? " active" : ""}`} onClick={() => setIntent("owned")}>
              <strong>Add something I already own</strong>
              <span>Open an investment review for a stock, fund, or operating business you want to track.</span>
            </button>
            <button className={`intent-card${intent === "research" ? " active" : ""}`} onClick={() => setIntent("research")}>
              <strong>Explore an idea</strong>
              <span>Explore an idea before it becomes a saved investment review.</span>
            </button>
            <button className={`intent-card${intent === "private" ? " active" : ""}`} onClick={() => setIntent("private")}>
              <strong>Track a startup, private, or custom asset</strong>
              <span>Choose based on what you have: structured numbers, notes, a deck, or incomplete information.</span>
            </button>
            <button className={`intent-card${intent === "portfolio" ? " active" : ""}`} onClick={() => setIntent("portfolio")}>
              <strong>Create a portfolio</strong>
              <span>Group your saved investment reviews and see your overall allocation in one place.</span>
            </button>
          </div>

          {intent === "owned" && (
            <>
          <div className="label-text">Choose the investment type</div>
          <div className="vertical-selector-group">
            {(Object.keys(PRESETS) as Vertical[]).map((v, i) => (
              <button key={v} className={`selector-btn${v === vertical ? " active" : ""}`} onClick={() => setVertical(v)}>
                <span className="btn-num">{`[0${i + 1}]`}</span>{" "}
                {v === "stocks" ? "PUBLIC STOCK" : v === "startups" ? "STARTUP / VC" : "OPERATING BUSINESS"}
              </button>
            ))}
          </div>

          <div className="label-text">Start your investment review</div>
          <button className="blank-start-btn" onClick={() => onBlank(vertical)}>
            <span className="blank-start-title">Start investment review</span>
            <span className="blank-start-hint">
              Blank {VERTICAL_SHORT[vertical]} review — name it, verify the facts, and save your view.
            </span>
          </button>

          <details className="example-disclosure">
            <summary>Or start from an example...</summary>
            <div className="template-list">
              {PRESETS[vertical].map((p) => (
                <button key={p.id} className="template-item" onClick={() => onPick(p)}>
                  <strong>{p.name}</strong>
                  <span className="template-hint">example investment review</span>
                </button>
              ))}
            </div>
          </details>
            </>
          )}

          {intent === "research" && (
            <div className="intent-detail">
              <div className="label-text">Guided exploration</div>
              <p className="intent-copy">You will start with simple prompts like what the investment is, why it interests you, and what still needs to be checked.</p>
              <button className="blank-start-btn" onClick={openExploreIdea}>
                <span className="blank-start-title">Explore an idea</span>
                <span className="blank-start-hint">Nothing is saved until you choose to open a real investment review.</span>
              </button>
            </div>
          )}

          {intent === "private" && (
            <>
              <div className="label-text">What do you have?</div>
              <div className="intent-subgrid">
                <button className={`intent-card${privatePath === "structured" ? " active" : ""}`} onClick={() => setPrivatePath("structured")}>
                  <strong>I have structured numbers</strong>
                  <span>Use the modeled review path for a startup or operating business when you already know the core figures.</span>
                </button>
                <button className={`intent-card${privatePath === "manual" ? " active" : ""}`} onClick={() => setPrivatePath("manual")}>
                  <strong>I have notes, a deck, or incomplete info</strong>
                  <span>Use the manual path when you need valuation notes, evidence, and risk checks before a modeled review.</span>
                </button>
              </div>
              {privatePath === "structured" ? (
                <>
                  <div className="label-text">Start a modeled review</div>
                  <div className="template-list">
                    <button className="template-item" data-qa="private-structured-startup" onClick={() => onBlank("startups")}>
                      <strong>Startup</strong>
                      <span className="template-hint">engine-backed review for structured venture inputs</span>
                    </button>
                    <button className="template-item" data-qa="private-structured-conventional" onClick={() => onBlank("conventional")}>
                      <strong>Operating business</strong>
                      <span className="template-hint">engine-backed review for a structured private business case</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="label-text">Choose the asset type for a manual review</div>
                  <div className="template-list">
                    {(["conventional_business", "startup", "real_estate", "crypto", "macro_view", "other"] as const).map((assetType) => (
                      <button key={assetType} className="template-item" data-qa={`manual-template-${assetType}`} onClick={() => onManual(assetType)}>
                        <strong>{ASSET_TYPE_LABELS[assetType]}</strong>
                        <span className="template-hint">your own valuation, notes, and risk checks</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {intent === "portfolio" && (
            <div className="intent-detail">
              <div className="label-text">Portfolio workspace</div>
              <p className="intent-copy">Build a portfolio from your saved investment reviews and track your overall allocation in one place.</p>
              <button className="blank-start-btn" onClick={createPortfolioFromModal}>
                <span className="blank-start-title">Create portfolio</span>
                <span className="blank-start-hint">You can add holdings and capital amounts after the portfolio opens.</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
