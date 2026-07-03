import { z } from 'zod';
import { LLMProvider, ProviderMetadata, StructuredExtractResult, ChatResult, ProjectMessage } from '../provider';
// For the mock, we can just use a dummy implementation of LanguageModelV1 or a built-in mock if available.
// The Vercel AI SDK provides a standard mock model we could theoretically import, but building a simple wrapper suffices.

export class MockProvider implements LLMProvider {
  getMetadata(): ProviderMetadata {
    return {
      provider: 'mock',
      modelId: 'mock-deterministic-1',
      promptVersion: '1.0.0',
      settings: {},
    };
  }

  getModel(): any {
    // This is a minimal stub to satisfy type requirements if passed to `streamText`.
    // In actual implementation, we might use `@ai-sdk/provider-utils/test` or similar.
    return {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'mock-deterministic-1',
      defaultObjectGenerationMode: 'json',
      async doGenerate() {
        return {
          text: 'This is a deterministic mock response.',
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0 },
        };
      },
      async doStream() {
        throw new Error('Streaming not fully implemented in minimal mock');
      }
    };
  }

  async chat(messages: ProjectMessage[]): Promise<ChatResult> {
    return {
      text: 'This is a deterministic mock response.',
      metadata: this.getMetadata(),
    };
  }

  async structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string
  ): Promise<StructuredExtractResult<T>> {
    // Return a failed extraction by default in the mock to test failure boundaries,
    // or a dummy object if needed. For now, we simulate a failure to force 
    // the system to handle unverified candidates safely.
    return {
      data: null,
      success: false,
      error: 'Mock provider cannot generate valid structured data.',
      metadata: this.getMetadata(),
    };
  }
}
