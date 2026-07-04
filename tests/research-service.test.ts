import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, conversations, evidence, messages, researchJobSources, researchJobs, sourceSnapshots, theses } from '@/db/schema';
import { thesisDraftSchema } from '@/lib/domain/contracts';
import { confirmDraft, getResearchPanel, processResearchJobs, retryResearchJob } from '@/lib/research/service';

const draft = thesisDraftSchema.parse({
  ticker: 'PLTR',
  companyName: 'Palantir Technologies Inc.',
  market: 'US',
  coreBelief: 'I believe PLTR gross margin will remain above 80%.',
  assumptions: [{ statement: 'PLTR gross margin remains above 80%.', status: 'untested' }],
  requiresChallenge: false,
});

describe('local vertical slice persistence', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = '77d80b7f-4d57-46ab-9341-f972b6ecf5f3';
  const messageId = '79f651e7-77ab-4745-84f9-d20b7efef6e3';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    handle.db.insert(conversations).values({ id: conversationId, title: 'PLTR thesis' }).run();
    handle.db.insert(messages).values({
      id: messageId,
      conversationId,
      role: 'assistant',
      content: 'Review the draft.',
      structuredPayload: JSON.stringify(draft),
      validationOutcome: 'valid',
    }).run();
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('applies all migrations and enforces foreign keys', () => {
    const tables = handle.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toContain('research_jobs');
    expect(tables.map((table) => table.name)).toContain('source_snapshots');
    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('backs up an existing database before a migration run', () => {
    handle.sqlite.close();
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    const backups = fs.readdirSync(path.join(directory, 'backups'));
    expect(backups.some((name) => name.startsWith('db-before-migrate-'))).toBe(true);
  });

  it('confirms transactionally and is idempotent', () => {
    const first = confirmDraft(conversationId, messageId, { db: handle.db });
    const second = confirmDraft(conversationId, messageId, { db: handle.db });
    expect(first.alreadyConfirmed).toBe(false);
    expect(second).toMatchObject({ thesisId: first.thesisId, alreadyConfirmed: true });
    expect(handle.db.select({ count: sql<number>`count(*)` }).from(theses).get()?.count).toBe(1);
    expect(handle.db.select({ count: sql<number>`count(*)` }).from(researchJobs).get()?.count).toBe(1);
  });

  it('rolls back an invalid confirmation', () => {
    handle.db.update(messages).set({ structuredPayload: '{bad json' }).where(eq(messages.id, messageId)).run();
    expect(() => confirmDraft(conversationId, messageId, { db: handle.db })).toThrow();
    expect(handle.db.select().from(theses).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
  });

  it('moves a job to succeeded and stores only exact evidence', async () => {
    confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('succeeded');
    expect(panel.items[0].evidence[0]).toMatchObject({
      exactQuote: 'gross margin of 81.3%',
      verificationStatus: 'exact_verified',
      interpretationStatus: 'pending',
    });
    expect(handle.db.select().from(assumptions).get()?.status).toBe('untested');
    expect(handle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(researchJobSources).all()).toHaveLength(1);
  });

  it('degrades a citation mismatch, stores no evidence, and permits retry', async () => {
    const mismatch = { ...draft, assumptions: [{ statement: 'PLTR gross margin remains above 90% (simulate citation mismatch).', status: 'untested' as const }] };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(mismatch) }).where(eq(messages.id, messageId)).run();
    const confirmed = confirmDraft(conversationId, messageId, { db: handle.db });
    const panel = await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(panel.items[0].job.status).toBe('degraded');
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    expect(handle.db.select().from(researchJobSources).get()).toMatchObject({ outcome: 'rejected', errorCode: 'citation_not_found' });
    await retryResearchJob(confirmed.jobIds[0], { db: handle.db });
    expect((await getResearchPanel(conversationId, { db: handle.db })).items[0].job.status).toBe('queued');
  });

  it('cascade deletes assumptions, jobs, and evidence with the thesis', async () => {
    const confirmed = confirmDraft(conversationId, messageId, { db: handle.db });
    await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    handle.db.delete(theses).where(eq(theses.id, confirmed.thesisId)).run();
    expect(handle.db.select().from(assumptions).all()).toHaveLength(0);
    expect(handle.db.select().from(researchJobs).all()).toHaveLength(0);
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
  });

  it('deduplicates immutable snapshots across jobs', async () => {
    const twoAssumptions = {
      ...draft,
      assumptions: [
        { statement: 'PLTR gross margin remains above 80%.', status: 'untested' as const },
        { statement: 'PLTR commercial scale supports gross margin.', status: 'untested' as const },
      ],
    };
    handle.db.update(messages).set({ structuredPayload: JSON.stringify(twoAssumptions) }).where(eq(messages.id, messageId)).run();
    confirmDraft(conversationId, messageId, { db: handle.db });
    await processResearchJobs(conversationId, { db: handle.db, snapshotDirectory: path.join(directory, 'snapshots') });
    expect(handle.db.select().from(sourceSnapshots).all()).toHaveLength(1);
    expect(handle.db.select().from(researchJobSources).all()).toHaveLength(2);
  });
});
