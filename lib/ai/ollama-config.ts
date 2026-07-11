import { isOllamaModelId, type OllamaModelId } from './ollama-models';

export const DEFAULT_OLLAMA_MODEL_ID: OllamaModelId = 'kimi-k2.7-code:cloud';

export function getConfiguredOllamaModelId(): OllamaModelId {
  const configured = process.env.OLLAMA_MODEL;
  if (isOllamaModelId(configured)) return configured;
  return DEFAULT_OLLAMA_MODEL_ID;
}
