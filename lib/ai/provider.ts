/**
 * LLMProvider Interface
 *
 * This enforces the project-owned abstraction over the Vercel AI SDK,
 * satisfying ADR-0006. All product code must import this interface,
 * not the AI SDK directly.
 */

import { z } from 'zod';

export type ProjectMessageAttachment = {
  type: 'image';
  mimeType: string;
  /** Base64-encoded bytes, no data-URI prefix. */
  base64: string;
};

export type ProjectMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ProjectMessageAttachment[];
};

export type ProviderDataClass =
  | 'public_market_data'
  | 'synthetic_fixture'
  | 'poc_workflow_confidential'
  | 'portfolio_position_data'
  | 'restricted_personal_financial_secret'
  | 'production_confidential_processing';

export type ProviderCallRuntime = {
  requestUrl?: string;
  host?: string | null;
  deployment?: 'local' | 'poc' | 'production' | 'demo' | 'hosted';
};

export type ProviderCallContext = {
  route: string;
  dataClass: ProviderDataClass;
  runtime?: ProviderCallRuntime;
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
  chat(messages: ProjectMessage[], context: ProviderCallContext): Promise<ChatResult>;

  streamCompletion(messages: ProjectMessage[], context: ProviderCallContext): AsyncIterable<string>;

  /**
   * Extract structured data conforming to a Zod schema.
   */
  structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
    context: ProviderCallContext,
  ): Promise<StructuredExtractResult<T>>;
}
