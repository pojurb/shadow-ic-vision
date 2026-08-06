import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, discoveryCandidates, evidence, sourceSnapshots, theses } from '@/db/schema';
import { cleanupMislabelledPromotions } from '@/lib/research/promotion-cleanup';

const INDEX_HTML = '<html><head><meta property="og:type" content="website"/></head><body><p>Listing.</p></body></html>';
const ARTICLE_HTML = '<html><head><meta property="og:type" content="article"/></head><body><p>Release.</p></body></html>';

describe('cleanupMislabelledPromotions', () => {
  let directory: string;
  let handle: DatabaseHandle;
  let assumptionId: string;

  function writeSnapshot(name: string, html: string, sourceUrl: string, documentHash: string) {
    const storagePath = path.join(directory, name);
    fs.writeFileSync(storagePath, html);
    handle.db.insert(sourceSnapshots).values({
      documentHash, documentId: sourceUrl, market: 'ID', ticker: 'TLKM',
      sourceUrl, sourceName: 'Web-discovered issuer release (TLKM)', sourceTier: 'secondary',
      sourceFormat: 'html', contentType: 'text/html', httpStatus: 200,
      retrievalTimestamp: '2026-08-05T00:00:00.000Z', storagePath, sourceMode: 'live',
    }).run();
  }

  function addEvidence(id: string, sourceUrl: string, documentHash: string) {
    handle.db.insert(evidence).values({
      id, assumptionId, sourceFormat: 'html', contentKind: 'text', extractionMethod: 'text',
      verificationStatus: 'secondary_issuer', documentHash, sourceUrl,
      retrievalTimestamp: '2026-08-05T00:00:00.000Z', content: 'Some quote.',
      sourceTier: 'secondary', sourceName: 'Web-discovered issuer release (TLKM)', impactSummary: '',
    }).run();
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-cleanup-'));
    handle = createDatabase(path.join(directory, 'db.sqlite'));
    handle.db.insert(theses).values({
      id: 'thesis-1', ticker: 'TLKM', companyName: 'Telkom', market: 'ID',
      coreBelief: 'x', title: 'TLKM', description: 'x',
    }).run();
    assumptionId = 'assumption-1';
    handle.db.insert(assumptions).values({
      id: assumptionId, thesisId: 'thesis-1', statement: 'Some assumption.', status: 'pending_confirmation',
    }).run();
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('makes no writes on a dry run, and the identical decisions on apply', () => {
    writeSnapshot('index.html', INDEX_HTML, 'https://www.telkom.co.id/', 'hash-index');
    addEvidence('ev-1', 'https://www.telkom.co.id/', 'hash-index');

    const dry = cleanupMislabelledPromotions({ db: handle.db, apply: false });
    expect(dry.relabelledSnapshots).toHaveLength(1);
    expect(dry.deletedEvidence).toHaveLength(1);
    // Nothing moved.
    expect(handle.db.select().from(evidence).all()).toHaveLength(1);
    expect(handle.db.select().from(sourceSnapshots).get()?.sourceName).toBe('Web-discovered issuer release (TLKM)');

    const applied = cleanupMislabelledPromotions({ db: handle.db, apply: true });
    expect(applied.relabelledSnapshots).toEqual(dry.relabelledSnapshots);
    expect(applied.deletedEvidence.map((row) => row.id)).toEqual(dry.deletedEvidence.map((row) => row.id));

    expect(handle.db.select().from(evidence).all()).toHaveLength(0);
    const snapshot = handle.db.select().from(sourceSnapshots).get();
    expect(snapshot?.sourceName).toBe('Web-discovered issuer page (TLKM)');
    // The raw file and its row survive: the fetch happened and stays auditable.
    expect(fs.existsSync(snapshot!.storagePath)).toBe(true);
  });

  /*
   * Decides per document, not per label. A page carrying the same label that
   * genuinely is an article must be left completely alone — a blanket match
   * would rely on the very assumption that proved wrong.
   */
  it('leaves a correctly-labelled article untouched even though it carries the same label', () => {
    writeSnapshot('article.html', ARTICLE_HTML, 'https://www.telkom.co.id/sites/berita/id_ID/news/real', 'hash-article');
    addEvidence('ev-good', 'https://www.telkom.co.id/sites/berita/id_ID/news/real', 'hash-article');

    const report = cleanupMislabelledPromotions({ db: handle.db, apply: true });

    expect(report.relabelledSnapshots).toHaveLength(0);
    expect(report.deletedEvidence).toHaveLength(0);
    expect(handle.db.select().from(evidence).all()).toHaveLength(1);
  });

  it('reverts an assumption to untested only when no evidence is left', () => {
    writeSnapshot('index.html', INDEX_HTML, 'https://www.telkom.co.id/', 'hash-index');
    addEvidence('ev-1', 'https://www.telkom.co.id/', 'hash-index');

    const report = cleanupMislabelledPromotions({ db: handle.db, apply: true });

    expect(report.recomputedAssumptions).toEqual([
      { assumptionId, from: 'pending_confirmation', to: 'untested' },
    ]);
    expect(handle.db.select().from(assumptions).get()?.status).toBe('untested');
  });

  it('never reverses a human acceptance, flagging it for manual review instead', () => {
    handle.db.update(assumptions).set({ status: 'user_confirmed_secondary' }).where(eq(assumptions.id, assumptionId)).run();
    writeSnapshot('index.html', INDEX_HTML, 'https://www.telkom.co.id/', 'hash-index');
    addEvidence('ev-1', 'https://www.telkom.co.id/', 'hash-index');

    const report = cleanupMislabelledPromotions({ db: handle.db, apply: true });

    expect(report.recomputedAssumptions).toHaveLength(0);
    expect(report.flaggedForManualReview).toMatchObject([{ assumptionId, status: 'user_confirmed_secondary' }]);
    expect(handle.db.select().from(assumptions).get()?.status).toBe('user_confirmed_secondary');
  });

  it('reclassifies a fetched candidate whose document was not an article', () => {
    writeSnapshot('index.html', INDEX_HTML, 'https://www.telkom.co.id/', 'hash-index');
    handle.db.insert(discoveryCandidates).values({
      id: 'cand-1', market: 'ID', ticker: 'TLKM', candidateUrl: 'https://www.telkom.co.id/',
      discoveredVia: 'web_search', searchQuery: 'TLKM', status: 'fetched', resultingDocumentHash: 'hash-index',
    }).run();

    cleanupMislabelledPromotions({ db: handle.db, apply: true });

    const candidate = handle.db.select().from(discoveryCandidates).get();
    expect(candidate).toMatchObject({ status: 'rejected', rejectionReason: 'not_an_article' });
    // The link to the document the decision was made from is retained.
    expect(candidate?.resultingDocumentHash).toBe('hash-index');
  });
});
