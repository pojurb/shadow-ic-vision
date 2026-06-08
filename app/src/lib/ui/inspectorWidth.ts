/**
 * Persist the resizable inspector pane's width across reloads (per view).
 * Browser-only with SSR-safe guards; values are clamped by the caller.
 */
export function loadInspectorWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function saveInspectorWidth(key: string, width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(Math.round(width)));
  } catch {
    /* storage blocked — ignore */
  }
}
