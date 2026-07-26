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
      text: body.message?.content ?? '',
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

