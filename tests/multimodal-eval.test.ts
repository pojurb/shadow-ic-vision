import { describe, expect, it } from 'vitest';
import { evaluateM001Multimodal } from '@/scripts/eval-m001-multimodal';

describe('M001 multimodal evaluator scaffold', () => {
  it('loads the base and addendum suites without approving a model', () => {
    const report = evaluateM001Multimodal(process.cwd(), '2026-07-07T00:00:00.000Z');
    expect(report).toMatchObject({
      suite: 'M001-multimodal-first-slice',
      baseCaseCount: 16,
      additionalCaseCount: 16,
      modelEligibility: 'not_evaluated',
      hardGateFailures: [],
    });
    expect(report.cases.find((item) => item.id === 'MM-002')).toMatchObject({ status: 'passed' });
    expect(report.cases.find((item) => item.id === 'MM-005')).toMatchObject({ status: 'passed' });
    expect(report.cases.find((item) => item.id === 'MM-012')?.notes).toContain('selected_page=237');
    expect(report.cases.every((item) => item.status === 'passed')).toBe(true);
  });
});
