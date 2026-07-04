/**
 * LLMProvider Interface
 *
 * This enforces the project-owned abstraction over the Vercel AI SDK,
 * satisfying ADR-0006. All product code must import this interface,
 * not the AI SDK directly.
 */

import { z } from 'zod';

export type ProjectMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export interface ProviderMetadata {
  provider: string;
  modelId: string;
  promptVersion: string;
  settings: Record<string, unknown>;
}

export interface ProviderCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  vision: boolean;
  contextLimit: number;
  languages: string[];
}

export interface StructuredExtractResult<T> {
  data: T | null;
  success: boolean;
  metadata: ProviderMetadata;
  error?: string;
}

export interface ChatResult {
  text: string;
  metadata: ProviderMetadata;
}

export interface LLMProvider {
  getMetadata(): ProviderMetadata;
  getCapabilities(): ProviderCapabilities;

  /**
   * Simple blocking chat for background tasks.
   */
  chat(messages: ProjectMessage[]): Promise<ChatResult>;

  streamCompletion(messages: ProjectMessage[]): AsyncIterable<string>;

  /**
   * Extract structured data conforming to a Zod schema.
   */
  structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string
  ): Promise<StructuredExtractResult<T>>;
}
