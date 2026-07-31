import { z } from 'zod';
import {
  type ChatResult,
  type LLMProvider,
  type ProjectMessage,
  type ProviderCallContext,
  type ProviderCapabilities,
  type ProviderMetadata,
  type StructuredExtractResult,
} from '../provider';
import { providerFetch } from '../provider-http';
import { type OllamaModelId } from '../ollama-models';

type OllamaProviderOptions = {
  fetchImpl?: typeof fetch;
  logPath?: string;
  now?: () => number;
  modelId?: OllamaModelId;
};

/**
 * Ollama's chat API accepts a base64 `images` array per message (no data-URI
 * prefix) for vision-capable models. Verified against local Ollama's REST API
 * convention; Ollama Cloud's request shape has not been independently
 * confirmed from vendor docs and should be validated against a real call
 * before trusting eligibility results.
 */
function toOllamaMessage(message: ProjectMessage): { role: string; content: string; images?: string[] } {
  const images = message.attachments
    ?.filter((attachment) => attachment.type === 'image')
    .map((attachment) => attachment.base64);
  return {
    role: message.role,
    content: message.content,
    ...(images && images.length > 0 ? { images } : {}),
  };
}

export class OllamaProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly logPath: string | undefined;
  private readonly now: (() => number) | undefined;

  constructor(options: OllamaProviderOptions = {}) {
    this.apiKey = process.env.OLLAMA_API_KEY || '';
    this.apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api';
    this.model = options.modelId || process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';
    this.fetchImpl = options.fetchImpl;
    this.logPath = options.logPath;
    this.now = options.now;
  }

  getMetadata(): ProviderMetadata {
    return {
      provider: 'ollama-cloud',
      modelId: this.model,
      promptVersion: '1.0.0',
      settings: {
        apiUrl: this.apiUrl,
      },
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      structuredOutput: true,
      vision: true,
      contextLimit: 128_000,
      languages: ['en', 'id'],
    };
  }

  async chat(messages: ProjectMessage[], context: ProviderCallContext): Promise<ChatResult> {
    const response = await this.fetchChat(messages, context, false);

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? `Ollama API returned HTTP ${response.status}`);
    }

    return {
      text: stripLeakedJsonFence(body.message?.content ?? ''),
      metadata: this.getMetadata(),
    };
  }

  async *streamCompletion(messages: ProjectMessage[], context: ProviderCallContext): AsyncIterable<string> {
    const response = await this.fetchChat(messages, context, true);

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Ollama API stream returned HTTP ${response.status}: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              yield json.message.content;
            }
          } catch {
            // Ignore partial lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private fetchChat(messages: ProjectMessage[], context: ProviderCallContext, stream: boolean) {
    return providerFetch({
      metadata: this.getMetadata(),
      context,
      endpoint: 'ollama.chat',
      url: `${this.apiUrl}/chat`,
      fetchImpl: this.fetchImpl,
      logPath: this.logPath,
      now: this.now,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(toOllamaMessage),
          stream,
        }),
      },
    });
  }

  async structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
    context: ProviderCallContext,
  ): Promise<StructuredExtractResult<T>> {
    void schemaName;
    // Bug found and fixed 2026-07-26: this used to call a hand-rolled
    // converter checking `_def.typeName`, which is Zod 3's internal shape.
    // This project runs Zod 4 (`_def.type` instead), so that check always
    // failed and every live structuredExtract call — across the whole app,
    // not just one route — sent Ollama the fallback `{ type: 'string' }`,
    // no real structural constraint at all. `z.toJSONSchema` is Zod 4's own
    // native replacement; no reason to hand-maintain a converter Zod ships
    // itself.
    const jsonSchema = z.toJSONSchema(schema);

    try {
      const response = await providerFetch({
        metadata: this.getMetadata(),
        context,
        endpoint: 'ollama.structuredExtract',
        url: `${this.apiUrl}/chat`,
        fetchImpl: this.fetchImpl,
        logPath: this.logPath,
        now: this.now,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages.map(toOllamaMessage),
            format: jsonSchema,
            stream: false,
          }),
        },
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `Ollama API returned HTTP ${response.status}`);
      }

      const content = (body.message?.content ?? '').trim();
      const parsedData = extractJsonPayload(content);
      const validated = schema.safeParse(parsedData);

      if (validated.success) {
        return {
          data: validated.data,
          success: true,
          metadata: this.getMetadata(),
        };
      }

      console.error('structuredExtract safeParse failed!', {
        model: this.model,
        content,
        parsedData,
        error: validated.error,
      });

      return {
        data: null,
        success: false,
        error: 'Ollama API returned JSON that does not match schema.',
        metadata: this.getMetadata(),
      };
    } catch (error) {
      return {
        data: null,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract structured data.',
        metadata: this.getMetadata(),
      };
    }
  }
}

/**
 * Found during live testing (2026-07-26): even once `format` carries a
 * correct JSON schema (see the `structuredExtract` fix above), this model
 * still routinely wraps the JSON in a conversational reply — "Here's the
 * draft: ```json\n{...}\n```\nA few things worth checking..." — rather than
 * returning pure JSON. `format` shapes the JSON *if* the model produces it
 * standalone; it does not force the whole response to be nothing else, at
 * least for this provider/model combination. The previous parser assumed
 * pure JSON (only stripped a *leading* fence) and threw on every prose-
 * wrapped response — exported so this can be tested directly against real
 * captured responses, not just inline in `structuredExtract`.
 */
export function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();

  const attempts: string[] = [
    trimmed,
    trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''),
  ];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());

  const firstBrace = trimmed.search(/[{[]/);
  const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  throw new Error('No parseable JSON object found in the model response.');
}

/**
 * Found during live testing (2026-07-30, same session as the `chat`/
 * `structuredExtract` prompt split in `app/api/chat/route.ts`). Splitting
 * the prompts removes the JSON shape from what the free-text `chat()` call
 * is shown, but stays a second, defensive layer — applied uniformly inside
 * the adapter so it protects every caller and every selectable model
 * (`lib/ai/ollama-models.ts`), not just this one route, and is the only
 * protection at all on any conversation turn after the first (`route.ts`
 * skips `structuredExtract` once a thesis already exists for the
 * conversation).
 *
 * Deliberately narrower than `extractJsonPayload` above: that function's
 * job is to find JSON *somewhere* in a response that is expected to
 * contain it, so it's right to fall back to a bare-brace scan. This
 * function's job is the opposite — leave ordinary prose completely alone —
 * so it never scans for bare braces mid-prose and never triggers on prose
 * that merely mentions the word "json". It handles exactly two shapes:
 *
 *  1. A FENCED block whose content looks like the leaked payload.
 *  2. A response that is ENTIRELY one JSON value and nothing else.
 *
 * Shape 2 was found the hard way (2026-07-30, live, `kimi-k2.7-code:cloud`):
 * a code-tuned model returned a pretty-printed `thesis_draft` object with no
 * fence and no prose whatsoever, which the fence-only version of this
 * function did not touch. Returning '' for that case is deliberate — the
 * model produced no conversational reply at all, so there is no prose to
 * preserve, and the draft it *did* produce reaches the UI through
 * `structuredPayload` (which validated fine in that same live case). The
 * caller renders the structured card instead; see `ChatUI.tsx`.
 */
export function stripLeakedJsonFence(text: string): string {
  const stripped = text
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, (match, inner: string) => (/^[[{]/.test(inner.trim()) ? '' : match))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (/^[[{]/.test(stripped)) {
    try {
      JSON.parse(stripped);
      return '';
    } catch {
      // Not actually a whole-response JSON value — keep it as prose.
    }
  }

  return stripped;
}

