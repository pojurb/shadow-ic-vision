import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIdxAttachmentUrl, parseIdxAnnouncements } from '@/lib/research/adapters/idx';
import { discoverIssuerDocuments } from '@/lib/research/adapters/issuer';
import { discoverIssuerPressReleases } from '@/lib/research/adapters/issuer-press';
import { NewsWireAdapter, parseNewsFeedItems } from '@/lib/research/adapters/news-wire';
import { SecAdapter, selectLatestFiling } from '@/lib/research/adapters/sec';
import { OfficialHttpClient, resetHttpStateForTests } from '@/lib/research/http';

describe('official source adapters', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-http-'));
    resetHttpStateForTests();
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('selects the latest 10-Q and falls back to 10-K by form priority', () => {
    const recent = {
      accessionNumber: ['annual', 'quarterly'],
      form: ['10-K', '10-Q'],
      filingDate: ['2026-06-01', '2026-05-01'],
      primaryDocument: ['annual.htm', 'quarterly.htm'],
    };
    expect(selectLatestFiling(recent, ['10-Q', '10-K'])).toMatchObject({ accessionNumber: 'quarterly', form: '10-Q' });
    expect(selectLatestFiling({ ...recent, form: ['10-K', '8-K'] }, ['10-Q', '10-K'])).toMatchObject({ accessionNumber: 'annual', form: '10-K' });
  });

  it('resolves an SEC ticker to CIK and constructs the primary filing URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('company_tickers_exchange')) {
        return new Response(JSON.stringify({ data: [[1321655, 'Palantir Technologies Inc.', 'PLTR', 'NYSE']] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        name: 'Palantir Technologies Inc.',
        filings: { recent: {
          accessionNumber: ['0001321655-26-000001'],
          form: ['10-Q'],
          filingDate: ['2026-05-08'],
          primaryDocument: ['pltr-20260331.htm'],
        } },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const http = new OfficialHttpClient({
      allowedHosts: ['www.sec.gov', 'data.sec.gov'],
      userAgent: 'JP Invest test@example.com',
      logPath: path.join(directory, 'outbound.log'),
      fetchImpl,
      sleep: async () => undefined,
      now: (() => { let current = 1_000; return () => current += 1_000; })(),
    });
    const outcome = await new SecAdapter(http, 'JP Invest test@example.com').discover({
      market: 'US', ticker: 'PLTR', documentTypes: ['10-Q', '10-K'],
    });
    expect(outcome).toMatchObject({
      kind: 'found',
      value: [{
        documentId: '0001321655-26-000001',
        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1321655/000132165526000001/pltr-20260331.htm',
      }],
    });
  });

  it('maps an official IDX financial-report announcement and normalizes its attachment host', () => {
    const json = JSON.stringify({ Replies: [{
      pengumuman: { Id2: 42, Kode_Emiten: 'BBRI', TglPengumuman: '2026-04-30T08:00:00Z', JudulPengumuman: 'Laporan Keuangan Q1' },
      attachments: [{ FullSavePath: 'https://www.idx.co.id/StaticData/NewsAndAnnouncement/BBRI-Q1-2026.pdf' }],
    }] });
    expect(parseIdxAnnouncements(json, 'BBRI')).toContainEqual(expect.objectContaining({
      ticker: 'BBRI',
      publishDate: '2026-04-30',
      sourceFormat: 'pdf',
      sourceUrl: 'https://www.idx.id/StaticData/NewsAndAnnouncement/BBRI-Q1-2026.pdf',
    }));
    expect(normalizeIdxAttachmentUrl('https://example.com/StaticData/BBRI.pdf')).toBeNull();
    expect(normalizeIdxAttachmentUrl('https://www.idx.co.id/files/BBRI.pdf')).toBeNull();
  });

  it('keeps issuer discovery on the configured origin and selects report PDFs only', () => {
    const html = '<a href="/reports/financial-20260430.pdf">Financial report 20260430</a><a href="https://tracker.test/go?redirect=https%3A%2F%2Fissuer.test%2Freports%2Fannual-report-2025.pdf">Download report</a><a href="https://evil.test/report.pdf">Report</a><a href="/about.pdf">About</a>';
    expect(discoverIssuerDocuments(html, 'https://issuer.test/investor', { market: 'ID', ticker: 'BBRI', documentTypes: [] }))
      .toEqual([
        expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/financial-20260430.pdf', publishDate: '2026-04-30' }),
        expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/annual-report-2025.pdf' }),
      ]);
  });

  // M007 Class A. Deliberately does NOT reuse discoverIssuerDocuments's test
  // fixture verbatim: press releases must be found without a .pdf extension
  // (unlike official filings) and must always carry sourceTier 'secondary',
  // never 'official' — the whole reason this is a sibling function.
  it('discovers HTML press releases without requiring a .pdf extension, always tagged secondary', () => {
    const html = '<a href="/press/q1-2026-update">Q1 2026 business update press release</a><a href="/reports/financial-20260430.pdf">Financial report</a><a href="https://evil.test/press/fake">Press release</a>';
    const found = discoverIssuerPressReleases(html, 'https://issuer.test/newsroom', { market: 'ID', ticker: 'BBRI', documentTypes: [] });
    expect(found).toEqual([
      expect.objectContaining({ sourceUrl: 'https://issuer.test/press/q1-2026-update', sourceTier: 'secondary', sourceFormat: 'html' }),
    ]);
    // The financial-report link matches REPORT_TERMS's domain, not PRESS_RELEASE_TERMS
    // ("financial" alone isn't a press-release term) — confirms this function
    // uses its own term list, not IssuerAdapter's.
    expect(found.some((item) => item.sourceUrl.includes('financial-20260430'))).toBe(false);
    expect(found.every((item) => item.sourceTier === 'secondary')).toBe(true);
  });

  // M010 (R-026). The listing-page guard. Before this, the only constraint was
  // "same-origin link whose ENCLOSING CONTAINER's 2 KB of text mentions a
  // press-release term" — near-vacuous on any page whose sidebar says "Berita".
  // On the real TLKM newsroom that returned 29 refs whose first 13 were junk,
  // with [0] being the discovery page itself; since the pipeline fetches only
  // discovery.value[0], the system fetched a listing page and mined it for
  // evidence. The official path never had this defect only because
  // discoverIssuerDocuments requires a .pdf extension.
  describe('listing-page guard (M010)', () => {
    const listing = 'https://issuer.test/sites/berita/id_ID/page/news-122';
    const query = { market: 'ID' as const, ticker: 'TLKM', documentTypes: [] };

    it('rejects a self-link back to the discovery page, including bare-hash variants', () => {
      const html = `<a href="/sites/berita/id_ID/page/news-122">Berita</a>
        <a href="/sites/berita/id_ID/page/news-122#search">Berita</a>
        <a href="#">Berita</a>
        <a href="/sites/berita/id_ID/news/telkom-siaran-pers-real-article-3827">Siaran Pers Telkom</a>`;
      const found = discoverIssuerPressReleases(html, listing, query);
      expect(found.map((item) => item.sourceUrl)).toEqual([
        'https://issuer.test/sites/berita/id_ID/news/telkom-siaran-pers-real-article-3827',
      ]);
    });

    it('rejects pagination and category query-variants of the listing page', () => {
      const html = `<a href="/sites/berita/id_ID/page/news-122?page=2">Berita 2</a>
        <a href="/sites/berita/id_ID/page/news-122?kategori=csr">Berita CSR</a>
        <a href="/sites/berita/id_ID/news/siaran-pers-genuine-3827">Siaran Pers Genuine</a>`;
      expect(discoverIssuerPressReleases(html, listing, query).map((item) => item.sourceUrl)).toEqual([
        'https://issuer.test/sites/berita/id_ID/news/siaran-pers-genuine-3827',
      ]);
    });

    it('rejects an ancestor of the listing path without rejecting shallower real articles', () => {
      // Deliberately not a path-DEPTH rule: the real articles here are
      // shallower than the listing page, so depth filtering would delete them.
      const html = `<a href="/sites/berita/id_ID">Berita</a>
        <a href="/sites/berita/id_ID/news/siaran-pers-genuine-3827">Siaran Pers Genuine</a>`;
      expect(discoverIssuerPressReleases(html, listing, query).map((item) => item.sourceUrl)).toEqual([
        'https://issuer.test/sites/berita/id_ID/news/siaran-pers-genuine-3827',
      ]);
    });

    it('treats a link repeated across the document as site chrome', () => {
      // On the real page every nav link appeared 2-5x (desktop + mobile menus)
      // and all 9 genuine article links appeared exactly once. This is the only
      // rule reaching chrome whose URL shape is article-like.
      const html = `<a href="/sites/berita/id_ID/news/berita-chrome-link-1">Berita</a>
        <a href="/sites/berita/id_ID/news/berita-chrome-link-1">Berita</a>
        <a href="/sites/berita/id_ID/news/siaran-pers-genuine-3827">Siaran Pers Genuine</a>`;
      expect(discoverIssuerPressReleases(html, listing, query).map((item) => item.sourceUrl)).toEqual([
        'https://issuer.test/sites/berita/id_ID/news/siaran-pers-genuine-3827',
      ]);
    });

    it('requires the press-release term on the link itself, not merely in its container', () => {
      const html = `<section class="news"><h2>Siaran Pers</h2>
        <a href="/sites/profil/id_ID/page/tentang-kami">Tentang Kami</a>
        <a href="/sites/berita/id_ID/news/siaran-pers-genuine-3827">Siaran Pers Genuine</a>
      </section>`;
      expect(discoverIssuerPressReleases(html, listing, query).map((item) => item.sourceUrl)).toEqual([
        'https://issuer.test/sites/berita/id_ID/news/siaran-pers-genuine-3827',
      ]);
    });

    it('parses Indonesian and English month-name dates and orders newest first', () => {
      // publishDate was always null in practice: the previous regex matched
      // only 2026-07-21-shaped dates while real anchors read "21 Juli 2026",
      // so there was no recency signal to order by.
      const html = `<li><a href="/berita/siaran-pers-older-1">Siaran Pers Older</a> 6 Juli 2026</li>
        <li><a href="/berita/siaran-pers-newest-2">Siaran Pers Newest</a> 21 Juli 2026</li>
        <li><a href="/berita/siaran-pers-middle-3">Siaran Pers Middle</a> 17 July 2026</li>`;
      const found = discoverIssuerPressReleases(html, listing, query);
      expect(found.map((item) => item.publishDate)).toEqual(['2026-07-21', '2026-07-17', '2026-07-06']);
    });

    it('dedupes identical URLs so the caller\'s 20-result cap is not filled with repeats', () => {
      const html = `<a href="/berita/siaran-pers-a">Siaran Pers A</a>
        <a href="/berita/siaran-pers-a?utm_source=x">Siaran Pers A</a>`;
      const found = discoverIssuerPressReleases(html, listing, query);
      expect(new Set(found.map((item) => item.sourceUrl)).size).toBe(found.length);
    });
  });

  // M007 Class B.
  describe('news wire feed parsing and discovery', () => {
    it('parses RSS items', () => {
      const rss = `<?xml version="1.0"?><rss><channel>
        <item><title>PLTR reports strong quarter</title><link>https://wire.test/pltr-strong-quarter</link><pubDate>Fri, 25 Jul 2026 10:00:00 GMT</pubDate><description>Palantir (PLTR) update.</description></item>
        <item><title>Unrelated market news</title><link>https://wire.test/unrelated</link><pubDate>Fri, 25 Jul 2026 09:00:00 GMT</pubDate><description>No ticker mentioned.</description></item>
      </channel></rss>`;
      const items = parseNewsFeedItems(rss, 'application/rss+xml');
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ title: 'PLTR reports strong quarter', link: 'https://wire.test/pltr-strong-quarter' });
    });

    it('parses Atom entries', () => {
      const atom = `<?xml version="1.0"?><feed>
        <entry><title>BBRI update</title><link href="https://wire.test/bbri-update"/><updated>2026-07-25T10:00:00Z</updated><summary>BBRI news.</summary></entry>
      </feed>`;
      const items = parseNewsFeedItems(atom, 'application/atom+xml');
      expect(items).toEqual([expect.objectContaining({ title: 'BBRI update', link: 'https://wire.test/bbri-update' })]);
    });

    it('parses a JSON feed', () => {
      const json = JSON.stringify({ items: [{ title: 'PLTR note', link: 'https://wire.test/pltr-note', pubDate: '2026-07-25' }] });
      const items = parseNewsFeedItems(json, 'application/json');
      expect(items).toEqual([expect.objectContaining({ title: 'PLTR note', link: 'https://wire.test/pltr-note' })]);
    });

    it('filters discovered items by ticker and tags them secondary_news-eligible (sourceTier secondary)', async () => {
      const rss = `<rss><channel>
        <item><title>PLTR reports strong quarter</title><link>https://wire.test/pltr-strong-quarter</link><pubDate>Fri, 25 Jul 2026 10:00:00 GMT</pubDate><description>Palantir update.</description></item>
        <item><title>Unrelated market news</title><link>https://wire.test/unrelated</link><pubDate>Fri, 25 Jul 2026 09:00:00 GMT</pubDate><description>No ticker mentioned.</description></item>
      </channel></rss>`;
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(rss, { status: 200, headers: { 'content-type': 'application/rss+xml' } }));
      const client = clientWith(fetchImpl, directory, ['wire.test']);
      const adapter = new NewsWireAdapter({ 'Mock Wire': 'https://wire.test/feed.xml' }, { 'https://wire.test': client });

      const outcome = await adapter.discover({ market: 'US', ticker: 'PLTR', documentTypes: [] });
      expect(outcome).toMatchObject({
        kind: 'found',
        value: [expect.objectContaining({ sourceUrl: 'https://wire.test/pltr-strong-quarter', sourceTier: 'secondary', sourceName: 'Mock Wire' })],
      });
      if (outcome.kind === 'found') {
        expect(outcome.value.some((item) => item.sourceUrl.includes('unrelated'))).toBe(false);
      }
    });

    it('does not let one broken feed block matches from another configured feed', async () => {
      const workingRss = '<rss><channel><item><title>PLTR update</title><link>https://good.test/pltr</link><pubDate>Fri, 25 Jul 2026 10:00:00 GMT</pubDate><description>d</description></item></channel></rss>';
      const fetchImpl = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.includes('broken.test')) return new Response('boom', { status: 500 });
        return new Response(workingRss, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
      });
      const client = clientWith(fetchImpl, directory, ['broken.test', 'good.test']);
      const adapter = new NewsWireAdapter(
        { 'Broken Wire': 'https://broken.test/feed.xml', 'Good Wire': 'https://good.test/feed.xml' },
        { 'https://broken.test': client, 'https://good.test': client },
      );

      const outcome = await adapter.discover({ market: 'US', ticker: 'PLTR', documentTypes: [] });
      expect(outcome).toMatchObject({ kind: 'found', value: [expect.objectContaining({ sourceUrl: 'https://good.test/pltr' })] });
    });

    it('reports unavailable, never throws, when no configured feed mentions the ticker', async () => {
      const rss = '<rss><channel><item><title>Unrelated</title><link>https://wire.test/unrelated</link><description>d</description></item></channel></rss>';
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(rss, { status: 200, headers: { 'content-type': 'application/rss+xml' } }));
      const client = clientWith(fetchImpl, directory, ['wire.test']);
      const adapter = new NewsWireAdapter({ 'Mock Wire': 'https://wire.test/feed.xml' }, { 'https://wire.test': client });

      const outcome = await adapter.discover({ market: 'US', ticker: 'PLTR', documentTypes: [] });
      expect(outcome).toMatchObject({ kind: 'unavailable', code: 'news_wire_source_unavailable' });
    });
  });

  it('blocks non-allowlisted URLs before fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = clientWith(fetchImpl, directory);
    await expect(client.get('https://example.com/source', 'text/html')).rejects.toMatchObject({ code: 'source_redirect_blocked' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks redirects outside the allowlist', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/escape' },
    }));
    const client = clientWith(fetchImpl, directory);
    await expect(client.get('https://www.sec.gov/start', 'text/html')).rejects.toMatchObject({ code: 'source_redirect_blocked' });
  });

  it('retries transient responses and caches a successful result', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('<p>ok</p>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const client = clientWith(fetchImpl, directory);
    const first = await client.get('https://www.sec.gov/document', 'text/html');
    const second = await client.get('https://www.sec.gov/document', 'text/html');
    expect(new TextDecoder().decode(first.bytes)).toBe('<p>ok</p>');
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('classifies repeated aborts as a source timeout', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'AbortError';
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/slow', 'text/html'))
      .rejects.toMatchObject({ code: 'source_timeout' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('rejects a response that declares an oversized document', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('small', {
      status: 200,
      headers: { 'content-length': String(26 * 1024 * 1024) },
    }));
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/large', 'text/html'))
      .rejects.toMatchObject({ code: 'source_too_large' });
  });
});

function clientWith(fetchImpl: typeof fetch, directory: string, allowedHosts: string[] = ['www.sec.gov']) {
  return new OfficialHttpClient({
    allowedHosts,
    userAgent: 'JP Invest test@example.com',
    logPath: path.join(directory, 'outbound.log'),
    fetchImpl,
    sleep: async () => undefined,
    now: (() => { let current = 1_000; return () => current += 1_000; })(),
    random: () => 0,
  });
}
