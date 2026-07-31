import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { extractJsonPayload, OllamaProvider, stripLeakedJsonFence } from '@/lib/ai/adapters/ollama';
import type { ProviderCallContext } from '@/lib/ai/provider';
import { chatResponsePayloadSchema } from '@/lib/domain/contracts';

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

    // Found during live testing (2026-07-30): this describe block's fixtures
    // only ever covered `thesis_draft`. The real live failure that triggered
    // the chat prompt-split fix (`app/api/chat/route.ts`) was an
    // `exploration_draft`-shaped payload ("i think it's a good time to
    // invest in Meta or Microsoft" — no single ticker named), which had
    // never been exercised through this exact prose-stripping path before.
    it('extracts and validates an exploration_draft payload wrapped in conversational prose', async () => {
      const proseWrapped = 'Meta and Microsoft both look interesting depending on what you want exposure to. Here\'s a short list to consider:\n\n```json\n{"type":"exploration_draft","explorationDraft":{"sectorName":"Big Tech AI Infrastructure","candidates":[{"ticker":"META","companyName":"Meta Platforms, Inc.","market":"US","rationale":"Heavy AI capex and ad-business cash flow."},{"ticker":"MSFT","companyName":"Microsoft Corporation","market":"US","rationale":"Azure AI infrastructure leadership."},{"ticker":"GOOGL","companyName":"Alphabet Inc.","market":"US","rationale":"Custom TPU silicon and DeepMind research depth."}]}}\n```\n\nWant me to dig into any of these?';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { role: 'assistant', content: proseWrapped } }),
      });
      const provider = new OllamaProvider({ fetchImpl: mockFetch });
      const result = await provider.structuredExtract(
        [{ role: 'user', content: 'i think it\'s a good time to invest in Meta or Microsoft' }],
        chatResponsePayloadSchema,
        'chat-payload-v1',
        context,
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        type: 'exploration_draft',
        explorationDraft: {
          sectorName: 'Big Tech AI Infrastructure',
          candidates: [
            expect.objectContaining({ ticker: 'META' }),
            expect.objectContaining({ ticker: 'MSFT' }),
            expect.objectContaining({ ticker: 'GOOGL' }),
          ],
        },
      });
    });
  });

  // Found during live testing (2026-07-30): the model wrapped a leaked
  // `exploration_draft` JSON fence into its free-text `chat()` reply, which
  // `ChatUI.tsx` then rendered raw. Splitting the system prompts (see
  // `app/api/chat/route.ts`) removes the JSON shape from what `chat()`'s
  // completion is shown at all; this is the second, defensive layer, applied
  // inside the adapter so it protects every caller/model uniformly.
  describe('stripLeakedJsonFence', () => {
    it('strips a leaked fence while leaving surrounding multi-paragraph prose intact', () => {
      const input = 'Here\'s my take on Meta and Microsoft.\n\nBoth show strong fundamentals.\n\n```json\n{"type":"exploration_draft","explorationDraft":{"sectorName":"Big Tech"}}\n```\n\nWant me to dig into either?';
      expect(stripLeakedJsonFence(input)).toBe(
        'Here\'s my take on Meta and Microsoft.\n\nBoth show strong fundamentals.\n\nWant me to dig into either?',
      );
    });

    it('returns ordinary prose with no fences completely unchanged, including its newlines', () => {
      const input = 'I think that\'s a reasonable thesis.\n\nWhat makes you confident the margin holds?';
      expect(stripLeakedJsonFence(input)).toBe(input);
    });

    it('leaves prose that merely mentions "json" with no fence untouched', () => {
      const input = 'I can export this as json if you\'d like.';
      expect(stripLeakedJsonFence(input)).toBe(input);
    });

    it('leaves a fenced block alone when its content is not JSON-shaped', () => {
      const input = 'Here is a note:\n\n```\nnot json at all, just a code note\n```\n\nEnd.';
      expect(stripLeakedJsonFence(input)).toBe(input);
    });

    // Found live 2026-07-30 with `kimi-k2.7-code:cloud`: a code-tuned model
    // returned a pretty-printed thesis_draft with NO fence and NO prose at
    // all, which the fence-only version of this function did not touch. The
    // fixture below is the real stored shape from that message.
    it('reduces a whole-response bare JSON object (no fence, no prose) to empty', () => {
      const bareJson = '{\n  "type": "thesis_draft",\n  "thesisDraft": {\n    "ticker": "TSLA",\n    "companyName": "Tesla, Inc.",\n    "market": "US"\n  }\n}';
      expect(stripLeakedJsonFence(bareJson)).toBe('');
    });

    it('leaves prose that merely starts with a brace but is not valid JSON alone', () => {
      const input = '{not json} — just an odd way to start a sentence.';
      expect(stripLeakedJsonFence(input)).toBe(input);
    });

    it('chat() returns text with no leaked fence or JSON, given a prose+JSON blend from the model', async () => {
      const blended = 'I understand you\'re considering Meta or Microsoft. Here\'s a structured record:\n\n```json\n{"type":"exploration_draft","explorationDraft":{"sectorName":"Big Tech"}}\n```';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: { role: 'assistant', content: blended } }),
      });
      const provider = new OllamaProvider({ fetchImpl: mockFetch });
      const result = await provider.chat([{ role: 'user', content: 'i think it\'s a good time to invest in Meta or Microsoft' }], context);

      expect(result.text).not.toContain('```');
      expect(result.text).not.toContain('"type":');
      expect(result.text).toContain('Meta or Microsoft');
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
