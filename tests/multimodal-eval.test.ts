import { describe, expect, it } from 'vitest';
import { evaluateM001Multimodal } from '@/scripts/eval-m001-multimodal';

describe('M001 multimodal evaluator scaffold', () => {
  it('loads the base and addendum suites without approving a model', () => {
    const report = evaluateM001Multimodal(process.cwd(), '2026-07-07T00:00:00.000Z');
    expect(report).toMatchObject({
      suite: 'M001-multimodal-first-slice',
      baseCaseCount: 16,
      additionalCaseCount: 25,
      modelEligibility: 'not_evaluated',
      hardGateFailures: [],
    });
    expect(report.providerBoundary).toMatchObject({
      modelEligibility: 'not_evaluated',
      cases: expect.arrayContaining([
        expect.objectContaining({ id: 'PB-003', dataClass: 'poc_workflow_confidential', actual: 'allowed' }),
        expect.objectContaining({ id: 'PB-005', dataClass: 'restricted_personal_financial_secret', actual: 'blocked' }),
      ]),
    });
    expect(report.cases.find((item) => item.id === 'MM-002')).toMatchObject({ status: 'passed' });
    expect(report.cases.find((item) => item.id === 'MM-005')).toMatchObject({ status: 'passed' });
    expect(report.cases.find((item) => item.id === 'MM-012')?.notes).toContain('selected_page=237');
    // M007: these three cases are genuinely assertive (call
    // extractSecondaryCandidates for real), not merely descriptive — unlike
    // most of this suite, they could actually report 'unsupported' and add
    // a hardGateFailures entry if the R-010 structural gate regressed.
    expect(report.cases.find((item) => item.id === 'MM-021')).toMatchObject({
      status: 'passed',
      notes: expect.arrayContaining(['verification_status=secondary_issuer']),
    });
    expect(report.cases.find((item) => item.id === 'MM-022')).toMatchObject({
      status: 'passed',
      notes: expect.arrayContaining(['verification_status=secondary_news']),
    });
    expect(report.cases.find((item) => item.id === 'MM-023')).toMatchObject({
      status: 'passed',
      notes: expect.arrayContaining(['verification_status=secondary_issuer']),
    });
    // M011: two more genuinely assertive cases. MM-024 runs the real
    // `selectFact`/`factSatisfiesTimeBasis` and fails if a balance-sheet
    // instant is ever selected for a duration claim; MM-025 runs the real
    // polarity classifier and fails if a breached threshold is reported as
    // anything but a contradiction. Both were confirmed capable of failing by
    // tampering with their expectations and observing the hard gates fire.
    expect(report.cases.find((item) => item.id === 'MM-024')).toMatchObject({
      status: 'passed',
      notes: expect.arrayContaining(['context_kinds=instant', 'selected_fact=none']),
    });
    expect(report.cases.find((item) => item.id === 'MM-025')).toMatchObject({
      status: 'passed',
      notes: expect.arrayContaining(['verification_status=derived', 'polarity=contradicts']),
    });
    expect(report.cases.every((item) => item.status === 'passed')).toBe(true);
  });

  it('parameterizes provider-boundary metadata for the selected model', () => {
    const report = evaluateM001Multimodal(process.cwd(), '2026-07-07T00:00:00.000Z', {
      providerMetadata: {
        provider: 'ollama-cloud',
        modelId: 'kimi-k2.7-code:cloud',
        promptVersion: '1.0.0',
        settings: { apiUrl: 'https://ollama.com/api' },
      },
    });
    expect(report.providerBoundary.cases.every((item) => item.actual === item.expected)).toBe(true);
  });
});
