"use client";

import { useState } from "react";
import { PROVIDER_LIST, getProvider } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";
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
  const [provider, setProvider] = useState<ProviderId>(initial.provider);
  const [apiKeys, setApiKeys] = useState<Settings["apiKeys"]>({ ...initial.apiKeys });
  const [model, setModel] = useState(initial.model);

  const currentProvider = getProvider(provider);
  const models = currentProvider.models;
  const caps = currentProvider.capabilities(model);

  function changeProvider(next: ProviderId) {
    setProvider(next);
    // Reset the model to the new provider's default; its ids won't match the old one.
    const first = getProvider(next).models[0]?.id ?? "";
    setModel(first);
  }

  function setKey(value: string) {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
  }

  function save() {
    const next: Settings = { provider, apiKeys: { ...apiKeys, [provider]: apiKeys[provider]?.trim() ?? "" }, model };
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
            <label htmlFor="provider">AI Provider</label>
            <select
              id="provider"
              className="meta-input"
              style={{ width: "100%" }}
              value={provider}
              onChange={(e) => changeProvider(e.target.value as ProviderId)}
            >
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="settings-note">
              Bring your own key for any supported provider — that model is the engine for the
              debate, chat, and research.
            </p>
          </div>
          <div className="settings-field">
            <label htmlFor="api-key">
              API Key <span style={{ opacity: 0.6, fontWeight: 400 }}>({provider})</span>
            </label>
            <input
              id="api-key"
              type="password"
              className="meta-input"
              style={{ width: "100%" }}
              placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
              value={apiKeys[provider] ?? ""}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
            <p className="settings-note">
              🔒 Each provider&apos;s key is stored only in this browser (localStorage) and is sent
              directly to that provider&apos;s API. It never touches our servers.
            </p>
            {(!caps.webFetchNative || !caps.webSearchNative) && (
              <p className="settings-note" style={{ marginTop: 4 }}>
                ⚠ Web fetch &amp; search for this provider use a server-side fallback route. Web
                search also requires <code>TAVILY_API_KEY</code> set in <code>app/.env.local</code>{" "}
                on the server (see <code>.env.local.example</code>).
              </p>
            )}
          </div>
          <div className="settings-field">
            <label htmlFor="model">Model</label>
            <select id="model" className="meta-input" style={{ width: "100%" }} value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
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
