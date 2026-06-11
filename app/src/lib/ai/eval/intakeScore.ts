import type { IntakeResult } from "@/lib/ai/schemas";
import type { IntakeWebEvidence } from "@/lib/ai/intakeContext";
import {
  buildIntakeSearchQueries,
  extractIntakeAssetHint,
} from "@/lib/ai/intakeContext";
import type { IntakeEvalCase } from "./intakeCases";

export type IntakeEvalSeverity = "critical" | "measure";

export interface IntakeEvalCheck {
  id: string;
  label: string;
  pass: boolean;
  severity: IntakeEvalSeverity;
  detail?: string;
}

export interface IntakeEvalScore {
  caseId: string;
  pass: boolean;
  criticalPass: boolean;
  scorePct: number;
  checks: IntakeEvalCheck[];
}

function check(
  checks: IntakeEvalCheck[],
  id: string,
  label: string,
  pass: boolean,
  severity: IntakeEvalSeverity = "critical",
  detail?: string,
): void {
  checks.push({ id, label, pass, severity, ...(detail ? { detail } : {}) });
}

function score(caseId: string, checks: IntakeEvalCheck[]): IntakeEvalScore {
  const passed = checks.filter((c) => c.pass).length;
  const critical = checks.filter((c) => c.severity === "critical");
  return {
    caseId,
    pass: checks.every((c) => c.pass),
    criticalPass: critical.every((c) => c.pass),
    scorePct: checks.length ? Math.round((passed / checks.length) * 100) : 100,
    checks,
  };
}

function containsAll(values: string[], expected: string[]): boolean {
  return expected.every((needle) => values.some((value) => value.includes(needle)));
}

function evidenceText(evidence: IntakeWebEvidence): string {
  return [
    ...evidence.marketData.map((r) => `${r.url}\n${r.content}`),
    ...evidence.fetchedLinks.map((r) => `${r.url}\n${r.content}`),
    ...evidence.searchResults.map((r) => `${r.title}\n${r.url}\n${r.content}`),
    ...evidence.searchedPages.map((r) => `${r.url}\n${r.content}`),
  ]
    .join("\n")
    .toLowerCase();
}

function searchResultRelevant(testCase: IntakeEvalCase, evidence: IntakeWebEvidence): boolean {
  const ticker = testCase.expected.ticker?.toLowerCase();
  if (!ticker || !testCase.expected.requireRelevantSearchResults) return true;
  return evidence.searchResults.every((result) =>
    `${result.title} ${result.url} ${result.content}`.toLowerCase().includes(ticker),
  );
}

function fieldMap(result: IntakeResult): Map<string, number> {
  return new Map(result.fields.map((f) => [f.key, f.value] as const));
}

function approxEqual(actual: number | undefined, expected: number, tolerance = 0.000001): boolean {
  return actual != null && Math.abs(actual - expected) <= tolerance;
}

function visibleEvidenceUrls(evidence: IntakeWebEvidence): Set<string> {
  return new Set(
    [
      ...evidence.marketData.map((r) => r.url),
      ...evidence.fetchedLinks.map((r) => r.url),
      ...evidence.searchResults.map((r) => r.url),
      ...evidence.searchedPages.map((r) => r.url),
    ].filter(Boolean),
  );
}

function candidateText(result: IntakeResult): string {
  return result.thesis.evidenceCandidates
    .map((c) => `${c.title}\n${c.url ?? ""}\n${c.note ?? ""}`)
    .join("\n");
}

export function scoreIntakeResearch(testCase: IntakeEvalCase, evidence: IntakeWebEvidence): IntakeEvalScore {
  const checks: IntakeEvalCheck[] = [];
  const hint = extractIntakeAssetHint(testCase.conversationText);
  const queries = buildIntakeSearchQueries(testCase.conversationText);

  check(
    checks,
    "ticker",
    "detects the expected ticker",
    !testCase.expected.ticker || hint.ticker === testCase.expected.ticker,
    "critical",
    `expected ${testCase.expected.ticker ?? "(none)"}, got ${hint.ticker ?? "(none)"}`,
  );
  check(
    checks,
    "queries",
    "builds the required search queries",
    containsAll(queries, testCase.expected.queryIncludes),
    "critical",
    `queries: ${queries.join(" | ")}`,
  );
  check(
    checks,
    "search-count",
    "keeps enough relevant search results",
    evidence.searchResults.length >= (testCase.expected.minSearchResults ?? 0),
    "measure",
    `got ${evidence.searchResults.length}`,
  );
  check(
    checks,
    "page-count",
    "fetches enough search-result pages",
    evidence.searchedPages.length >= (testCase.expected.minFetchedSearchPages ?? 0),
    "measure",
    `got ${evidence.searchedPages.length}`,
  );
  check(
    checks,
    "search-relevance",
    "filters search-result pollution",
    searchResultRelevant(testCase, evidence),
    "critical",
  );
  check(
    checks,
    "research-errors",
    "research fixture has no fetch/search errors",
    evidence.errors.length === 0,
    "measure",
    evidence.errors.join("; "),
  );

  return score(testCase.id, checks);
}

export function scoreIntakeResult(
  testCase: IntakeEvalCase,
  result: IntakeResult,
  evidence?: IntakeWebEvidence,
): IntakeEvalScore {
  const checks: IntakeEvalCheck[] = [];
  const fields = fieldMap(result);
  const visibleText = evidence ? evidenceText(evidence) : "";
  const visibleUrls = evidence ? visibleEvidenceUrls(evidence) : new Set<string>();

  check(checks, "vertical", "returns the expected vertical", result.vertical === testCase.expected.vertical);
  check(checks, "mode", "returns the expected intake mode", result.mode === testCase.expected.mode);

  for (const key of testCase.expected.requiredFields) {
    check(checks, `field:${key}`, `extracts required field ${key}`, fields.has(key));
  }

  for (const key of testCase.expected.forbiddenFields) {
    check(checks, `no-field:${key}`, `does not invent forbidden field ${key}`, !fields.has(key));
  }

  for (const [key, expected] of Object.entries(testCase.expected.expectedValues ?? {})) {
    check(
      checks,
      `value:${key}`,
      `matches expected value for ${key}`,
      approxEqual(fields.get(key), expected.value, expected.tolerance),
      "critical",
      `expected ${expected.value}, got ${fields.get(key) ?? "(missing)"}`,
    );
  }

  if (evidence) {
    for (const key of testCase.expected.requiredFields) {
      const value = fields.get(key);
      if (value == null) continue;
      check(
        checks,
        `visible:${key}`,
        `field ${key} is supported by visible evidence`,
        visibleText.includes(String(value).toLowerCase()),
        "critical",
        `value ${value}`,
      );
    }
  }

  check(
    checks,
    "evidence-count",
    "returns enough evidence candidates",
    result.thesis.evidenceCandidates.length >= (testCase.expected.minEvidenceCandidates ?? 0),
    "measure",
    `got ${result.thesis.evidenceCandidates.length}`,
  );

  const candidates = candidateText(result);
  for (const pattern of testCase.expected.forbiddenEvidencePatterns ?? []) {
    check(
      checks,
      `no-evidence:${pattern.source}`,
      `does not emit forbidden evidence pattern /${pattern.source}/`,
      !pattern.test(candidates),
      "critical",
    );
  }

  for (const requiredUrl of testCase.expected.requiredEvidenceUrls ?? []) {
    check(
      checks,
      `evidence-url:${requiredUrl}`,
      `includes required evidence URL ${requiredUrl}`,
      result.thesis.evidenceCandidates.some((c) => c.url === requiredUrl),
      "measure",
    );
  }

  if (evidence) {
    const candidateUrls = result.thesis.evidenceCandidates.map((c) => c.url).filter((url): url is string => Boolean(url));
    check(
      checks,
      "evidence-visible",
      "evidence candidate URLs came from visible evidence",
      candidateUrls.every((url) => visibleUrls.has(url)),
      "critical",
      candidateUrls.filter((url) => !visibleUrls.has(url)).join(", "),
    );
  }

  return score(testCase.id, checks);
}

export function mergeIntakeScores(caseId: string, scores: IntakeEvalScore[]): IntakeEvalScore {
  return score(
    caseId,
    scores.flatMap((s) => s.checks),
  );
}

export function failedChecks(scorecard: IntakeEvalScore, criticalOnly = false): IntakeEvalCheck[] {
  return scorecard.checks.filter((check) => !check.pass && (!criticalOnly || check.severity === "critical"));
}
