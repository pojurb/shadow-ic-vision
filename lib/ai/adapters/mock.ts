import { z } from 'zod';
import {
  type ChatResult,
  type LLMProvider,
  type ProjectMessage,
  type ProviderCapabilities,
  type ProviderMetadata,
  type StructuredExtractResult,
} from '../provider';

type MockMode = 'normal' | 'malformed';

const TRADE_REFUSAL =
  'I cannot recommend or execute trades. I can help structure and research your thesis assumptions.';
const UNSUPPORTED =
  "The local mock currently supports PLTR gross-margin and BBRI net-interest-margin thesis fixtures. Try: “I believe PLTR gross margin will remain above 80%.”";

export class MockProvider implements LLMProvider {
  constructor(private readonly mode: MockMode = 'normal') {}

  getMetadata(): ProviderMetadata {
    return {
      provider: 'mock',
      modelId: 'mock-deterministic-1',
      promptVersion: '1.0.0',
      settings: {},
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      structuredOutput: true,
      vision: false,
      contextLimit: 16_384,
      languages: ['en', 'id'],
    };
  }

  async chat(messages: ProjectMessage[]): Promise<ChatResult> {
    const lastMessage = messages.at(-1)?.content ?? '';
    return {
      text: this.responseText(lastMessage),
      metadata: this.getMetadata(),
    };
  }

  async *streamCompletion(messages: ProjectMessage[]): AsyncIterable<string> {
    const result = await this.chat(messages);
    yield result.text;
  }

  async structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<StructuredExtractResult<T>> {
    void schemaName;
    const input = messages.at(-1)?.content ?? '';
    const candidate = this.mode === 'malformed' ? { ticker: 42 } : this.fixtureFor(input);
    const parsed = schema.safeParse(candidate);

    if (parsed.success) {
      return {
        data: parsed.data,
        success: true,
        metadata: this.getMetadata(),
      };
    }

    return {
      data: null,
      success: false,
      error: candidate
        ? 'Mock provider returned data that failed schema validation.'
        : 'Unsupported local mock fixture.',
      metadata: this.getMetadata(),
    };
  }

  private fixtureFor(input: string): unknown | null {
    const normalized = input.toLowerCase();

    if (this.isUnsafeRequest(normalized)) return null;

    if (normalized.includes('pltr') && normalized.includes('gross margin')) {
      const mismatch = normalized.includes('simulate citation mismatch');
      return {
        ticker: 'PLTR',
        companyName: 'Palantir Technologies Inc.',
        market: 'US',
        coreBelief: input,
        assumptions: [
          {
            statement: mismatch
              ? 'PLTR gross margin remains above 90% (simulate citation mismatch).'
              : 'PLTR gross margin remains above 80%.',
            status: 'untested',
          },
        ],
        requiresChallenge: false,
      };
    }

    if (normalized.includes('bbri') && (normalized.includes('nim') || normalized.includes('net interest'))) {
      return {
        ticker: 'BBRI',
        companyName: 'PT Bank Rakyat Indonesia (Persero) Tbk',
        market: 'ID',
        coreBelief: input,
        assumptions: [
          {
            statement: 'BBRI net interest margin (NIM) remains above 6.0%.',
            status: 'untested',
          },
        ],
        requiresChallenge: false,
      };
    }

    return null;
  }

  private responseText(input: string) {
    const normalized = input.toLowerCase();
    if (this.isUnsafeRequest(normalized)) return TRADE_REFUSAL;
    if (this.fixtureFor(input)) {
      return 'I structured a draft thesis and its testable assumption. Review it before starting research.';
    }
    return UNSUPPORTED;
  }

  private isUnsafeRequest(input: string) {
    return /\b(buy|sell|hold|execute|shares|trading bot)\b/.test(input)
      || input.includes('ignore all previous instructions');
  }
}
