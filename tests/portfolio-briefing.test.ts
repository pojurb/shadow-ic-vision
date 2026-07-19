import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { conversations, theses, assumptions, researchJobs, decisions, portfolioPositions, portfolioAlerts } from '@/db/schema';
import { getPortfolioBriefing } from '@/db/queries';
import { calculatePriorityScore, STALE_REVIEW_DAYS } from '@/lib/portfolio/priorityQueue';
import { persistSourceSnapshot } from '@/lib/research/snapshot-store';
import type { SourceSnapshot } from '@/lib/research/adapters/types';

type GlobalDatabase = typeof globalThis & {
  __jpInvestDatabase?: DatabaseHandle;
};

function daysAgoTimestamp(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe('calculatePriorityScore', () => {
  it('returns zero for a fresh, unalerted, unchallenged holding', () => {
    expect(calculatePriorityScore(0, 0, false)).toBe(0);
  });

  it('weights unread alerts heavily', () => {
    expect(calculatePriorityScore(3, 0, false)).toBe(150);
  });

  it('does not add a staleness penalty at or below the threshold', () => {
    expect(calculatePriorityScore(0, STALE_REVIEW_DAYS, false)).toBe(0);
  });

  it('adds a staleness penalty once past the threshold', () => {
    expect(calculatePriorityScore(0, STALE_REVIEW_DAYS + 1, false)).toBe((STALE_REVIEW_DAYS + 1) * 5);
  });

  it('adds a flat bonus for challenged assumptions', () => {
    expect(calculatePriorityScore(0, 0, true)).toBe(30);
  });

  it('combines all three factors', () => {
    expect(calculatePriorityScore(2, 10, true)).toBe(2 * 50 + 10 * 5 + 30);
  });
});

describe('getPortfolioBriefing', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = 'c8b671a5-8120-40e9-b52b-4fa81561726a';
  const thesisId = 't9f871e8-78ab-4745-84f9-d20b7efef6f5';
  const assumptionId = 'assumption-123';
  const jobId = 'job-123';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-briefing-'));
    const dbPath = path.join(directory, 'test.sqlite');
    handle = createDatabase(dbPath);
    (globalThis as GlobalDatabase).__jpInvestDatabase = handle;

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

  it('returns the conversationId (not the thesisId) for a thesis-linked position', async () => {
    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 40,
      thesisId,
    }).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);

    expect(item).toBeDefined();
    expect(item?.thesisId).toBe(thesisId);
    expect(item?.conversationId).toBe(conversationId);
    expect(item?.conversationId).not.toBe(thesisId);
  });

  it('returns a null conversationId for an unlinked position', async () => {
    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'GOTO',
      market: 'ID',
      shares: 1000,
      averageBuyPrice: 60,
      thesisId: null,
    }).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);

    expect(item?.conversationId).toBeNull();
    expect(item?.daysSinceLastReview).toBe(0);
  });

  it('uses the latest decision timestamp for daysSinceLastReview when decisions exist', async () => {
    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 40,
      thesisId,
    }).run();

    handle.db.insert(decisions).values({
      id: randomUUID(),
      thesisId,
      outcome: 'No Change',
      action: 'Hold',
      rationale: 'Older review',
      createdAt: daysAgoTimestamp(10),
    }).run();
    handle.db.insert(decisions).values({
      id: randomUUID(),
      thesisId,
      outcome: 'Update Thesis',
      action: 'Exit',
      rationale: 'Most recent review',
      createdAt: daysAgoTimestamp(3),
    }).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);

    expect(item?.daysSinceLastReview).toBe(3);
    expect(item?.lastOutcome).toBe('Update Thesis');
    expect(item?.lastAction).toBe('Exit');
  });

  it('returns a null lastOutcome/lastAction when the linked thesis has no decisions', async () => {
    const secondConversationId = randomUUID();
    const secondThesisId = randomUUID();
    handle.db.insert(conversations).values({ id: secondConversationId, title: 'No Decisions Conversation' }).run();
    handle.db.insert(theses).values({
      id: secondThesisId,
      conversationId: secondConversationId,
      draftMessageId: null,
      ticker: 'MSFT',
      companyName: 'Microsoft Corporation',
      market: 'US',
      coreBelief: 'Cloud growth',
      title: 'MSFT Thesis',
      description: 'Hold',
    }).run();

    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'MSFT',
      market: 'US',
      shares: 5,
      averageBuyPrice: 400,
      thesisId: secondThesisId,
    }).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);

    expect(item?.lastOutcome).toBeNull();
    expect(item?.lastAction).toBeNull();
  });

  it('falls back to position creation time when the linked thesis has no decisions', async () => {
    const secondConversationId = randomUUID();
    const secondThesisId = randomUUID();
    handle.db.insert(conversations).values({ id: secondConversationId, title: 'Second Conversation' }).run();
    handle.db.insert(theses).values({
      id: secondThesisId,
      conversationId: secondConversationId,
      draftMessageId: null,
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      market: 'US',
      coreBelief: 'Services growth',
      title: 'AAPL Thesis',
      description: 'Hold',
    }).run();

    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'AAPL',
      market: 'US',
      shares: 10,
      averageBuyPrice: 190,
      thesisId: secondThesisId,
    }).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);

    expect(item?.daysSinceLastReview).toBe(0);
  });

  it('flags hasChallengedAssumptions only when a challenged assumption exists on the linked thesis', async () => {
    const posChallenged = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posChallenged,
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 40,
      thesisId,
    }).run();
    handle.db.insert(assumptions).values({
      id: randomUUID(),
      thesisId,
      statement: 'Margins will contract',
      status: 'challenged',
    }).run();

    const secondConversationId = randomUUID();
    const secondThesisId = randomUUID();
    handle.db.insert(conversations).values({ id: secondConversationId, title: 'Second Conversation' }).run();
    handle.db.insert(theses).values({
      id: secondThesisId,
      conversationId: secondConversationId,
      draftMessageId: null,
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      market: 'US',
      coreBelief: 'Services growth',
      title: 'AAPL Thesis',
      description: 'Hold',
    }).run();
    handle.db.insert(assumptions).values({
      id: randomUUID(),
      thesisId: secondThesisId,
      statement: 'Unrelated untested claim',
      status: 'untested',
    }).run();
    const posClean = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posClean,
      ticker: 'AAPL',
      market: 'US',
      shares: 10,
      averageBuyPrice: 190,
      thesisId: secondThesisId,
    }).run();

    const briefing = await getPortfolioBriefing();
    expect(briefing.find((entry) => entry.id === posChallenged)?.hasChallengedAssumptions).toBe(true);
    expect(briefing.find((entry) => entry.id === posClean)?.hasChallengedAssumptions).toBe(false);
  });

  it('counts only unread alerts per position', async () => {
    const posId = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posId,
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 40,
      thesisId,
    }).run();

    const makeSnapshot = (documentId: string): SourceSnapshot => ({
      documentId,
      market: 'US',
      ticker: 'PLTR',
      sourceUrl: `https://sec.gov/pltr-${documentId}`,
      sourceName: 'SEC EDGAR 10-Q',
      sourceTier: 'official',
      sourceFormat: 'html',
      contentType: 'text/html',
      httpStatus: 200,
      publishDate: '2026-06-15',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes: Buffer.from(`content-${documentId}`),
    });

    persistSourceSnapshot({
      db: handle.db,
      jobId,
      snapshot: makeSnapshot('doc-1'),
      documentHash: 'hash-1',
      sourceMode: 'mock',
      snapshotDirectory: directory,
      outcome: 'verified',
    });
    persistSourceSnapshot({
      db: handle.db,
      jobId,
      snapshot: makeSnapshot('doc-2'),
      documentHash: 'hash-2',
      sourceMode: 'mock',
      snapshotDirectory: directory,
      outcome: 'verified',
    });

    const alertRows = handle.db.select().from(portfolioAlerts).all();
    expect(alertRows).toHaveLength(2);
    handle.db.update(portfolioAlerts).set({ isRead: true }).where(eq(portfolioAlerts.id, alertRows[0].id)).run();

    const briefing = await getPortfolioBriefing();
    const item = briefing.find((entry) => entry.id === posId);
    expect(item?.unreadAlertCount).toBe(1);
  });

  it('orders positions by descending priority score', async () => {
    const posHigh = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posHigh,
      ticker: 'PLTR',
      market: 'US',
      shares: 100,
      averageBuyPrice: 40,
      thesisId,
      createdAt: daysAgoTimestamp(30),
    }).run();
    handle.db.insert(assumptions).values({
      id: randomUUID(),
      thesisId,
      statement: 'Margins will contract',
      status: 'challenged',
    }).run();

    const posLow = randomUUID();
    handle.db.insert(portfolioPositions).values({
      id: posLow,
      ticker: 'GOTO',
      market: 'ID',
      shares: 1000,
      averageBuyPrice: 60,
      thesisId: null,
    }).run();

    const briefing = await getPortfolioBriefing();
    const scores = briefing.map((entry) => entry.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));

    const highIndex = briefing.findIndex((entry) => entry.id === posHigh);
    const lowIndex = briefing.findIndex((entry) => entry.id === posLow);
    expect(highIndex).toBeLessThan(lowIndex);
  });
});
