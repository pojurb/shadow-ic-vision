"use client";

import { useRef, useState } from "react";
import { PROVIDER_LIST, getProvider } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";
import { storage, type Settings } from "@/lib/storage";
import { exportAll, importAll, type ImportCounts } from "@/lib/repo";

export default function SettingsModal({
  initial,
  onSave,
  onClose,
  onImported,
}: {
  initial: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
  onImported?: () => void;
}) {
  const [provider, setProvider] = useState<ProviderId>(initial.provider);
  const [apiKeys, setApiKeys] = useState<Settings["apiKeys"]>({ ...initial.apiKeys });
  const [model, setModel] = useState(initial.model);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function doExport() {
    setBusy("export");
    setBackupMsg(null);
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jp-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const parsed = JSON.parse(json) as { analyses: unknown[]; portfolios: unknown[]; blobs: unknown[] };
      setBackupMsg({
        kind: "ok",
        text: `Saved ${parsed.analyses.length} analyses, ${parsed.portfolios.length} portfolios, ${parsed.blobs.length} attachments.`,
      });
    } catch (e) {
      setBackupMsg({ kind: "err", text: e instanceof Error ? e.message : "Export failed." });
    } finally {
      setBusy(null);
    }
  }

  function pickImport() {
    setBackupMsg(null);
    fileRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const replace = window.confirm(
      "Replace ALL current workspace data with this backup?\n\n" +
        "OK = Replace all (wipes existing analyses, portfolios, folders & attachments first).\n" +
        "Cancel = Merge (adds/updates from the backup, keeps everything else).",
    );
    const mode: "merge" | "replace" = replace ? "replace" : "merge";
    setBusy("import");
    try {
      const text = await file.text();
      const counts: ImportCounts = await importAll(text, mode);
      setBackupMsg({
        kind: "ok",
        text: `${mode === "replace" ? "Replaced" : "Merged"} — ${counts.analyses} analyses, ${counts.portfolios} portfolios, ${counts.folders} folders, ${counts.blobs} attachments.`,
      });
      onImported?.();
    } catch (err) {
      setBackupMsg({ kind: "err", text: err instanceof Error ? err.message : "Import failed." });
    } finally {
      setBusy(null);
    }
  }

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
              placeholder={provider === "anthropic" ? "sk-ant-..." : provider === "gemini" ? "AIza..." : "sk-..."}
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

          <div className="settings-field">
            <label>Backup &amp; Restore</label>
            <p className="settings-note">
              Your workspace lives only in this browser. Export a backup file to keep a copy or move to
              another machine. Backups include analyses, portfolios, folders &amp; attachments —{" "}
              <strong>but never your API keys</strong>.
            </p>
            <div className="backup-row">
              <button className="ghost-btn" onClick={doExport} disabled={busy !== null}>
                {busy === "export" ? "Exporting…" : "⬇ Export workspace"}
              </button>
              <button className="ghost-btn" onClick={pickImport} disabled={busy !== null}>
                {busy === "import" ? "Importing…" : "⬆ Import workspace"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={onFilePicked}
              />
            </div>
            {backupMsg && (
              <p className="settings-note" style={{ marginTop: 6, color: backupMsg.kind === "err" ? "var(--danger, #c0392b)" : undefined }}>
                {backupMsg.kind === "err" ? "⚠ " : "✓ "}
                {backupMsg.text}
              </p>
            )}
          </div>

          <button className="commit-btn" onClick={save}>SAVE</button>
        </div>
      </div>
    </div>
  );
}
