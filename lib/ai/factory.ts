import { MockProvider } from './adapters/mock';
import { OllamaProvider } from './adapters/ollama';
import type { LLMProvider } from './provider';

export function getLLMProvider(): LLMProvider {
  const type = process.env.LLM_PROVIDER_TYPE || 'mock';
  if (type === 'ollama') {
    return new OllamaProvider();
  }
  return new MockProvider();
}
