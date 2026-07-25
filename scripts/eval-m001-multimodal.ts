import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractSecondaryCandidates } from '@/lib/research/extractors/candidate';
import { selectMostRelevantChunk } from '@/lib/research/extractors/chunking';
import { assessRecurringGrowthCaveat } from '@/lib/research/extractors/multilingual';
import { scanEmbeddedInstructions } from '@/lib/research/extractors/safety';
import { calculateChartGrowthCandidate, extractScreenshotOcrCandidate } from '@/lib/research/extractors/visual';
import { evaluateProviderGate } from '@/lib/ai/provider-gate';
import type { ProviderCallContext, ProviderMetadata } from '@/lib/ai/provider';

type MultimodalCase = {
  id: string;
  input?: {
    fixture_spec?: {
      visible_text?: string;
      pages?: Array<{ page: number; text?: string; rendered_text?: string }>;
      series?: Array<{ label: string; value: number }>;
      page?: number;
      bounding_box?: [number, number, number, number];
      bounding_boxes?: Record<string, [number, number, number, number]>;
      page_count?: number;
      generated_default_page_text?: string;
      overrides?: Array<{ page: number; text: string }>;
    };
    query?: string;
    // M007: inputs for the secondary-source assertive cases (MM-021/022/023).
    assumption?: string;
    ticker?: string;
    source_class?: 'issuer' | 'news';
  };
  expected?: {
    outcome?: string;
    verification_status?: 'exact_verified' | 'ocr_matched' | 'derived' | 'secondary_issuer' | 'secondary_news';
    reason_code?: string;
    durable_evidence_created?: boolean;
    source_format?: string;
    extraction_method?: string;
    content_kind?: string;
    page_number?: number;
    document_hash_required?: boolean;
    canonical_text_hash_required?: boolean;
    must_not_be_exact_verified?: boolean;
  };
};

type Suite = { test_cases?: MultimodalCase[] };

export type MultimodalEvalReport = {
  schemaVersion: 1;
  suite: 'M001-multimodal-first-slice';
  baseCaseCount: number;
  additionalCaseCount: number;
  completedAt: string;
  modelEligibility: 'not_evaluated';
  hardGateFailures: string[];
  providerBoundary: {
    modelEligibility: 'not_evaluated';
    cases: Array<{
      id: string;
      dataClass: ProviderCallContext['dataClass'];
      expected: 'allowed' | 'blocked';
      actual: 'allowed' | 'blocked';
      reasonCode: string;
    }>;
  };
  cases: Array<{
    id: string;
    status: 'passed' | 'unsupported';
    fixtureHash: string;
    notes: string[];
  }>;
};

export type MultimodalEvalOptions = {
  providerMetadata?: ProviderMetadata;
};

export function evaluateM001Multimodal(
  rootDirectory: string,
  completedAt = new Date().toISOString(),
  options: MultimodalEvalOptions = {},
): MultimodalEvalReport {
  const base = readJson<{ test_cases?: unknown[] }>(path.join(rootDirectory, 'docs', 'evals', 'M001', 'cases.json'));
  const additional = readJson<Suite>(path.join(rootDirectory, 'docs', 'evals', 'M001', 'multimodal-cases.json'));
  const cases = additional.test_cases ?? [];
  const providerBoundary = evaluateProviderBoundary(options.providerMetadata);
  const providerFailures = providerBoundary.cases
    .filter((item) => item.actual !== item.expected)
    .map((item) => `provider-boundary:${item.id}:${item.actual}`);

  const caseResults = cases.map((testCase) => evaluateCase(testCase));
  const caseHardGateFailures = caseResults.flatMap((result) => result.hardGateFailures);

  return {
    schemaVersion: 1,
    suite: 'M001-multimodal-first-slice',
    baseCaseCount: base.test_cases?.length ?? 0,
    additionalCaseCount: cases.length,
    completedAt,
    modelEligibility: 'not_evaluated',
    // M007: previously fed only by provider-boundary mismatches — every
    // other case in this suite was purely descriptive (`status: 'passed'`
    // was hardcoded, nothing could actually fail). MM-021/022/023 add real
    // assertions via caseHardGateFailures, so a genuine regression in the
    // secondary-source structural gate is no longer invisible to this report.
    hardGateFailures: [...providerFailures, ...caseHardGateFailures],
    providerBoundary,
    cases: caseResults.map((result) => result.case),
  };
}

export function createDefaultProviderMetadata(modelId = 'deepseek-v3.1:671b-cloud'): ProviderMetadata {
  return {
    provider: 'ollama-cloud',
    modelId,
    promptVersion: '1.0.0',
    settings: { apiUrl: 'https://ollama.com/api' },
  };
}

export function evaluateProviderBoundary(
  provider: ProviderMetadata = createDefaultProviderMetadata(),
): MultimodalEvalReport['providerBoundary'] {
  const inputs: Array<{
    id: string;
    dataClass: ProviderCallContext['dataClass'];
    expected: 'allowed' | 'blocked';
  }> = [
    { id: 'PB-001', dataClass: 'public_market_data', expected: 'allowed' },
    { id: 'PB-002', dataClass: 'synthetic_fixture', expected: 'allowed' },
    { id: 'PB-003', dataClass: 'poc_workflow_confidential', expected: 'allowed' },
    { id: 'PB-004', dataClass: 'portfolio_position_data', expected: 'blocked' },
    { id: 'PB-005', dataClass: 'restricted_personal_financial_secret', expected: 'blocked' },
    { id: 'PB-006', dataClass: 'production_confidential_processing', expected: 'blocked' },
  ];

  return {
    modelEligibility: 'not_evaluated',
    cases: inputs.map((input) => {
      const gate = evaluateProviderGate(provider, {
        route: 'eval.m001.providerBoundary',
        dataClass: input.dataClass,
        runtime: { deployment: 'local' },
      });
      return {
        ...input,
        actual: gate.allowed ? 'allowed' : 'blocked',
        reasonCode: gate.reasonCode,
      };
    }),
  };
}

function evaluateCase(testCase: MultimodalCase): {
  case: MultimodalEvalReport['cases'][number];
  hardGateFailures: string[];
} {
  const { notes, hardGateFailures } = deterministicNotes(testCase);
  return {
    case: {
      id: testCase.id,
      status: hardGateFailures.length > 0 ? 'unsupported' : 'passed',
      fixtureHash: crypto.createHash('sha256').update(JSON.stringify(testCase)).digest('hex'),
      notes,
    },
    hardGateFailures,
  };
}

function deterministicNotes(testCase: MultimodalCase): { notes: string[]; hardGateFailures: string[] } {
  const notes = ['Deterministic first-slice gate evaluated without provider calls.'];
  const hardGateFailures: string[] = [];
  if (testCase.expected?.verification_status) notes.push(`verification_status=${testCase.expected.verification_status}`);
  if (testCase.expected?.reason_code) notes.push(`degraded_reason=${testCase.expected.reason_code}`);
  if (testCase.expected?.must_not_be_exact_verified) notes.push('class_promotion_blocked=true');
  if (testCase.expected?.document_hash_required) notes.push('document_hash_required=true');
  if (testCase.expected?.canonical_text_hash_required) notes.push('canonical_text_hash_required=true');
  if (testCase.expected?.durable_evidence_created === false) notes.push('durable_evidence_created=false');
  if (testCase.id === 'MM-005') {
    const series = testCase.input?.fixture_spec?.series;
    if (series?.length === 2) {
      const candidate = calculateChartGrowthCandidate({
        series: [series[0], series[1]],
        pageNumber: testCase.input?.fixture_spec?.page ?? 1,
        boundingBox: testCase.input?.fixture_spec?.bounding_box,
      });
      notes.push(`chart_value=${candidate.quote}`);
      notes.push('calculation_inputs_retained=true');
    }
  }
  if (testCase.id === 'MM-006') {
    const text = testCase.input?.fixture_spec?.pages?.map((page) => page.text ?? '').join(' ') ?? '';
    const assessment = assessRecurringGrowthCaveat(text);
    notes.push(`language_handled=${assessment.languageHandled.join(',')}`);
    notes.push(`uncertainty_visible=${assessment.uncertaintyVisible}`);
    notes.push(`assumption_marked_verified=${assessment.assumptionMarkedVerified}`);
  }
  if (testCase.id === 'MM-007' || testCase.id === 'MM-008') {
    const text = testCase.input?.fixture_spec?.visible_text
      ?? testCase.input?.fixture_spec?.pages?.map((page) => page.text ?? '').join(' ')
      ?? '';
    const scan = scanEmbeddedInstructions(text);
    notes.push(`untrusted_instruction_flagged=${scan.untrustedInstructionFlagged}`);
    notes.push(`trade_advice_produced=${scan.tradeAdviceProduced}`);
  }
  if (testCase.id === 'MM-012') {
    const spec = testCase.input?.fixture_spec;
    const pageCount = spec?.page_count ?? 0;
    const override = spec?.overrides?.[0];
    const pages = Array.from({ length: pageCount }, (_, index) => {
      const pageNumber = index + 1;
      return {
        pageNumber,
        text: override?.page === pageNumber ? override.text : spec?.generated_default_page_text?.replace('{page}', String(pageNumber)) ?? '',
      };
    });
    const selected = selectMostRelevantChunk(pages, testCase.input?.query ?? '');
    notes.push(`selected_page=${selected?.pageNumber ?? 'none'}`);
    notes.push(`chunk_provenance_required=${Boolean(selected?.provenance)}`);
  }
  if (testCase.id === 'MM-015') {
    const visibleText = testCase.input?.fixture_spec?.visible_text ?? '';
    const candidate = extractScreenshotOcrCandidate({
      pages: [{
        pageNumber: testCase.input?.fixture_spec?.page ?? 1,
        text: visibleText,
        boundingBox: testCase.input?.fixture_spec?.bounding_boxes?.nim,
      }],
      candidateQuote: 'NIM: 6,8%',
      impactSummary: 'Screenshot OCR matched retained visible disclosure text.',
    });
    notes.push(`verification_status=${candidate.verificationStatus}`);
    notes.push(`bounding_box_required=${Boolean(candidate.boundingBox)}`);
  }
  // M007 (MM-021/022/023). Genuinely assertive, unlike most notes above:
  // calls extractSecondaryCandidates for real and checks the result against
  // `expected`, pushing into hardGateFailures on a mismatch — this is what
  // lets a regression in the R-010 structural gate actually fail the report.
  if (testCase.id === 'MM-021' || testCase.id === 'MM-022' || testCase.id === 'MM-023') {
    const spec = testCase.input?.fixture_spec;
    const pages = (spec?.pages ?? []).map((page) => ({ pageNumber: page.page ?? null, text: page.text ?? '' }));
    const document = {
      canonicalText: pages.map((page) => page.text).join(' '),
      pages,
      parserVersion: 'eval-fixture-1.0',
      extractionMethod: 'html_parser' as const,
      sourceVariant: 'text_layer' as const,
      untrustedInstructionFlagged: false,
    };
    const sourceClass = testCase.input?.source_class ?? 'issuer';
    const candidates = extractSecondaryCandidates(
      document,
      testCase.input?.assumption ?? '',
      testCase.input?.ticker ?? '',
      sourceClass,
    );
    const expectedStatus = testCase.expected?.verification_status;
    notes.push(`secondary_candidate_count=${candidates.length}`);
    if (candidates.length === 0) {
      hardGateFailures.push(`${testCase.id}:no_secondary_candidate_extracted`);
    }
    for (const candidate of candidates) {
      notes.push(`verification_status=${candidate.verificationStatus}`);
      if (candidate.verificationStatus === 'exact_verified' || candidate.verificationStatus === 'ocr_matched') {
        hardGateFailures.push(`${testCase.id}:verification_class_promotion:${candidate.verificationStatus}`);
      } else if (expectedStatus && candidate.verificationStatus !== expectedStatus) {
        hardGateFailures.push(`${testCase.id}:unexpected_verification_status:${candidate.verificationStatus}`);
      }
    }
  }
  return { notes, hardGateFailures };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function main() {
  const root = process.cwd();
  const outputArgIndex = process.argv.indexOf('--output');
  const output = outputArgIndex >= 0 && process.argv[outputArgIndex + 1]
    ? process.argv[outputArgIndex + 1]
    : path.join('docs', 'evidence', 'releases', `m001-multimodal-first-slice-${new Date().toISOString().replace(/[:.]/g, '-')}`, 'm001-multimodal-report.json');
  const report = evaluateM001Multimodal(root);
  const outputPath = path.resolve(root, output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`M001 multimodal first-slice report: ${path.relative(root, outputPath)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
