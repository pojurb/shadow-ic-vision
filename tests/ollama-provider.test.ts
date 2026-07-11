import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { OllamaProvider } from '@/lib/ai/adapters/ollama';
import type { ProviderCallContext } from '@/lib/ai/provider';

const context: ProviderCallContext = {
  route: 'tests.ollama-provider',
  dataClass: 'synthetic_fixture',
  runtime: { deployment: 'local' },
};

describe('OllamaProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes correct metadata and capabilities', () => {
    const provider = new OllamaProvider();
    expect(provider.getMetadata().provider).toBe('ollama-cloud');
    expect(provider.getCapabilities().vision).toBe(true);
  });

  it('uses an explicit model id when provided', () => {
    const provider = new OllamaProvider({ modelId: 'qwen3.5:cloud' });
    expect(provider.getMetadata().modelId).toBe('qwen3.5:cloud');
  });

  it('sends correct headers and body to Ollama API for chat', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-ollama-'));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: { role: 'assistant', content: 'Mock response text' }
      })
    });

    const provider = new OllamaProvider({
      fetchImpl: mockFetch,
      logPath: path.join(directory, 'outbound.log'),
      now: () => 1_000,
    });
    const result = await provider.chat([{ role: 'user', content: 'test message' }], context);

    expect(result.text).toBe('Mock response text');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"model":'),
      })
    );
    const logLine = fs.readFileSync(path.join(directory, 'outbound.log'), 'utf8').trim();
    expect(JSON.parse(logLine)).toMatchObject({
      provider: 'ollama-cloud',
      route: 'tests.ollama-provider',
      dataClass: 'synthetic_fixture',
      outcome: 'allowed',
    });
    expect(logLine).not.toContain('test message');
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
