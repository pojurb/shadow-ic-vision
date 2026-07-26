import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { extractJsonPayload, OllamaProvider } from '@/lib/ai/adapters/ollama';
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

  it('serializes image attachments as a base64 images array per message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: { role: 'assistant', content: 'Transcribed text' },
      }),
    });

    const provider = new OllamaProvider({ fetchImpl: mockFetch });
    await provider.chat(
      [{
        role: 'user',
        content: 'Transcribe the visible text in this image.',
        attachments: [{ type: 'image', mimeType: 'image/png', base64: 'ZmFrZS1iYXNlNjQ=' }],
      }],
      context,
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].images).toEqual(['ZmFrZS1iYXNlNjQ=']);
    expect(body.messages[0].content).toBe('Transcribe the visible text in this image.');
  });

  it('omits images when a message has no attachments', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: { role: 'assistant', content: 'ok' } }),
    });

    const provider = new OllamaProvider({ fetchImpl: mockFetch });
    await provider.chat([{ role: 'user', content: 'plain text' }], context);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).not.toHaveProperty('images');
  });

  // Regression coverage for two bugs found during live testing (2026-07-26),
  // both in `structuredExtract`: (1) the JSON schema sent to Ollama's
  // `format` field had silently degraded to `{ type: 'string' }` for every
  // schema, because the hand-rolled converter checked Zod 3's
  // `_def.typeName`, which doesn't exist in this project's Zod 4; (2) even
  // with a correct schema, the model still routinely wraps its JSON answer
  // in conversational prose, which the old parser (only stripped a
  // *leading* fence) couldn't handle.
  describe('structuredExtract (regression: 2026-07-26 schema + prose-wrapping bugs)', () => {
    const schema = z.object({
      type: z.enum(['thesis_draft', 'none']),
      thesisDraft: z.object({ ticker: z.string(), assumptions: z.array(z.string()).optional() }).optional(),
    });

    it('sends a real JSON schema to Ollama, not the Zod-3-only fallback', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { role: 'assistant', content: '{"type":"none"}' } }),
      });
      const provider = new OllamaProvider({ fetchImpl: mockFetch });
      await provider.structuredExtract([{ role: 'user', content: 'hi' }], schema, 'test-schema', context);

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body as string);
      // The bug's exact symptom: this used to be `{ type: 'string' }` for
      // every schema, regardless of shape.
      expect(body.format).not.toEqual({ type: 'string' });
      expect(body.format).toMatchObject({
        type: 'object',
        properties: expect.objectContaining({
          type: expect.objectContaining({ enum: ['thesis_draft', 'none'] }),
        }),
      });
    });

    it('extracts and validates JSON even when the model wraps it in conversational prose', async () => {
      const proseWrapped = 'That’s a clear thesis. Here’s the draft:\n\n```json\n{"type":"thesis_draft","thesisDraft":{"ticker":"TLKM","assumptions":["demand holds"]}}\n```\n\nWant me to dig into any of these?';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { role: 'assistant', content: proseWrapped } }),
      });
      const provider = new OllamaProvider({ fetchImpl: mockFetch });
      const result = await provider.structuredExtract([{ role: 'user', content: 'TLKM thesis' }], schema, 'test-schema', context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ type: 'thesis_draft', thesisDraft: { ticker: 'TLKM', assumptions: ['demand holds'] } });
    });

    it('reports failure, not a thrown error, when no JSON exists anywhere in the response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { role: 'assistant', content: 'Sure, happy to help with that! No JSON here at all.' } }),
      });
      const provider = new OllamaProvider({ fetchImpl: mockFetch });
      const result = await provider.structuredExtract([{ role: 'user', content: 'hi' }], schema, 'test-schema', context);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  describe('extractJsonPayload', () => {
    it('parses pure JSON unchanged', () => {
      expect(extractJsonPayload('{"a":1}')).toEqual({ a: 1 });
    });

    it('strips a leading/trailing fence (the pre-existing supported shape)', () => {
      expect(extractJsonPayload('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('finds a fenced JSON block after leading prose', () => {
      expect(extractJsonPayload('Sure thing! Here you go:\n```json\n{"a":1}\n```\nLet me know if you need more.')).toEqual({ a: 1 });
    });

    it('falls back to the outermost brace span when there is no fence at all', () => {
      expect(extractJsonPayload('The answer is {"a":1} — hope that helps!')).toEqual({ a: 1 });
    });

    it('throws when nothing parseable exists', () => {
      expect(() => extractJsonPayload('No JSON anywhere in this sentence.')).toThrow();
    });
  });
});
