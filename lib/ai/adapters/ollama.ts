import { z } from 'zod';
import {
  type ChatResult,
  type LLMProvider,
  type ProjectMessage,
  type ProviderCapabilities,
  type ProviderMetadata,
  type StructuredExtractResult,
} from '../provider';

export class OllamaProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.OLLAMA_API_KEY || '';
    this.apiUrl = process.env.OLLAMA_API_URL || 'https://ollama.com/api';
    this.model = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';
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

  async chat(messages: ProjectMessage[]): Promise<ChatResult> {
    const response = await fetch(`${this.apiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? `Ollama API returned HTTP ${response.status}`);
    }

    return {
      text: body.message?.content ?? '',
      metadata: this.getMetadata(),
    };
  }

  async *streamCompletion(messages: ProjectMessage[]): AsyncIterable<string> {
    const response = await fetch(`${this.apiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

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

  async structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<StructuredExtractResult<T>> {
    void schemaName;
    const jsonSchema = zodToJsonSchema(schema);

    try {
      const response = await fetch(`${this.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          format: jsonSchema,
          stream: false,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? `Ollama API returned HTTP ${response.status}`);
      }

      const content = body.message?.content ?? '';
      const parsedData = JSON.parse(content);
      const validated = schema.safeParse(parsedData);

      if (validated.success) {
        return {
          data: validated.data,
          success: true,
          metadata: this.getMetadata(),
        };
      }

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
