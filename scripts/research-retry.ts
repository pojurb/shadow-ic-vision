#!/usr/bin/env node
/**
 * Retry the research jobs of a thesis that did not complete, then process them.
 *
 * Usage: npm run research:retry -- --thesis-id <id>
 *        npm run research:retry -- --thesis-id <id> --job-id <jobId>
 *
 * Only `degraded` and `failed` jobs are eligible — `retryResearchJob` enforces
 * that, so a succeeded job cannot be silently re-run and overwrite evidence
 * that already verified.
 *
 * This resets the eligible jobs to `queued` and then runs the same
 * `processResearchJobs` path `npm run research:queue` uses, because a reset
 * alone changes nothing observable until a worker picks the job up.
 *
 * Written 2026-08-05 after retrying a real thesis's degraded jobs required
 * hand-writing a throwaway script: `retryResearchJob` existed in the service
 * and behind an API route, but had no terminal entry point (`DEC-0017` makes
 * the terminal the primary surface for triggering deterministic work).
 */

import './dotenv-quiet';
import 'dotenv/config';

import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { assumptions, researchJobs } from '../db/schema';
import { processResearchJobs, retryResearchJob } from '../lib/research/service';

function parseArgs(args: string[]): { thesisId: string; jobId: string | null } {
  let thesisId: string | null = null;
  let jobId: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--thesis-id') {
      thesisId = args[index + 1] ?? null;
      index += 1;
    } else if (args[index] === '--job-id') {
      jobId = args[index + 1] ?? null;
      index += 1;
    }
  }
  if (!thesisId) throw new Error('Missing required argument: --thesis-id');
  return { thesisId, jobId };
}

async function main() {
  const { thesisId, jobId } = parseArgs(process.argv.slice(2));
  const { db, dbPath } = getDatabase();

  const thesis = await db.query.theses.findFirst({
    where: (theses, { eq: equals }) => equals(theses.id, thesisId),
  });
  if (!thesis) throw new Error(`No thesis found with ID: ${thesisId}`);
  if (!thesis.conversationId) throw new Error('Thesis has no conversationId');

  const eligible = db
    .select({ id: researchJobs.id, status: researchJobs.status, errorCode: researchJobs.errorCode })
    .from(researchJobs)
    .innerJoin(assumptions, eq(assumptions.id, researchJobs.assumptionId))
    .where(and(
      eq(assumptions.thesisId, thesisId),
      inArray(researchJobs.status, ['degraded', 'failed']),
      ...(jobId ? [eq(researchJobs.id, jobId)] : []),
    ))
    .all();

  if (eligible.length === 0) {
    process.stdout.write('No degraded or failed jobs to retry for this thesis.\n');
    return;
  }

  for (const job of eligible) {
    await retryResearchJob(job.id, { db });
    process.stdout.write(`requeued ${job.id} (was ${job.status}${job.errorCode ? `: ${job.errorCode}` : ''})\n`);
  }

  process.stdout.write(`\nProcessing ${eligible.length} job(s)…\n`);
  const snapshotDirectory = path.join(path.dirname(dbPath), 'snapshots');
  const panel = await processResearchJobs(thesis.conversationId, { db, snapshotDirectory });

  process.stdout.write('\nResult:\n');
  for (const item of panel.items) {
    const detail = item.job.errorCode ? `${item.job.status}: ${item.job.errorCode}` : item.job.status;
    process.stdout.write(`  [${detail}] ${item.statement.replace(/\s+/g, ' ').trim().slice(0, 80)}\n`);
  }
  process.stdout.write(`\nFull detail: npm run research:panel -- --thesis-id ${thesisId}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
