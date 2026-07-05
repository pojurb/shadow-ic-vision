import { describe, expect, it, vi, afterEach } from 'vitest';
import { OllamaProvider } from '@/lib/ai/adapters/ollama';

describe('OllamaProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes correct metadata and capabilities', () => {
    const provider = new OllamaProvider();
    expect(provider.getMetadata().provider).toBe('ollama-cloud');
    expect(provider.getCapabilities().vision).toBe(true);
  });

  it('sends correct headers and body to Ollama API for chat', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'Mock response text' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = new OllamaProvider();
    const result = await provider.chat([{ role: 'user', content: 'test message' }]);

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
  });
});
