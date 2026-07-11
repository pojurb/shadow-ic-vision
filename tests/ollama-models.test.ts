import { describe, expect, it } from 'vitest';
import {
  getOllamaModelEvalOrder,
  OLLAMA_MODEL_EVAL_ORDER,
  OLLAMA_MODEL_IDS,
  OLLAMA_MODEL_OPTIONS,
  isOllamaModelId,
} from '@/lib/ai/ollama-models';

describe('Ollama model registry', () => {
  it('lists the approved allowlisted models', () => {
    expect(OLLAMA_MODEL_IDS).toEqual([
      'gemini-3-flash-preview',
      'kimi-k2.7-code:cloud',
      'qwen3.5:cloud',
      'deepseek-v4-pro:cloud',
      'deepseek-v4-flash:cloud',
      'minimax-m3:cloud',
    ]);
    expect(OLLAMA_MODEL_OPTIONS).toHaveLength(6);
    expect(OLLAMA_MODEL_OPTIONS.every((option) => option.contextLimit === 128_000 && option.vision)).toBe(true);
    expect(OLLAMA_MODEL_EVAL_ORDER[0]).toBe('kimi-k2.7-code:cloud');
  });

  it('rejects unknown model ids', () => {
    expect(isOllamaModelId('qwen3.5:cloud')).toBe(true);
    expect(isOllamaModelId('deepseek-v3.1:671b-cloud')).toBe(false);
  });

  it('exposes the fixed eval order', () => {
    expect(getOllamaModelEvalOrder()).toEqual([
      'kimi-k2.7-code:cloud',
      'gemini-3-flash-preview',
      'deepseek-v4-pro:cloud',
      'deepseek-v4-flash:cloud',
      'qwen3.5:cloud',
      'minimax-m3:cloud',
    ]);
  });
});
