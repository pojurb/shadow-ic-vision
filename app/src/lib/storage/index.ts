/**
 * Storage abstraction. v1 is local-first (browser localStorage). The interface
 * is the seam that lets a DB-backed, multi-user implementation drop in later
 * without touching the UI.
 */

export type DecisionAction = "APPROVE" | "HOLD" | "REJECT";

export interface LedgerEntry {
  id: number;
  assetName: string;
  vertical: string;
  action: DecisionAction;
  notes: string;
  timestamp: string;
}

export interface Settings {
  /** Anthropic API key — never leaves the browser in the local-first model. */
  apiKey: string;
  /** Selected model id for the debate. */
  model: string;
}

export interface AppStorage {
  getLedger(): LedgerEntry[];
  saveDecision(entry: LedgerEntry): void;
  clearLedger(): void;
  getSettings(): Settings;
  saveSettings(settings: Settings): void;
}

const LEDGER_KEY = "jp_ledger";
const SETTINGS_KEY = "jp_settings";

export const DEFAULT_SETTINGS: Settings = { apiKey: "", model: "claude-opus-4-8" };

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked (private mode / quota) — fail silently */
  }
}

/** Browser localStorage implementation of {@link AppStorage}. */
export const storage: AppStorage = {
  getLedger() {
    return readJSON<LedgerEntry[]>(LEDGER_KEY, []);
  },
  saveDecision(entry) {
    const next = [entry, ...this.getLedger()];
    writeJSON(LEDGER_KEY, next);
  },
  clearLedger() {
    writeJSON(LEDGER_KEY, []);
  },
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...readJSON<Partial<Settings>>(SETTINGS_KEY, {}) };
  },
  saveSettings(settings) {
    writeJSON(SETTINGS_KEY, settings);
  },
};
