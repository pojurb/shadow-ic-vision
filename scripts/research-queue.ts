#!/usr/bin/env node
/**
 * Trigger research jobs for a given thesis.
 * Usage: npm run research:queue -- --thesis-id <id>
 * Output: JSON status to stdout
 */

import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { getSnapshotDirectory } from '../lib/research/config';
import { processResearchJobs } from '../lib/research/service';

function parseArgs(args: string[]): { thesisId: string } {
  let thesisId: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--thesis-id') {
      thesisId = args[index + 1] ?? null;
      index += 1;
    }
  }
  if (!thesisId) throw new Error('Missing required argument: --thesis-id');
  return { thesisId };
}

async function main() {
  const { thesisId } = parseArgs(process.argv.slice(2));
  const { db } = getDatabase();

  const thesis = await db.query.theses.findFirst({
    where: (theses, { eq }) => eq(theses.id, thesisId),
  });

  if (!thesis) throw new Error(`No thesis found with ID: ${thesisId}`);
  if (!thesis.conversationId) throw new Error('Thesis has no conversationId');

  const snapshotDirectory = getSnapshotDirectory();
  const result = await processResearchJobs(thesis.conversationId, { db, snapshotDirectory });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
