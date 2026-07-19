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
    const jsonSchema = zodToJsonSchema(schema);

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
      const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
      const parsedData = JSON.parse(cleaned);
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
        cleaned,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
function zodToJsonSchema(schema: any): any {
  const typeName = schema?._def?.typeName;
  if (!typeName) return { type: 'string' };

  switch (typeName) {
    case 'ZodObject': {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      const shape = schema.shape;
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        const innerType = (value as any)?._def?.typeName;
        if (innerType !== 'ZodOptional' && innerType !== 'ZodNullable') {
          required.push(key);
        }
      }
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    case 'ZodArray': {
      return {
        type: 'array',
        items: zodToJsonSchema(schema.element),
      };
    }
    case 'ZodEnum': {
      return {
        type: 'string',
        enum: schema.options,
      };
    }
    case 'ZodString': {
      return { type: 'string' };
    }
    case 'ZodNumber': {
      return { type: 'integer' };
    }
    case 'ZodBoolean': {
      return { type: 'boolean' };
    }
    case 'ZodEffects': {
      return zodToJsonSchema(schema.innerType());
    }
    case 'ZodOptional':
    case 'ZodNullable': {
      return zodToJsonSchema(schema.unwrap());
    }
    case 'ZodDefault': {
      return zodToJsonSchema(schema._def.innerType);
    }
    default: {
      return { type: 'string' };
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
