"use client";

import { useState } from "react";
import { MODELS } from "@/lib/ai/client";
import { storage, type Settings } from "@/lib/storage";

export default function SettingsModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);

  function save() {
    const next: Settings = { apiKey: apiKey.trim(), model };
    storage.saveSettings(next);
    onSave(next);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header warning-stripes">
          <span className="panel-title">SETTINGS — BYOK</span>
          <button className="new-btn" onClick={onClose}>✕</button>
        </div>
        <div className="panel-body">
          <div className="settings-field">
            <label htmlFor="api-key">Anthropic API Key</label>
            <input
              id="api-key"
              type="password"
              className="meta-input"
              style={{ width: "100%" }}
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="settings-note">
              🔒 Your key is stored only in this browser (localStorage) and is sent directly to the
              Anthropic API. It never touches our servers. Get a key at{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
            </p>
          </div>
          <div className="settings-field">
            <label htmlFor="model">Model</label>
            <select id="model" className="meta-input" style={{ width: "100%" }} value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p className="settings-note">You pay for API usage with your own key. Cheaper models cost less per analysis.</p>
          </div>
          <button className="commit-btn" onClick={save}>SAVE</button>
        </div>
      </div>
    </div>
  );
}
