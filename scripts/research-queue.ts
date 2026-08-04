#!/usr/bin/env node
/**
 * Trigger research jobs for a given thesis.
 * Usage: npm run research:queue -- --thesis-id <id>
 * Output: JSON status to stdout
 */

import './dotenv-quiet';
import 'dotenv/config';

import { program } from 'commander';
import { getDatabase } from '../db/client';
import { processResearchJobs } from '../lib/research/service';
import path from 'node:path';

const args = process.argv.slice(2);
program
  .option('--thesis-id <id>', 'Thesis ID to queue research for')
  .parse(args);

const opts = program.opts() as { thesisId?: string };

if (!opts.thesisId) {
  console.error('Error: --thesis-id is required');
  process.exit(1);
}

async function main() {
  try {
    const { db, dbPath } = getDatabase();

    const thesis = await db.query.theses.findFirst({
      where: (theses, { eq }) => eq(theses.id, opts.thesisId!),
    });

    if (!thesis) {
      console.error(`No thesis found with ID: ${opts.thesisId}`);
      process.exit(1);
    }

    if (!thesis.conversationId) {
      console.error(`Thesis has no conversationId`);
      process.exit(1);
    }

    const snapshotDirectory = path.join(path.dirname(dbPath), 'snapshots');

    // Process all queued research jobs for this thesis's conversation
    const result = await processResearchJobs(thesis.conversationId, { db, snapshotDirectory });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Research queue failed.'}\n`);
    process.exitCode = 1;
  }
}

main();
