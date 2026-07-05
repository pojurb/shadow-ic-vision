import 'server-only';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { AppDatabase } from '@/db/client';
import { getDatabase } from '@/db/client';
import { ingestionLeases, ingestionRuns, researchJobs, sourceCursors, sourceSnapshots, theses, assumptions } from '@/db/schema';
import { getResearchSchedule } from './config';
import { processResearchJobs } from './service';

export type IngestionTrigger = 'cron' | 'manual';
type Dependencies = { db?: AppDatabase; now?: () => Date; process?: typeof processResearchJobs };

export class IngestionAlreadyRunningError extends Error {
  readonly code = 'already_running';
}

export async function refreshOfficialSources(trigger: IngestionTrigger, input: Dependencies = {}) {
  const db = input.db ?? getDatabase().db;
  const now = input.now ?? (() => new Date());
  const process = input.process ?? processResearchJobs;
  const started = now();
  const runId = randomUUID();
  const leaseId = 'official-source-refresh';
  const expiresAt = new Date(started.getTime() + 30 * 60_000).toISOString();

  const acquired = db.transaction((tx) => {
    tx.delete(ingestionLeases).where(lt(ingestionLeases.expiresAt, started.toISOString())).run();
    return tx.insert(ingestionLeases).values({ id: leaseId, ownerId: runId, expiresAt, updatedAt: started.toISOString() }).onConflictDoNothing().returning({ id: ingestionLeases.id }).get();
  });
  if (!acquired) throw new IngestionAlreadyRunningError('An official-source refresh is already running.');

  const tracked = await db.select({ id: theses.id, conversationId: theses.conversationId, market: theses.market, ticker: theses.ticker })
    .from(theses).where(eq(theses.status, 'active')).all();
  const companies = tracked.filter((row) => row.conversationId && row.market && row.ticker);
  db.insert(ingestionRuns).values({ id: runId, trigger, status: 'running', trackedCompanyCount: companies.length, startedAt: started.toISOString() }).run();
  const before = db.select({ value: sql<number>`count(*)` }).from(sourceSnapshots).get()?.value ?? 0;
  let degraded = false;
  try {
    const thesisIds = companies.map((company) => company.id);
    if (thesisIds.length) {
      const assumptionRows = db.select({ id: assumptions.id }).from(assumptions).where(inArray(assumptions.thesisId, thesisIds)).all();
      const assumptionIds = assumptionRows.map((row) => row.id);
      if (assumptionIds.length) db.update(researchJobs).set({ status: 'queued', error: null, errorCode: null, leaseExpiresAt: null, updatedAt: started.toISOString() }).where(inArray(researchJobs.assumptionId, assumptionIds)).run();
    }
    for (const company of companies) {
      const panel = await process(company.conversationId!, { db });
      degraded ||= panel.items.some((item) => item.job.status === 'degraded' || item.job.status === 'failed');
      const latest = db.select().from(sourceSnapshots).where(and(eq(sourceSnapshots.market, company.market!), eq(sourceSnapshots.ticker, company.ticker!))).all()
        .sort((a, b) => (b.publishDate ?? '').localeCompare(a.publishDate ?? ''))[0];
      db.insert(sourceCursors).values({ market: company.market!, ticker: company.ticker!, lastPublishDate: latest?.publishDate ?? null, lastDocumentId: latest?.documentId ?? null, checkedAt: now().toISOString(), updatedAt: now().toISOString() })
        .onConflictDoUpdate({ target: [sourceCursors.market, sourceCursors.ticker], set: { lastPublishDate: latest?.publishDate ?? null, lastDocumentId: latest?.documentId ?? null, checkedAt: now().toISOString(), updatedAt: now().toISOString() } }).run();
    }
    const after = db.select({ value: sql<number>`count(*)` }).from(sourceSnapshots).get()?.value ?? before;
    db.update(ingestionRuns).set({ status: degraded ? 'degraded' : 'succeeded', newDocumentCount: after - before, completedAt: now().toISOString() }).where(eq(ingestionRuns.id, runId)).run();
  } catch (error) {
    db.update(ingestionRuns).set({ status: 'failed', errorCode: 'source_http_error', error: error instanceof Error ? error.message : 'Refresh failed.', completedAt: now().toISOString() }).where(eq(ingestionRuns.id, runId)).run();
    throw error;
  } finally {
    db.delete(ingestionLeases).where(and(eq(ingestionLeases.id, leaseId), eq(ingestionLeases.ownerId, runId))).run();
  }
  return getIngestionStatus({ db, now });
}

export function getIngestionStatus(input: Pick<Dependencies, 'db' | 'now'> = {}) {
  const db = input.db ?? getDatabase().db;
  const now = input.now ?? (() => new Date());
  const latest = db.select().from(ingestionRuns).orderBy(sql`${ingestionRuns.startedAt} desc`).get();
  const schedule = getResearchSchedule();
  const [minuteText, hourText] = schedule.split(' ');
  const minute = Number(minuteText);
  const hour = Number(hourText);
  const current = now();
  const next = new Date(current);
  next.setHours(Number.isInteger(hour) ? hour : 8, Number.isInteger(minute) ? minute : 0, 0, 0);
  if (next <= current) next.setDate(next.getDate() + 1);
  return { schedule, lastRun: latest ?? null, nextScheduledAt: next.toISOString() };
}
