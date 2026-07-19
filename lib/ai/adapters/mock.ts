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

type MockMode = 'normal' | 'malformed';

const TRADE_REFUSAL =
  'I cannot recommend or execute trades. I can help structure and research your thesis assumptions.';
const UNSUPPORTED =
  "The local mock currently supports PLTR gross-margin and BBRI net-interest-margin thesis fixtures. Try: “I believe PLTR gross margin will remain above 80%.”";
const MOCK_VISION_RECOGNIZED_TEXT =
  'Mock deterministic vision transcription placeholder text for fixture-driven tests.';

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

  async chat(messages: ProjectMessage[], context: ProviderCallContext): Promise<ChatResult> {
    void context;
    const lastMessage = messages.at(-1);
    if (lastMessage?.attachments?.length) {
      return {
        text: MOCK_VISION_RECOGNIZED_TEXT,
        metadata: this.getMetadata(),
      };
    }
    return {
      text: this.responseText(lastMessage?.content ?? ''),
      metadata: this.getMetadata(),
    };
  }

  async *streamCompletion(messages: ProjectMessage[], context: ProviderCallContext): AsyncIterable<string> {
    const result = await this.chat(messages, context);
    yield result.text;
  }

  async structuredExtract<T>(
    messages: ProjectMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
    context: ProviderCallContext,
  ): Promise<StructuredExtractResult<T>> {
    void context;
    if (schemaName === 'decision-recommendation-v1') {
      const candidate = this.mode === 'malformed'
        ? { recommendedOutcome: 'Invalid' }
        : {
            recommendedOutcome: 'Investigate Further',
            recommendedAction: 'Buy',
            rationale: 'Palantir gross margin remains strong at 81.3%, but further validation is needed for Indonesian banks.',
          };
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
        error: 'Mock provider returned data that failed schema validation.',
        metadata: this.getMetadata(),
      };
    }

    const input = messages.at(-1)?.content ?? '';
    let candidate = this.mode === 'malformed' ? { ticker: 42 } : this.fixtureFor(input);

    if (candidate && schemaName === 'chat-payload-v1' && typeof candidate === 'object' && !('type' in candidate)) {
      candidate = {
        type: 'thesis_draft',
        thesisDraft: candidate,
      };
    }

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

    if (normalized.includes('explore') || normalized.includes('sector') || normalized.includes('shortlist') || normalized.includes('defense')) {
      return {
        type: 'exploration_draft',
        explorationDraft: {
          sectorName: 'Defense Tech US',
          candidates: [
            {
              ticker: 'PLTR',
              companyName: 'Palantir Technologies Inc.',
              market: 'US',
              rationale: 'Leader in defense AI software and data integration systems.',
            },
            {
              ticker: 'LMT',
              companyName: 'Lockheed Martin Corporation',
              market: 'US',
              rationale: 'Major defense contractor with growing software and missile guidance focus.',
            },
          ],
        },
      };
    }

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
    if (normalized.includes('explore') || normalized.includes('sector') || normalized.includes('shortlist') || normalized.includes('defense')) {
      return 'I found some candidate companies in the Defense Tech US sector. Check the shortlist below to track any of them.';
    }
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
