/**
 * BYOK browser-side Anthropic access via raw fetch. The user's key lives only in
 * their browser and is sent directly to api.anthropic.com — never to our server.
 *
 * We call the REST API directly (not the Node SDK) because the SDK's entry pulls
 * in Node-only modules (node:fs / node:path from credential loading) that cannot
 * be bundled for the browser. The `anthropic-dangerous-direct-browser-access`
 * header is the documented way to allow direct browser calls (CORS-enabled).
 */

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.error?.message ? `${body.error.message}` : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export interface ModelOption {
  id: string;
  label: string;
}

export const MODELS: ModelOption[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — most capable" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fast / cheap" },
];
