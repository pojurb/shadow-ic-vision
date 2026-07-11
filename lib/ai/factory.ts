import { MockProvider } from './adapters/mock';
import { OllamaProvider } from './adapters/ollama';
import type { LLMProvider } from './provider';
import { getConfiguredOllamaModelId } from './ollama-config';
import { isOllamaModelId } from './ollama-models';

export function getLLMProvider(options: { modelId?: string | null } = {}): LLMProvider {
  const type = process.env.LLM_PROVIDER_TYPE || 'mock';
  if (type === 'ollama') {
    return new OllamaProvider({
      modelId: isOllamaModelId(options.modelId) ? options.modelId : getConfiguredOllamaModelId(),
    });
  }
  return new MockProvider();
}
