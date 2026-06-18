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
import AnalysisView from "./AnalysisView";
import PortfolioView from "./PortfolioView";
import SettingsModal from "./Settings";
import { buildQaBackup, type QaFixtureName, qaFixtureNames } from "@/lib/qa/fixtures";

/** What the main pane is showing — a single analysis, a portfolio, or nothing. */
type Active =
  | { type: "agenda" }
  | { type: "analysis"; data: Analysis }
  | { type: "portfolio"; data: PortfolioAnalysis };

export default function Workspace({ initialQaFixtureRequested = false }: { initialQaFixtureRequested?: boolean }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioAnalysis[]>([]);
  const [active, setActive] = useState<Active>({ type: "agenda" });
  const [showNew, setShowNew] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
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

  /**
   * Chat-first front door (Option C): create a blank intake draft and open it. No
   * vertical is forced — the conversation's intake pass detects it. Presets remain
   * reachable as examples (the secondary affordance below).
   */
  async function newIntake() {
    const vertical: Vertical = "stocks"; // a neutral starting point; intake reclassifies
    const parameters = { ...BLANK_PARAMS[vertical] };
    const analysis = createAnalysis({
      title: "New analysis",
      vertical,
      assetName: "",
      parameters,
      metrics: computeMetrics(vertical, parameters),
      // No debate, no persona — the composer's intake flow fills these in.
      model: "seed",
    });
    setActive({ type: "analysis", data: analysis });
    setShowNew(false);
    await saveAnalysis(analysis);
    await refresh();
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
        onOpen={open}
        onOpenPortfolio={openPortfolio}
        onDelete={remove}
        onDeletePortfolio={removePortfolio}
        onNew={newIntake}
        onNewManual={() => setShowNew(true)}
        onNewPortfolio={newPortfolio}
      />

      <main className="workspace-main">
        <header className="cockpit-header">
          <div className="branding">
            <span className="system-tag">JP-INVEST WORKSPACE V3.0</span>
            <span className="status-light-container">
              <span className="status-light blinking-green" />
              <span className="status-text">LOCAL-FIRST · BYOK</span>
            </span>
          </div>
          <div className="header-actions">
            <button className="gear-btn" onClick={() => setShowSettings(true)}>
              ⚙ SETTINGS{settings.apiKeys?.[settings.provider] ? "" : " ⚠"}
            </button>
          </div>
        </header>

        {active.type === "agenda" ? (
          <AgendaView
            analyses={analyses}
            portfolios={portfolios}
            onOpenAnalysis={open}
            onOpenPortfolio={openPortfolio}
            onNewAnalysis={newIntake}
            onNewManual={() => setShowNew(true)}
            onNewPortfolio={newPortfolio}
          />
        ) : active.type === "analysis" ? (
          <AnalysisView
            analysis={active.data}
            onChange={handleChange}
            provider={settings.provider}
            apiKey={settings.apiKeys?.[settings.provider] ?? ""}
            model={settings.model}
            onNeedSettings={() => setShowSettings(true)}
          />
        ) : active.type === "portfolio" ? (
          <PortfolioView
            portfolio={active.data}
            analyses={analyses}
            onChange={handlePortfolioChange}
            provider={settings.provider}
            apiKey={settings.apiKeys?.[settings.provider] ?? ""}
            model={settings.model}
            onNeedSettings={() => setShowSettings(true)}
          />
        ) : (
          <div className="workspace-empty">
            <div className="empty-card">
              <h2>Start a new analysis</h2>
              <p>Paste or describe a deal — the analyst detects the type, pulls the figures, and confirms before locking.</p>
              <button className="commit-btn" data-qa="empty-new-analysis" onClick={newIntake}>+ NEW ANALYSIS</button>
              <button className="example-link" data-qa="empty-new-manual" onClick={() => setShowNew(true)}>+ MANUAL ASSET</button>
              <button className="example-link" onClick={() => setShowNew(true)}>or start from an example…</button>
              <button className="example-link" onClick={newPortfolio}>or compose a portfolio…</button>
            </div>
          </div>
        )}
      </main>

      {showNew && (
        <NewAnalysisDialog
          onBlank={newBlank}
          onManual={newManualAsset}
          onPick={newFromPreset}
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

function NewAnalysisDialog({
  onBlank,
  onManual,
  onPick,
  onClose,
}: {
  onBlank: (vertical: Vertical) => void;
  onManual: (assetType: Exclude<AssetType, "public_equity">) => void;
  onPick: (preset: AssetPreset) => void;
  onClose: () => void;
}) {
  const [vertical, setVertical] = useState<Vertical>("stocks");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header warning-stripes">
          <span className="panel-title">NEW ANALYSIS</span>
          <button className="new-btn" onClick={onClose}>✕</button>
        </div>
        <div className="panel-body new-analysis-body">
          <div className="label-text">1. Choose category</div>
          <div className="vertical-selector-group">
            {(Object.keys(PRESETS) as Vertical[]).map((v, i) => (
              <button key={v} className={`selector-btn${v === vertical ? " active" : ""}`} onClick={() => setVertical(v)}>
                <span className="btn-num">{`[0${i + 1}]`}</span>{" "}
                {v === "stocks" ? "STOCKS" : v === "startups" ? "STARTUP / VC" : "CONVENTIONAL"}
              </button>
            ))}
          </div>

          <div className="label-text">2. Start</div>
          <button className="blank-start-btn" onClick={() => onBlank(vertical)}>
            <span className="blank-start-title">◉ START BLANK</span>
            <span className="blank-start-hint">
              Empty {VERTICAL_SHORT[vertical]} entry — name it and set your own numbers
            </span>
          </button>

          <div className="label-text">3. Manual asset</div>
          <div className="template-list">
            {(["conventional_business", "startup", "real_estate", "crypto", "macro_view", "other"] as const).map((assetType) => (
              <button key={assetType} className="template-item" data-qa={`manual-template-${assetType}`} onClick={() => onManual(assetType)}>
                <strong>{ASSET_TYPE_LABELS[assetType]}</strong>
                <span className="template-hint">manual valuation, risk prompts, and IC memory</span>
              </button>
            ))}
          </div>

          <details className="example-disclosure">
            <summary>○ Or load an example…</summary>
            <div className="template-list">
              {PRESETS[vertical].map((p) => (
                <button key={p.id} className="template-item" onClick={() => onPick(p)}>
                  <strong>{p.name}</strong>
                  <span className="template-hint">seed thesis {p.seed.thesisSupport}</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
