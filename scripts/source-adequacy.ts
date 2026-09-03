#!/usr/bin/env node
/**
 * Record a source-adequacy classification (A/B/C) for one assumption's
 * current measurement contract.
 *
 * Usage: npm run source-adequacy:record -- --assumption-id <id> --classification C --reasoning "..."
 *
 * M013 Q6. This is a human judgment (`AGENTS.md` rule 2/4) — the assistant
 * assembles evidence and reasoning, the user classifies. There is no
 * automatic path to this script; it exists because that classification used
 * to live only in the M013 packet's prose, unqueryable and unable to stop
 * `refreshOfficialSources` from re-running jobs that cannot succeed.
 *
 * Find assumption IDs with `npm run research:panel -- --thesis-id <id>`.
 */

import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { assumptions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { loadMeasurementContract } from '../lib/research/measurement';
import { recordSourceAdequacy, type SourceAdequacyClassification } from '../lib/research/source-adequacy';

function parseArgs(args: string[]): { assumptionId: string; classification: SourceAdequacyClassification; reasoning: string } {
  let assumptionId: string | null = null;
  let classification: string | null = null;
  let reasoning: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--assumption-id') {
      assumptionId = args[index + 1] ?? null;
      index += 1;
    } else if (args[index] === '--classification') {
      classification = args[index + 1] ?? null;
      index += 1;
    } else if (args[index] === '--reasoning') {
      reasoning = args[index + 1] ?? null;
      index += 1;
    }
  }
  if (!assumptionId) throw new Error('Missing required argument: --assumption-id');
  if (classification !== 'A' && classification !== 'B' && classification !== 'C') {
    throw new Error('--classification must be one of: A, B, C');
  }
  if (!reasoning) throw new Error('Missing required argument: --reasoning');
  return { assumptionId, classification, reasoning };
}

async function main() {
  const { assumptionId, classification, reasoning } = parseArgs(process.argv.slice(2));
  const { db } = getDatabase();

  const assumption = db.select().from(assumptions).where(eq(assumptions.id, assumptionId)).get();
  if (!assumption) throw new Error(`No assumption found with ID: ${assumptionId}`);

  const contract = loadMeasurementContract(db, assumptionId);
  if (!contract) throw new Error('This assumption has no measurement contract yet — nothing to classify against.');
  if (contract.resolution === 'ambiguous') {
    throw new Error('This assumption\'s contract is still ambiguous — resolve it before classifying source adequacy.');
  }

  const result = await recordSourceAdequacy({ db, assumptionId, classification, reasoning, contract });

  process.stdout.write(`Recorded: ${assumptionId} -> (${result.classification})\n`);
  process.stdout.write(`  statement: ${assumption.statement.replace(/\s+/g, ' ').trim().slice(0, 100)}\n`);
  process.stdout.write(`  reasoning: ${result.reasoning}\n`);
  if (classification === 'C') {
    process.stdout.write('\nThis assumption will no longer be requeued by the daily refresh.\n');
    process.stdout.write('Editing its measurement contract reopens it automatically; otherwise, `npm run research:retry` remains available.\n');
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
