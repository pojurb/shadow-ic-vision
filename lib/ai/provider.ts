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
  settings: Record<string, any>;
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
  /**
   * Returns the underlying Vercel AI SDK model instance for streaming UI use cases
   * where `streamText` or `useChat` is required by Next.js components.
   */
  getModel(): any;

  /**
   * Get the standard metadata for this provider configuration.
   */
  getMetadata(): ProviderMetadata;

  /**
   * Simple blocking chat for background tasks.
   */
  chat(messages: ProjectMessage[]): Promise<ChatResult>;

  /**
   * Extract structured data conforming to a Zod schema.
   */
  structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string
  ): Promise<StructuredExtractResult<T>>;
}
