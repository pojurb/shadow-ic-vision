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
} from "@/lib/repo";
import type { Analysis } from "@/lib/domain/types";
import { storage, DEFAULT_SETTINGS, type Settings } from "@/lib/storage";
import Library from "./Library";
import AnalysisView from "./AnalysisView";
import SettingsModal from "./Settings";

export default function Workspace() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [active, setActive] = useState<Analysis | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listAnalyses().then(setAnalyses);
    setSettings(storage.getSettings());
  }, []);

  async function refresh() {
    setAnalyses(await listAnalyses());
  }

  async function open(id: string) {
    const a = await getAnalysis(id);
    if (a) setActive(a);
  }

  function handleChange(next: Analysis) {
    setActive(next);
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
    await saveAnalysis(analysis);
    await refresh();
    setActive(analysis);
    setShowNew(false);
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
    await saveAnalysis(analysis);
    await refresh();
    setActive(analysis);
    setShowNew(false);
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
    await saveAnalysis(analysis);
    await refresh();
    setActive(analysis);
    setShowNew(false);
  }

  async function remove(id: string) {
    await deleteAnalysis(id);
    if (active?.id === id) setActive(null);
    await refresh();
  }

  return (
    <div className="workspace">
      <Library
        analyses={analyses}
        activeId={active?.id ?? null}
        onOpen={open}
        onDelete={remove}
        onNew={newIntake}
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

        {active ? (
          <AnalysisView
            analysis={active}
            onChange={handleChange}
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
              <button className="commit-btn" onClick={newIntake}>+ NEW ANALYSIS</button>
              <button className="example-link" onClick={() => setShowNew(true)}>or start from an example…</button>
            </div>
          </div>
        )}
      </main>

      {showNew && (
        <NewAnalysisDialog
          onBlank={newBlank}
          onPick={newFromPreset}
          onClose={() => setShowNew(false)}
        />
      )}
      {showSettings && (
        <SettingsModal initial={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function NewAnalysisDialog({
  onBlank,
  onPick,
  onClose,
}: {
  onBlank: (vertical: Vertical) => void;
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
