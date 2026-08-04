#!/usr/bin/env node
/**
 * Read and display research panel for a given thesis.
 * Usage: npm run research:panel -- --thesis-id <id>
 * Output: JSON to stdout (verdict, coverage, evidence list)
 */

import { getDatabase } from '../db/client';
import { getResearchPanel } from '../lib/research/service';

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

  if (!thesis) {
    throw new Error(`No thesis found with ID: ${thesisId}`);
  }

  const conversationId = thesis.conversationId ?? '';
  const panel = await getResearchPanel(conversationId, { db });

  process.stdout.write(`${JSON.stringify(panel, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
