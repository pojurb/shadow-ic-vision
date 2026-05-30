"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS, VERTICAL_LABELS, type Vertical, type AssetPreset } from "@/data/presets";
import { computeMetrics } from "@/lib/finance/compute";
import {
  listAnalyses,
  getAnalysis,
  saveAnalysis,
  deleteAnalysis,
  createAnalysis,
} from "@/lib/repo";
import type { Analysis } from "@/lib/domain/types";
import { storage, type Settings } from "@/lib/storage";
import Library from "./Library";
import AnalysisView from "./AnalysisView";
import SettingsModal from "./Settings";

export default function Workspace() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [active, setActive] = useState<Analysis | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [settings, setSettings] = useState<Settings>({ apiKey: "", model: "claude-opus-4-8" });
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
    const analysis = createAnalysis({
      title: preset.name,
      vertical: preset.vertical,
      assetName: preset.name,
      parameters,
      metrics: computeMetrics(preset.vertical, parameters),
      debate: { confidence: preset.seed.confidence, bull: preset.seed.bull, bear: preset.seed.bear },
      advisory: preset.seed.advisory,
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
        onNew={() => setShowNew(true)}
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
              ⚙ SETTINGS{settings.apiKey ? "" : " ⚠"}
            </button>
          </div>
        </header>

        {active ? (
          <AnalysisView
            analysis={active}
            onChange={handleChange}
            apiKey={settings.apiKey}
            model={settings.model}
            onNeedSettings={() => setShowSettings(true)}
          />
        ) : (
          <div className="workspace-empty">
            <div className="empty-card">
              <h2>No analysis open</h2>
              <p>Create a new analysis or pick one from the Library.</p>
              <button className="commit-btn" onClick={() => setShowNew(true)}>+ NEW ANALYSIS</button>
            </div>
          </div>
        )}
      </main>

      {showNew && <NewAnalysisDialog onPick={newFromPreset} onClose={() => setShowNew(false)} />}
      {showSettings && (
        <SettingsModal initial={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function NewAnalysisDialog({
  onPick,
  onClose,
}: {
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
        <div className="panel-body">
          <div className="label-text">1. Choose vertical</div>
          <div className="vertical-selector-group">
            {(Object.keys(PRESETS) as Vertical[]).map((v, i) => (
              <button key={v} className={`selector-btn${v === vertical ? " active" : ""}`} onClick={() => setVertical(v)}>
                <span className="btn-num">{`[0${i + 1}]`}</span>{" "}
                {v === "stocks" ? "STOCKS" : v === "startups" ? "STARTUP / VC" : "CONVENTIONAL"}
              </button>
            ))}
          </div>
          <div className="label-text" style={{ marginTop: 12 }}>2. Start from a template — {VERTICAL_LABELS[vertical]}</div>
          <div className="template-list">
            {PRESETS[vertical].map((p) => (
              <button key={p.id} className="template-item" onClick={() => onPick(p)}>
                <strong>{p.name}</strong>
                <span className="template-hint">seed confidence {p.seed.confidence}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
