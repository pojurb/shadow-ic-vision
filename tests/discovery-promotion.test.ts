import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, conversations, discoveryCandidates, evidence, messages } from '@/db/schema';
import { thesisDraftSchema } from '@/lib/domain/contracts';
import { confirmDraft } from '@/lib/research/service';
import { OfficialHttpClient, resetHttpStateForTests } from '@/lib/research/http';
import {
  buildPromotionClients,
  promoteAllEligibleCandidates,
  promoteCandidate,
  promotePendingForAssumption,
  type PromotionClients,
} from '@/lib/research/discovery-promotion';

const draft = thesisDraftSchema.parse({
  ticker: 'BBRI',
  companyName: 'Bank Rakyat Indonesia',
  market: 'ID',
  coreBelief: 'I believe BBRI net interest margin remains above 6.0%.',
  // M011. Resolved, but with no `sourceTags` — IDX publishes no XBRL company
  // facts, which is the market fail-closed path.
  assumptions: [{
    statement: 'BBRI net interest margin (NIM) remains above 6.0%.',
    status: 'untested',
    measurement: {
      resolution: 'resolved', metric: 'net interest margin',
      definitionVariant: 'consolidated NIM as reported',
      operator: 'gte', threshold: 6, unit: 'percent',
      timeBasis: 'duration_quarter', sourceTags: [],
      clarifyingQuestion: null, ambiguityReason: 'none',
    },
  }],
  requiresChallenge: false,
});

function stubClient(html: string, allowedHost: string, logPath: string): OfficialHttpClient {
  return new OfficialHttpClient({
    allowedHosts: [allowedHost],
    userAgent: 'test',
    logPath,
    fetchImpl: (async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch,
  });
}

describe('M008 discovery-candidate promotion (DEC-0015 §3.2 domain gate)', () => {
  let directory: string;
  let handle: DatabaseHandle;
  const conversationId = '5f0d9a2a-6b3f-4e2a-9f10-8a2f5b1c9d01';
  const messageId = '5f0d9a2a-6b3f-4e2a-9f10-8a2f5b1c9d02';

  beforeEach(() => {
    resetHttpStateForTests();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-promo-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    handle.db.insert(conversations).values({ id: conversationId, title: 'BBRI thesis' }).run();
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

  it('rejects a candidate on an unallowlisted domain without any network call — the R-013/DEC-0015 gate itself', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-untrusted', market: 'ID', ticker: 'BBRI',
      candidateUrl: 'https://untrusted.example.com/article',
      discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending',
    }).run();

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-untrusted', candidateUrl: 'https://untrusted.example.com/article',
      market: 'ID', ticker: 'BBRI', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients: {},
    });

    expect(outcome).toBe('rejected');
    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-untrusted')).get()).toMatchObject({
      status: 'rejected', rejectionReason: 'domain_not_allowlisted',
    });
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
  });

  /*
   * Found by independent review, 2026-08-06. `promoteCandidate` assigned its
   * source class from the URL's origin alone, so any page on an allowlisted
   * issuer domain was stored as "Web-discovered issuer release". These two
   * URLs are verbatim from the live database under that label — a site
   * homepage and an IR report-index page, neither of which is a release or an
   * announcement, and so neither is Class A as DEC-0015 defines it.
   *
   * The mislabel is not cosmetic: any secondary evidence row moves its
   * assumption to `pending_confirmation` and offers "Accept secondary
   * evidence" in the panel.
   */
  it('rejects a site homepage without fetching it', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    const candidateUrl = 'https://www.telkom.co.id/';
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-homepage', market: 'ID', ticker: 'TLKM',
      candidateUrl, discoveredVia: 'web_search', searchQuery: 'TLKM', status: 'pending',
    }).run();

    const clients: PromotionClients = {
      'https://www.telkom.co.id': {
        client: { get: () => { throw new Error('must not fetch a homepage'); } } as unknown as OfficialHttpClient,
        sourceClass: 'issuer',
      },
    };

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-homepage', candidateUrl,
      market: 'ID', ticker: 'TLKM', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    });

    expect(outcome).toBe('rejected');
    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-homepage')).get())
      .toMatchObject({ status: 'rejected', rejectionReason: 'not_an_issuer_release' });
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).where(eq(assumptions.id, assumption.id)).get()?.status).toBe('untested');
  });

  /*
   * The URL carries a section word, so no path-shape rule can refuse it — this
   * is exactly the case an independent review showed a URL-only gate could not
   * reach. The document itself declares `og:type=website`, which is what every
   * one of the five mislabelled pages in the live database declares, and what
   * separates them from the ten genuine releases and articles retained
   * alongside them.
   */
  it.each([
    ['issuer', 'https://www.telkom.co.id/sites/berita/id_ID/page/news-122'],
    ['news', 'https://www.telkom.co.id/sites/berita/id_ID/news/index'],
  ])('fetches, then rejects a %s-class section index the URL alone cannot catch', async (sourceClass, candidateUrl) => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-index', market: 'ID', ticker: 'TLKM',
      candidateUrl, discoveredVia: 'web_search', searchQuery: 'TLKM', status: 'pending',
    }).run();

    const indexHtml = '<html><head><meta property="og:type" content="website"/></head>'
      + '<body><p>TLKM net interest margin remains above 6.0% according to this listing page.</p></body></html>';
    const clients: PromotionClients = {
      'https://www.telkom.co.id': {
        client: stubClient(indexHtml, 'www.telkom.co.id', path.join(directory, 'outbound.log')),
        sourceClass: sourceClass as 'issuer' | 'news',
      },
    };

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-index', candidateUrl,
      market: 'ID', ticker: 'TLKM', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    });

    expect(outcome).toBe('rejected');
    const row = handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-index')).get();
    expect(row?.rejectionReason).toBe('not_an_article');
    // A refused document is never persisted to `source_snapshots`, so the
    // candidate carries no resulting hash.
    expect(row?.resultingDocumentHash).toBeNull();
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    expect(handle.db.select().from(assumptions).where(eq(assumptions.id, assumption.id)).get()?.status).toBe('untested');
  });

  it('promotes a genuine release whose URL shape is opaque, on the document declaration alone', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    // No section word anywhere in the path: the URL-only gate rejected this
    // shape outright, and did so terminally.
    const candidateUrl = 'https://ir.bri.co.id/investors/update/12345';
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-opaque', market: 'ID', ticker: 'BBRI',
      candidateUrl, discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending',
    }).run();

    const releaseHtml = '<html><head><script type="application/ld+json">{"@type":"NewsArticle","headline":"BBRI Q1"}</script></head>'
      + '<body><p>BBRI reported net interest margin (NIM) remains above 6.0% in the latest quarter.</p></body></html>';
    const clients: PromotionClients = {
      'https://ir.bri.co.id': { client: stubClient(releaseHtml, 'ir.bri.co.id', path.join(directory, 'outbound.log')), sourceClass: 'issuer' },
    };

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-opaque', candidateUrl,
      market: 'ID', ticker: 'BBRI', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    });

    expect(outcome).toBe('promoted');
  });

  it('fetches, extracts, and inserts secondary_issuer evidence through OfficialHttpClient when the domain is allowlisted', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-trusted', market: 'ID', ticker: 'BBRI',
      candidateUrl: 'https://ir.bri.co.id/press/nim-update',
      discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending',
    }).run();

    const html = '<html><body><p>BBRI reported net interest margin (NIM) remains above 6.0% in the latest quarter.</p></body></html>';
    const clients: PromotionClients = {
      'https://ir.bri.co.id': { client: stubClient(html, 'ir.bri.co.id', path.join(directory, 'outbound.log')), sourceClass: 'issuer' },
    };

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-trusted', candidateUrl: 'https://ir.bri.co.id/press/nim-update',
      market: 'ID', ticker: 'BBRI', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    });

    expect(outcome).toBe('promoted');
    const candidateRow = handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-trusted')).get();
    expect(candidateRow?.status).toBe('fetched');
    expect(candidateRow?.resultingDocumentHash).toBeTruthy();

    const evidenceRow = handle.db.select().from(evidence).where(eq(evidence.assumptionId, assumption.id)).get();
    expect(evidenceRow).toMatchObject({
      verificationStatus: 'secondary_issuer',
      sourceTier: 'secondary',
      content: expect.stringContaining('net interest margin (NIM) remains above 6.0%'),
    });
    // R-010: promoted Class C evidence is never exact_verified/ocr_matched.
    expect(evidenceRow?.canonicalTextHash).toBeNull();
    // M007 Slice 5 gate still applies unmodified to promoted evidence.
    expect(handle.db.select().from(assumptions).get()?.status).toBe('pending_confirmation');
  });

  it('marks a candidate unreachable, not rejected, when an allowlisted fetch throws — and never crashes the caller', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-down', market: 'ID', ticker: 'BBRI',
      candidateUrl: 'https://ir.bri.co.id/press/unreachable',
      discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending',
    }).run();

    const throwingClient = new OfficialHttpClient({
      allowedHosts: ['ir.bri.co.id'],
      userAgent: 'test',
      logPath: path.join(directory, 'outbound.log'),
      maxAttempts: 1,
      fetchImpl: (async () => { throw new Error('network down'); }) as unknown as typeof fetch,
    });
    const clients: PromotionClients = { 'https://ir.bri.co.id': { client: throwingClient, sourceClass: 'issuer' } };

    const outcome = await promoteCandidate({
      db: handle.db, candidateId: 'cand-down', candidateUrl: 'https://ir.bri.co.id/press/unreachable',
      market: 'ID', ticker: 'BBRI', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    });

    expect(outcome).toBe('unreachable');
    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-down')).get()?.status).toBe('unreachable');
    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
  });

  it('promotePendingForAssumption sweeps every pending candidate for the ticker and never throws', async () => {
    const { thesisId, jobIds } = confirmDraft(conversationId, messageId, { db: handle.db });
    const assumption = handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get()!;
    handle.db.insert(discoveryCandidates).values([
      { id: 'cand-a', market: 'ID', ticker: 'BBRI', candidateUrl: 'https://aggregator.example.com/a', discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending' },
      { id: 'cand-b', market: 'ID', ticker: 'BBRI', candidateUrl: 'https://ir.bri.co.id/press/nim', discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'pending' },
    ]).run();

    const html = '<html><body><p>BBRI reported net interest margin (NIM) remains above 6.0% again this quarter.</p></body></html>';
    const clients: PromotionClients = {
      'https://ir.bri.co.id': { client: stubClient(html, 'ir.bri.co.id', path.join(directory, 'outbound.log')), sourceClass: 'issuer' },
    };

    await expect(promotePendingForAssumption({
      db: handle.db, market: 'ID', ticker: 'BBRI', assumptionId: assumption.id, assumptionStatement: assumption.statement,
      jobId: jobIds[0], snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(),
      clients,
    })).resolves.toBeUndefined();

    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-a')).get()?.status).toBe('rejected');
    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-b')).get()?.status).toBe('fetched');
  });

  it('promoteAllEligibleCandidates (the CLI sweep) re-evaluates a previously domain-rejected candidate once the domain is allowlisted', async () => {
    const { thesisId } = confirmDraft(conversationId, messageId, { db: handle.db });
    handle.db.select().from(assumptions).where(eq(assumptions.thesisId, thesisId)).get();
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-reeval', market: 'ID', ticker: 'BBRI', candidateUrl: 'https://ir.bri.co.id/press/nim-reeval',
      discoveredVia: 'web_search', searchQuery: 'BBRI', status: 'rejected', rejectionReason: 'domain_not_allowlisted',
    }).run();

    const html = '<html><body><p>BBRI reported net interest margin (NIM) remains above 6.0% per the re-evaluated release.</p></body></html>';
    const clients: PromotionClients = {
      'https://ir.bri.co.id': { client: stubClient(html, 'ir.bri.co.id', path.join(directory, 'outbound.log')), sourceClass: 'issuer' },
    };

    const stats = await promoteAllEligibleCandidates({
      db: handle.db, snapshotDirectory: path.join(directory, 'snapshots'), sourceMode: 'live', now: () => new Date(), clients,
    });

    expect(stats.promoted).toBe(1);
    expect(handle.db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, 'cand-reeval')).get()?.status).toBe('fetched');
  });

  it('buildPromotionClients tags issuer vs. news origins from their respective env-configured allowlists', () => {
    const previousIssuer = process.env.ISSUER_PRESS_RELEASE_URLS;
    const previousNews = process.env.NEWS_WIRE_FEED_URLS;
    process.env.ISSUER_PRESS_RELEASE_URLS = JSON.stringify({ BBRI: 'https://ir.bri.co.id/press' });
    process.env.NEWS_WIRE_FEED_URLS = JSON.stringify({ Reuters: 'https://www.reuters.com/feed' });
    try {
      const clients = buildPromotionClients(path.join(directory, 'outbound.log'));
      expect(clients['https://ir.bri.co.id']?.sourceClass).toBe('issuer');
      expect(clients['https://www.reuters.com']?.sourceClass).toBe('news');
    } finally {
      process.env.ISSUER_PRESS_RELEASE_URLS = previousIssuer;
      process.env.NEWS_WIRE_FEED_URLS = previousNews;
    }
  });
});
