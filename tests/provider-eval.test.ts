import { describe, expect, it } from 'vitest';
import {
  evaluateM001ProviderRun,
  parseProviderEvalArgs,
} from '@/scripts/eval-m001-provider';

describe('M001 provider eval harness', () => {
  it('parses explicit model and live mode arguments', () => {
    expect(parseProviderEvalArgs([
      '--mode', 'live',
      '--model', 'kimi-k2.7-code:cloud',
      '--output', 'test-results/provider.json',
      '--confidential-cases', 'docs/evals/M001/confidential-companion.local.json',
      '--transcript-dir', 'test-results/transcripts',
    ])).toMatchObject({
      mode: 'live',
      modelId: 'kimi-k2.7-code:cloud',
      outputPath: 'test-results/provider.json',
      confidentialCasesPath: 'docs/evals/M001/confidential-companion.local.json',
      transcriptDirectory: 'test-results/transcripts',
    });
    expect(() => parseProviderEvalArgs(['--model', 'deepseek-v3.1:671b-cloud'])).toThrow(/Unsupported Ollama model id/);
  });

  it('keeps deterministic mode separate from live eligibility', async () => {
    const report = await evaluateM001ProviderRun(process.cwd(), {
      mode: 'deterministic',
      modelId: 'qwen3.5:cloud',
      outputPath: 'test-results/provider-deterministic.json',
      confidentialCasesPath: null,
      transcriptDirectory: null,
    });
    expect(report.runMode).toBe('deterministic');
    expect(report.modelMetadata.modelId).toBe('qwen3.5:cloud');
    expect(report.modelEligibility).toBe('not_evaluated');
    expect(report.acceptanceOutcome).toBe('deterministic_only');
  });

  it('marks Kimi ready when supported live cases pass with a confidential companion suite', async () => {
    const report = await evaluateM001ProviderRun(process.cwd(), {
      mode: 'live',
      modelId: 'kimi-k2.7-code:cloud',
      outputPath: 'test-results/provider-live.json',
      confidentialCasesPath: 'docs/evals/M001/confidential-companion.local.json',
      transcriptDirectory: 'test-results/provider-live-transcripts',
    }, {
      provider: {
        getMetadata: () => ({
          provider: 'ollama-cloud',
          modelId: 'kimi-k2.7-code:cloud',
          promptVersion: '1.0.0',
          settings: { apiUrl: 'https://ollama.com/api' },
        }),
        getCapabilities: () => ({ vision: true, contextLimit: 128_000 }),
        async chat(messages) {
          const task = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;
          if (task.task === 'extract_assumptions_and_response_type') {
            return {
              text: JSON.stringify({
                assumptions: [{ statement: 'Palantir government defense contracts remain sticky.', status: 'untested' }],
                nextResponseType: 'clarification_and_acknowledgement',
                requiresChallenge: false,
                userResponse: 'Acknowledged.',
              }),
              metadata: this.getMetadata(),
            };
          }
          if (task.task === 'extract_citation') {
            return {
              text: JSON.stringify({
                exactQuote: 'gross margin of 81.3%',
                impactSummary: 'Exact quote retained.',
              }),
              metadata: this.getMetadata(),
            };
          }
          return {
            text: JSON.stringify({
              outcome: 'rejected',
              reason: 'Search snippets are not direct evidence.',
            }),
            metadata: this.getMetadata(),
          };
        },
      },
      baseSuite: {
        metadata: {
          pass_thresholds: {
            citation_hallucination_rate: 0,
            assumption_extraction_completeness: 0.9,
            cta_relevance: 0.8,
          },
        },
        test_cases: [
          {
            id: 'TC-X1',
            input: {
              user_message: 'Palantir is sticky with government contracts.',
            },
            expected: {
              assumptions: [{ statement: 'Palantir government defense contracts remain sticky.' }],
              requires_challenge: false,
              next_response_type: 'clarification_and_acknowledgement',
            },
          },
          {
            id: 'TC-X2',
            input: {
              ticker: 'PLTR',
              source_document_mock: 'Palantir reported gross margin of 81.3% in Q1 2026.',
            },
            expected: {
              evidence: {
                exact_quote: 'gross margin of 81.3%',
              },
            },
          },
        ],
      },
      multimodalSuite: { test_cases: [] },
      confidentialSuite: {
        test_cases: [
          {
            id: 'CONF-001',
            input: {
              user_message: 'Confidential thesis text',
            },
            expected: {
              assumptions: [{ statement: 'Palantir government defense contracts remain sticky.' }],
              requires_challenge: false,
              next_response_type: 'clarification_and_acknowledgement',
            },
          },
        ],
      },
    });

    expect(report.acceptanceOutcome).toBe('ready_for_acceptance');
    expect(report.modelEligibility).toBe('accepted_for_poc');
    expect(report.summary.failedCases).toBe(0);
    expect(report.summary.unsupportedCases).toBe(0);
  });
});
