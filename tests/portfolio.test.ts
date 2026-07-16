import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { eq } from 'drizzle-orm';
import { conversations, theses, portfolioAlerts, assumptions, researchJobs } from '@/db/schema';
import {
  getPortfolioPositions,
  createPortfolioPosition,
  updatePortfolioPosition,
  deletePortfolioPosition,
  getUnreadAlerts,
  markAlertAsRead,
  markAllAlertsAsReadForPosition,
} from '@/db/queries';
import { persistSourceSnapshot } from '@/lib/research/snapshot-store';
import type { SourceSnapshot } from '@/lib/research/adapters/types';

// Mock getDatabase globally in tests to point to our test database handle
// Drizzle queries use getDatabase() under the hood, so we can override it by using globalThis or changing environment variables.
// Let's check how other tests mock getDatabase. They pass options like { db: handle.db } to service functions, or since queries.ts uses getDatabase() directly,
// let's look at how getDatabase resolves DB_PATH: resolveDatabasePath() uses process.env.DB_PATH.
// So we can set process.env.DB_PATH to our temp file, and getDatabase() will resolve to it!
// But wait, getDatabase() caches it on globalThis.__jpInvestDatabase.
// So if we set globalThis.__jpInvestDatabase inside beforeEach, it will automatically use our test database handle!
// This is exactly how db/client.ts works: getDatabase() checks globalThis.__jpInvestDatabase.

type GlobalDatabase = typeof globalThis & {
  __jpInvestDatabase?: DatabaseHandle;
};

describe('Portfolio Position CRUD & Thesis Cascade', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = 'c8b671a5-8120-40e9-b52b-4fa81561726a';
  const thesisId = 't9f871e8-78ab-4745-84f9-d20b7efef6f5';
  const assumptionId = 'assumption-123';
  const jobId = 'job-123';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-portfolio-'));
    const dbPath = path.join(directory, 'test.sqlite');
    handle = createDatabase(dbPath);
    (globalThis as GlobalDatabase).__jpInvestDatabase = handle;

    // Seed conversation and thesis
    handle.db.insert(conversations).values({ id: conversationId, title: 'Test Conversation' }).run();
    handle.db.insert(theses).values({
      id: thesisId,
      conversationId,
      draftMessageId: null,
      ticker: 'PLTR',
      companyName: 'Palantir Technologies Inc.',
      market: 'US',
      coreBelief: 'Strong defense growth',
      title: 'PLTR Thesis',
      description: 'Long-term buy',
    }).run();

    handle.db.insert(assumptions).values({
      id: assumptionId,
      thesisId,
      statement: 'PLTR Q2 revenue exceeded expectations',
      status: 'untested',
    }).run();

    handle.db.insert(researchJobs).values({
      id: jobId,
      assumptionId,
      status: 'queued',
      sourceMode: 'mock',
    }).run();
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
    delete (globalThis as GlobalDatabase).__jpInvestDatabase;
  });

  it('performs CRUD operations on portfolio positions', async () => {
    // 1. Create
    const id = await createPortfolioPosition({
      ticker: 'PLTR',
      market: 'US',
      shares: 150,
      averageBuyPrice: 42.5,
      thesisId,
    });
    expect(id).toBeDefined();

    // 2. Read (get all)
    const positions = await getPortfolioPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      id,
      ticker: 'PLTR',
      market: 'US',
      shares: 150,
      averageBuyPrice: 42.5,
      thesisId,
      thesisTitle: 'PLTR Thesis',
    });

    // 3. Update
    await updatePortfolioPosition(id, {
      shares: 200,
      averageBuyPrice: 40.0,
      thesisId: null, // Unlink
    });

    const updated = await getPortfolioPositions();
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id,
      shares: 200,
      averageBuyPrice: 40.0,
      thesisId: null,
      thesisTitle: null,
    });

    // 4. Delete
    await deletePortfolioPosition(id);
    const deleted = await getPortfolioPositions();
    expect(deleted).toHaveLength(0);
  });

  it('cascades thesisId to null when linked thesis is deleted', async () => {
    const id = await createPortfolioPosition({
      ticker: 'PLTR',
      market: 'US',
      shares: 150,
      averageBuyPrice: 42.5,
      thesisId,
    });

    // Delete the thesis
    handle.db.delete(theses).where(eq(theses.id, thesisId)).run();

    // The position should still exist, but with thesisId set to null
    const positions = await getPortfolioPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].id).toBe(id);
    expect(positions[0].thesisId).toBeNull();
    expect(positions[0].thesisTitle).toBeNull();
  });

  it('automates alert generation and handles marking alerts as read/dismissed', async () => {
    // 1. Create a position for PLTR US
    const posId = await createPortfolioPosition({
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 42.0,
      thesisId,
    });

    // 2. Persist a new snapshot for PLTR US
    const snapshot: SourceSnapshot = {
      documentId: 'doc-101',
      market: 'US',
      ticker: 'PLTR',
      sourceUrl: 'https://sec.gov/pltr-10q',
      sourceName: 'SEC EDGAR 10-Q',
      sourceTier: 'official',
      sourceFormat: 'html',
      contentType: 'text/html',
      httpStatus: 200,
      publishDate: '2026-06-15',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes: Buffer.from('PLTR Q2 revenue exceeded expectations'),
    };

    const docHash = 'hash12345';
    persistSourceSnapshot({
      db: handle.db,
      jobId,
      snapshot,
      documentHash: docHash,
      sourceMode: 'mock',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    // 3. Verify alert generated
    const alerts = await getUnreadAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      positionId: posId,
      documentHash: docHash,
      isRead: false,
      ticker: 'PLTR',
      market: 'US',
      sourceUrl: 'https://sec.gov/pltr-10q',
      sourceName: 'SEC EDGAR 10-Q',
    });

    // 4. Mark specific alert as read
    await markAlertAsRead(alerts[0].id);
    const unreadAfterSingle = await getUnreadAlerts();
    expect(unreadAfterSingle).toHaveLength(0);

    // 5. Test markAllAlertsAsReadForPosition
    // Add another snapshot to trigger a second alert
    const snapshot2: SourceSnapshot = {
      ...snapshot,
      documentId: 'doc-102',
      publishDate: '2026-07-01',
    };
    persistSourceSnapshot({
      db: handle.db,
      jobId,
      snapshot: snapshot2,
      documentHash: 'hash67890',
      sourceMode: 'mock',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    const alertsBeforeAll = await getUnreadAlerts();
    expect(alertsBeforeAll).toHaveLength(1);

    await markAllAlertsAsReadForPosition(posId);
    const alertsAfterAll = await getUnreadAlerts();
    expect(alertsAfterAll).toHaveLength(0);
  });

  it('cascades deletion of portfolio alerts when the position is deleted', async () => {
    const posId = await createPortfolioPosition({
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 42.0,
      thesisId,
    });

    const snapshot: SourceSnapshot = {
      documentId: 'doc-101',
      market: 'US',
      ticker: 'PLTR',
      sourceUrl: 'https://sec.gov/pltr-10q',
      sourceName: 'SEC EDGAR 10-Q',
      sourceTier: 'official',
      sourceFormat: 'html',
      contentType: 'text/html',
      httpStatus: 200,
      publishDate: '2026-06-15',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes: Buffer.from('PLTR Q2 revenue exceeded expectations'),
    };

    persistSourceSnapshot({
      db: handle.db,
      jobId,
      snapshot,
      documentHash: 'hash12345',
      sourceMode: 'mock',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    // Check alert count in db directly
    const countBefore = handle.db.select().from(portfolioAlerts).all();
    expect(countBefore).toHaveLength(1);

    // Delete position
    await deletePortfolioPosition(posId);

    // Alert should be cascade deleted
    const countAfter = handle.db.select().from(portfolioAlerts).all();
    expect(countAfter).toHaveLength(0);
  });
});
