#!/usr/bin/env node
/**
 * Read and display research panel for a given thesis.
 * Usage: npm run research:panel -- --thesis-id <id>
 * Output: JSON to stdout (verdict, coverage, evidence list)
 */

import { program } from 'commander';
import path from 'node:path';
import { getDatabase } from '../db/client';
import { getResearchPanel } from '../lib/research/service';

const args = process.argv.slice(2);
program
  .option('--thesis-id <id>', 'Thesis ID')
  .parse(args);

const opts = program.opts() as { thesisId?: string };

if (!opts.thesisId) {
  console.error('Error: --thesis-id is required');
  process.exit(1);
}

(async () => {
  try {
    const { db } = getDatabase();
    const thesis = await db.query.theses.findFirst({
      where: (theses, { eq }) => eq(theses.id, opts.thesisId!),
    });

    if (!thesis) {
      console.error(`No thesis found with ID: ${opts.thesisId}`);
      process.exit(1);
    }

    const conversationId = thesis.conversationId ?? '';
    const panel = await getResearchPanel(conversationId, { db });

    console.log(JSON.stringify(panel, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
