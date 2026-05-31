/**
 * Provider registry — the single place the UI resolves an AIProvider from the
 * selected ProviderId. New providers are added here and nowhere else.
 */
import type { AIProvider, ProviderId } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { geminiProvider } from "./providers/gemini";

const PROVIDERS: Record<ProviderId, AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

/** Providers available to choose in Settings (in display order). */
export const PROVIDER_LIST: AIProvider[] = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): AIProvider {
  return PROVIDERS[id] ?? anthropicProvider;
}
