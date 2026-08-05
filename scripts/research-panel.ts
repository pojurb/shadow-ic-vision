#!/usr/bin/env node
/**
 * Read and display the research panel for a given thesis.
 *
 * Usage: npm run research:panel -- --thesis-id <id>
 *        npm run research:panel -- --thesis-id <id> --json
 *        npm run research:panel -- --thesis-id <id> --full
 *
 * Default output is a human-readable summary. `--json` prints the raw
 * `ResearchPanelDTO` (the previous default) for piping into other tools.
 *
 * Why the default changed: the raw DTO for a real six-assumption thesis runs
 * to ~780 lines of JSON, which is not readable at a terminal — the surface
 * this whole CLI workflow exists to be driven from (`DEC-0017`).
 */

import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { getResearchPanel } from '../lib/research/service';
import type { EvidenceDTO, ResearchPanelDTO } from '../lib/domain/contracts';

type Options = { thesisId: string; json: boolean; full: boolean };

function parseArgs(args: string[]): Options {
  let thesisId: string | null = null;
  let json = false;
  let full = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--thesis-id') {
      thesisId = args[index + 1] ?? null;
      index += 1;
    } else if (args[index] === '--json') {
      json = true;
    } else if (args[index] === '--full') {
      full = true;
    }
  }
  if (!thesisId) throw new Error('Missing required argument: --thesis-id');
  return { thesisId, json, full };
}

// Colour only when attached to a terminal, so redirecting to a file or piping
// into another tool yields clean text rather than escape codes.
const tty = process.stdout.isTTY === true;
const paint = (code: string, text: string) => (tty ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = (text: string) => paint('1', text);
const dim = (text: string) => paint('2', text);
const red = (text: string) => paint('31', text);
const green = (text: string) => paint('32', text);
const yellow = (text: string) => paint('33', text);
const cyan = (text: string) => paint('36', text);

function truncate(text: string, limit: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit - 1)}…`;
}

function verdictColour(level: string): (text: string) => string {
  if (level === 'breached') return red;
  if (level === 'at_risk') return yellow;
  if (level === 'holding') return green;
  return dim;
}

function jobLabel(job: { status: string; errorCode: string | null }): string {
  if (job.status === 'succeeded') return green('succeeded');
  if (job.status === 'degraded') return yellow(`degraded: ${job.errorCode ?? 'unknown'}`);
  if (job.status === 'failed') return red(`failed: ${job.errorCode ?? 'unknown'}`);
  return dim(job.status);
}

/*
 * Polarity is the M011 answer to the audit finding that the system could
 * retrieve contradicting evidence and render it as neutral context. Marking it
 * in the left margin keeps direction readable at a glance rather than buried
 * in a field the reader has to look for.
 */
function polarityMark(polarity: EvidenceDTO['polarity']): string {
  if (polarity === 'contradicts') return red('✗');
  if (polarity === 'supports') return green('✓');
  return dim('~');
}

function renderEvidence(evidence: EvidenceDTO[], full: boolean): string[] {
  const lines: string[] = [];
  const shown = full ? evidence : evidence.slice(0, 3);
  for (const item of shown) {
    lines.push(`    ${polarityMark(item.polarity)} ${dim(item.verificationStatus)} ${item.sourceName}`);
    lines.push(`      ${dim('"')}${truncate(item.exactQuote, full ? 400 : 160)}${dim('"')}`);
    if (item.deltaVsThreshold !== null) {
      lines.push(`      ${dim(`delta vs threshold: ${item.deltaVsThreshold}`)}`);
    }
    lines.push(`      ${dim(item.sourceUrl)}`);
  }
  const hidden = evidence.length - shown.length;
  if (hidden > 0) lines.push(dim(`    … ${hidden} more evidence item${hidden === 1 ? '' : 's'} (--full to show)`));
  return lines;
}

function render(panel: ResearchPanelDTO, full: boolean): string {
  const lines: string[] = [];
  const { thesis, verdict, coverage } = panel;

  if (!thesis) return 'No thesis found for this conversation.';

  lines.push('');
  lines.push(`${bold(`${thesis.ticker} — ${thesis.companyName}`)} ${dim(`(${thesis.market})`)}`);
  lines.push(dim(`thesis ${thesis.id}`));
  lines.push('');

  if (verdict) {
    const colour = verdictColour(verdict.level);
    lines.push(`${bold('VERDICT')}  ${colour(bold(verdict.level.toUpperCase()))}`);
    lines.push(`  ${verdict.headline}`);
    for (const contradiction of verdict.contradictions) {
      lines.push(red(`  ✗ ${truncate(contradiction.statement, 90)}`));
      lines.push(`      observed ${bold(String(contradiction.observedValue))} vs threshold ${contradiction.operator} ${contradiction.threshold} ${contradiction.unit} ${dim(`(delta ${contradiction.deltaVsThreshold})`)}`);
      lines.push(dim(`      ${contradiction.sourceName} — ${contradiction.sourceUrl}`));
    }
    if (verdict.softContradictionCount > 0) {
      lines.push(yellow(`  ${verdict.softContradictionCount} soft contradiction(s) not counted as a hard breach`));
    }
    lines.push(dim(`  rule: ${verdict.rule}`));
    lines.push('');
  }

  if (coverage) {
    const percent = Math.round(coverage.coverageRatio * 100);
    const gate = coverage.confidenceGate === 'suppressed'
      ? yellow(`suppressed (${coverage.suppressionReasons.join(', ') || 'unspecified'})`)
      : green('open');
    lines.push(`${bold('COVERAGE')}  ${coverage.evidenced}/${coverage.totalAssumptions} assumptions evidenced ${dim(`(${percent}%)`)}  ·  confidence gate: ${gate}`);
    lines.push(dim(`  supported ${coverage.supported} · contradicted ${coverage.contradicted} · inconclusive-only ${coverage.inconclusiveOnly} · unevidenced ${coverage.unevidenced}`));
    if (coverage.unresolvedContracts > 0) {
      lines.push(yellow(`  ${coverage.unresolvedContracts} assumption(s) have an unresolved measurement contract — these cannot be checked for breach`));
    }
    for (const item of coverage.unevidencedAssumptions) {
      lines.push(dim(`  no evidence (${item.reason}): ${truncate(item.statement, 80)}`));
    }
    lines.push('');
  }

  lines.push(bold('ASSUMPTIONS'));
  panel.items.forEach((item, index) => {
    lines.push('');
    lines.push(`${bold(`${index + 1}.`)} [${jobLabel(item.job)}] ${truncate(item.statement, 150)}`);
    lines.push(dim(`   status: ${item.assumptionStatus} · ${item.evidence.length} evidence · attempt ${item.job.attemptCount} · ${item.job.sourceMode}`));
    if (item.job.error) lines.push(`   ${yellow(item.job.error)}`);
    lines.push(...renderEvidence(item.evidence, full));
  });

  if (panel.decisions.length > 0) {
    lines.push('');
    lines.push(bold('DECISIONS'));
    for (const decision of panel.decisions) {
      lines.push(`  ${dim(decision.timestamp)} ${bold(decision.outcome)}${decision.optionalAction ? ` (${decision.optionalAction})` : ''}`);
      lines.push(`    ${truncate(decision.userReasoning, 200)}`);
      if (decision.alternatives.length > 0) {
        lines.push(dim(`    alternatives considered: ${decision.alternatives.join('; ')}`));
      }
    }
  }

  if (panel.discoverySummary) {
    const candidates = panel.discoverySummary.candidates;
    const fetched = candidates.filter((c) => c.status === 'fetched').length;
    const rejected = candidates.filter((c) => c.status === 'rejected').length;
    lines.push('');
    lines.push(`${bold('DISCOVERY')}  ${candidates.length} candidate(s) · ${fetched} fetched · ${rejected} rejected by the domain gate`);
  }

  /*
   * Operational next steps only. Never an investment action: what to do about
   * a thesis is the user's call, not the system's (`AGENTS.md` rule 2).
   */
  const retryable = panel.items.filter((item) => item.job.status === 'degraded' || item.job.status === 'failed');
  if (retryable.length > 0) {
    lines.push('');
    lines.push(dim(`${retryable.length} job(s) did not complete. Retry with:`));
    lines.push(cyan(`  npm run research:retry -- --thesis-id ${thesis.id}`));
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const { thesisId, json, full } = parseArgs(process.argv.slice(2));
  const { db } = getDatabase();

  const thesis = await db.query.theses.findFirst({
    where: (theses, { eq }) => eq(theses.id, thesisId),
  });

  if (!thesis) {
    throw new Error(`No thesis found with ID: ${thesisId}`);
  }

  const conversationId = thesis.conversationId ?? '';
  const panel = await getResearchPanel(conversationId, { db });

  process.stdout.write(json ? `${JSON.stringify(panel, null, 2)}\n` : `${render(panel, full)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
