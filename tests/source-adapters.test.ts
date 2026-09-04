import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeIdxAttachmentUrl, parseIdxAnnouncements } from '@/lib/research/adapters/idx';
import { classifyIssuerDocument, discoverIssuerDocuments } from '@/lib/research/adapters/issuer';
import { discoverIssuerInfoMemos } from '@/lib/research/adapters/issuer-info-memo';
import { discoverIssuerPressReleases, isIssuerReleaseUrl } from '@/lib/research/adapters/issuer-press';
import { NewsWireAdapter, parseNewsFeedItems } from '@/lib/research/adapters/news-wire';
import { SecAdapter, selectLatestFiling } from '@/lib/research/adapters/sec';
import { OfficialHttpClient, resetHttpStateForTests } from '@/lib/research/http';
import { SOURCE_BYTE_LIMIT } from '@/lib/research/adapters/types';

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

  /*
   * M013 follow-on step 6. Types lining up proves nothing about whether the
   * value actually reaches the row — the column has a default, so a missed
   * wiring degrades silently to 'unknown'. Both titles are verbatim from
   * IDX's announcement API for TLKM, and they are the exact pair the
   * assurance axis exists to tell apart: same issuer, same document class,
   * same tier1 classification, opposite audit status.
   */
  it('carries assurance from the IDX announcement title onto the document ref', () => {
    const announcement = (title: string) => JSON.stringify({ Replies: [{
      pengumuman: { Id2: 9, Kode_Emiten: 'TLKM'.padEnd(100, ' '), TglPengumuman: '2026-05-29T00:00:00Z', JudulPengumuman: title },
      attachments: [{ FullSavePath: 'https://www.idx.co.id/StaticData/NewsAndAnnouncement/FS-2026-I-TLKM.pdf' }],
    }] });

    expect(parseIdxAnnouncements(announcement('Penyampaian Laporan Keuangan Interim Yang Tidak Diaudit'), 'TLKM')[0])
      .toMatchObject({ assuranceLevel: 'unaudited', sourceTier: 'official' });
    expect(parseIdxAnnouncements(announcement('Penyampaian Laporan Keuangan Tahunan'), 'TLKM')[0])
      .toMatchObject({ assuranceLevel: 'audited', sourceTier: 'official' });
  });

  /*
   * The live IDX API returns `Kode_Emiten` as a fixed-width CHAR(100) — "TLKM"
   * followed by 96 spaces — so the exact `!==` comparison dropped every row
   * before it could reach the title-term check. Measured 2026-09-03 against the
   * real endpoint: 100 announcements returned, 11 titles matching REPORT_TERMS,
   * every attachment URL valid, and 100/100 discarded at that first gate. The
   * adapter then fell back to the issuer path silently, so 67 live calls between
   * 2026-07-05 and 2026-09-03 all returned HTTP 200 and produced zero documents,
   * zero snapshots and zero evidence. Every fixture above used an unpadded code
   * and stayed green throughout — the same fixture-green/live-failing shape this
   * milestone already hit once on the official path.
   */
  it('maps an IDX announcement whose Kode_Emiten is space-padded to fixed width', () => {
    const json = JSON.stringify({ Replies: [{
      pengumuman: { Id2: 7, Kode_Emiten: 'TLKM'.padEnd(100, ' '), TglPengumuman: '2026-07-31T08:00:00Z', JudulPengumuman: 'Penyampaian Laporan Keuangan Interim Yang Tidak Diaudit' },
      attachments: [{ FullSavePath: 'https://www.idx.co.id/StaticData/NewsAndAnnouncement/ANNOUNCEMENTSTOCK/From_EREP/202607/9fff6e0435_cb545ee9bf.pdf' }],
    }] });
    expect(parseIdxAnnouncements(json, 'TLKM')).toContainEqual(expect.objectContaining({
      ticker: 'TLKM',
      publishDate: '2026-07-31',
      sourceTier: 'official',
      sourceUrl: 'https://www.idx.id/StaticData/NewsAndAnnouncement/ANNOUNCEMENTSTOCK/From_EREP/202607/9fff6e0435_cb545ee9bf.pdf',
    }));
  });

  it('keeps issuer discovery on the configured origin and selects report PDFs only', () => {
    const html = '<a href="/reports/financial-20260430.pdf">Financial report 20260430</a><a href="https://tracker.test/go?redirect=https%3A%2F%2Fissuer.test%2Freports%2Fannual-report-2025.pdf">Download report</a><a href="https://evil.test/report.pdf">Report</a><a href="/about.pdf">About</a>';
    expect(discoverIssuerDocuments(html, 'https://issuer.test/investor', { market: 'ID', ticker: 'BBRI', documentTypes: [] }))
      .toEqual([
        expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/financial-20260430.pdf', publishDate: '2026-04-30' }),
        expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/annual-report-2025.pdf' }),
      ]);
  });

  // M013 follow-up: post-2024 Telkom renamed statutory filings to short
  // abbreviations (FS/LK/AR/SR/TW), which the old bare-word REPORT_TERMS
  // missed entirely. Filenames below are verbatim from the live Telkom IR
  // page (docs/milestones/M013...); each row is a real case, not a fixture
  // invented for coverage.
  describe('classifyIssuerDocument (post-2024 abbreviation + Info Memo tiering)', () => {
    it('tiers statutory filings as tier1 via short-token+year, without substring false-positives', () => {
      expect(classifyIssuerDocument('telkom-fs-bahasa-tw-ii-2026.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('tw-i-2026-fs-konsolidasian-telkom-bahasa.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('lk-konsolidasian-telkom-tahun-2025-audited-bahasa.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('fs telkom q3 2024_bahasa rilis.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('tlkm-2025ar-fullbook-54-00-hires.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('telkom_ar2024_in_39-01_fullbook_compressed.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('tlkm-2025sr-ind-16-00-lores.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('arsip-transformasi-telkomgroup-2025.pdf')).toBe('exclude');
    });

    it('tiers EDGAR-filed SEC forms as tier1 via the long-term list', () => {
      expect(classifyIssuerDocument('perusahaan-perseroan-tbk-20260512-6-k-edgar.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('perusahaan-perseroan-tbk-20260515-20-f-edgar.pdf')).toBe('tier1');
    });

    it('tiers Info Memo as tier2, even when the same filename also says "presentation"', () => {
      expect(classifyIssuerDocument('1q-2026-tlkm-corporate-presentation-info-memo.pdf')).toBe('tier2');
      expect(classifyIssuerDocument('tlkm-9m25-info-memo.pdf')).toBe('tier2');
      expect(classifyIssuerDocument('tlkm 1h25 info memo.pdf')).toBe('tier2');
    });

    it('excludes pure marketing/roadshow decks', () => {
      expect(classifyIssuerDocument('tlkm-fy25-corporate-presentation.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('9m25-infranexia-roadshow-presentation.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('tlkm-9m25-earnings-call-corporate-presentation.pdf')).toBe('exclude');
    });

    // Stress-test findings: precedence collisions, tokenization traps, and
    // cross-issuer portability beyond the Telkom-specific examples above.
    it('menolak deck derivatif meski memuat kosakata statutori (precedence)', () => {
      expect(classifyIssuerDocument('financial-report-2025-analyst-briefing-presentation.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('tlkm-2025-sustainability-report-highlights-deck.pdf')).toBe('exclude');
    });

    it('tidak menciptakan token singkatan palsu dari segmen mirip hash/UUID', () => {
      expect(classifyIssuerDocument('attachment-ar4b91-2026.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('report-9f2a71cd-fs-2026.pdf')).toBe('tier1'); // 'fs' segmen asli, bukan pecahan hash
    });

    it('portabel lintas emiten: BBRI, pemisah non-hyphen, dan Form 6-K tanpa kata "edgar"', () => {
      expect(classifyIssuerDocument('bbri_fs_2025_q3_unaudited.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('laporan_keuangan_konsolidasian_30_juni_2026.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('laporan.keuangan.konsolidasian.2026.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('form_6k_20260401.pdf')).toBe('tier1');
    });
  });

  // M013 follow-up: the pipeline-wiring finding — tier2 must live in its own
  // adapter, never inside discoverIssuerDocuments, because IssuerAdapter is
  // statically wired to an evidenceClass:'official' pipeline that never
  // re-reads sourceTier per document (service.ts:90, pipeline.ts:126-130).
  // This test proves the partition holds on one shared HTML fixture.
  describe('discoverIssuerInfoMemos (tier2 lives in its own adapter, not IssuerAdapter)', () => {
    const html = '<a href="/reports/telkom-fs-bahasa-tw-ii-2026.pdf">FS TW II 2026</a><a href="/reports/tlkm-9m25-info-memo.pdf">TLKM 9M25 Info Memo</a><a href="/reports/tlkm-fy25-corporate-presentation.pdf">Corporate Presentation</a>';
    const query = { market: 'ID' as const, ticker: 'TLKM', documentTypes: [] };

    it('discoverIssuerDocuments picks only the tier1 filing', () => {
      const found = discoverIssuerDocuments(html, 'https://issuer.test/investor', query);
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/telkom-fs-bahasa-tw-ii-2026.pdf', sourceTier: 'official' }));
    });

    it('discoverIssuerInfoMemos picks only the tier2 Info Memo, never the tier1 filing or the deck', () => {
      const found = discoverIssuerInfoMemos(html, 'https://issuer.test/investor', query);
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(expect.objectContaining({ sourceUrl: 'https://issuer.test/reports/tlkm-9m25-info-memo.pdf', sourceTier: 'secondary' }));
    });

    /*
     * Container bleed. Classification used to read up to 2 KB of the
     * enclosing container, so two links sharing one `<section>` were judged
     * on each other's text. Measured against the real code before the fix:
     * the statutory FS link classified `tier2` and the official lane
     * returned NOTHING — the milestone's own target document lost silently,
     * with no error, because a neighbouring anchor said "Info Memo".
     */
    it('a statutory filing sharing one container with an Info Memo stays in the official lane', () => {
      const shared = `<section>
        <a href="/reports/telkom-fs-bahasa-tw-ii-2026.pdf">Laporan Keuangan TW II 2026</a>
        <a href="/reports/tlkm-9m25-info-memo.pdf">TLKM 9M25 Info Memo</a>
      </section>`;
      expect(discoverIssuerDocuments(shared, 'https://issuer.test/investor', query).map((d) => d.sourceUrl))
        .toEqual(['https://issuer.test/reports/telkom-fs-bahasa-tw-ii-2026.pdf']);
      expect(discoverIssuerInfoMemos(shared, 'https://issuer.test/investor', query).map((d) => d.sourceUrl))
        .toEqual(['https://issuer.test/reports/tlkm-9m25-info-memo.pdf']);
    });
  });

  /*
   * Every pathname below is verbatim from `source_snapshots` in the real
   * database. They are here because the adjacent-token-pair rewrite broke on
   * all of them and no fixture caught it: Telkom encodes spaces as `%20`, so
   * `Laporan%20Tahunan` tokenized to ['laporan','20','tahunan'] and the pair
   * check failed with the escape's own digits sitting between the words.
   * Five of six real retained documents classified `exclude` — including the
   * 24.3 MB Laporan Tahunan 2023 that M013 exists to recover.
   */
  describe('classifyIssuerDocument against real percent-encoded issuer URLs', () => {
    it('classifies the retained TLKM corpus as tier1', () => {
      for (const pathname of [
        '/minio/show/data/lampiran/1711937200650_original_Laporan%20Tahunan%20Telkom%202023_website.pdf',
        '/minio/show/data/lampiran/1630362585390_Laporan%20Keuangan%20Konsolidasian%20TW%20II%202021%20Bahasa.pdf',
        '/minio/show/data/lampiran/1624856902971_Laporan%20Keuangan(unaudited)Q12021_Bahasa.pdf',
        '/minio/show/data/lampiran/1576308021506_Laporan%20Keuangan(Audited)%20FY%202018.pdf',
        '/minio/show/data/lampiran/1576307914162_Laporan%20Keuangan(Unaudited)%209M%202019.pdf',
        '/minio/show/data/lampiran/1711937336092_original_Laporan%20Keberlanjutan%20Telkom%202023_website.pdf',
        '/minio/show/data/lampiran/1650979879160_6K_Annual_Report_2021_htm.pdf',
      ]) {
        expect(classifyIssuerDocument(pathname.toLowerCase()), pathname).toBe('tier1');
      }
    });

    it('survives a malformed escape rather than throwing', () => {
      expect(classifyIssuerDocument('/reports/laporan-keuangan-50%-2026.pdf')).toBe('tier1');
    });
  });

  /*
   * Tier 1 requires a document class AND a reporting period or form code
   * (user methodology decision, 2026-08-29). Documents that merely talk
   * about filings carry the vocabulary but never a period.
   */
  describe('classifyIssuerDocument period/form requirement', () => {
    it('rejects guides, templates and handbooks that echo statutory vocabulary', () => {
      expect(classifyIssuerDocument('edgar-filing-guide.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('annual-report-template.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('pedoman-konsolidasian-internal.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('laporan-keuangan-panduan-pengisian.pdf')).toBe('exclude');
    });

    it('accepts two-digit period forms, which the year-only rule used to miss', () => {
      expect(classifyIssuerDocument('bbri-fs-3q25.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('tlkm-lk-1h26.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('telkom-fs-fy25.pdf')).toBe('tier1');
    });

    it('does not read a bare two-digit number as a period', () => {
      // The real TLKM annual report carries '54' and '00' as layout codes.
      expect(classifyIssuerDocument('tlkm-ar-fullbook-54-00-hires.pdf')).toBe('exclude');
      expect(classifyIssuerDocument('tlkm-2025ar-fullbook-54-00-hires.pdf')).toBe('tier1');
    });

    it('keeps content-descriptor words out of the deny-list so real filings survive', () => {
      // 'update' and 'highlights' describe content, not format, and attach to
      // legitimate filings — only format words are excluded.
      expect(classifyIssuerDocument('laporan-keuangan-2026-update.pdf')).toBe('tier1');
      expect(classifyIssuerDocument('tlkm-2025-sustainability-report-highlights-deck.pdf')).toBe('exclude');
    });
  });

  /*
   * The single-URL form of the eligibility judgment, used by Class-C promotion
   * (`promoteCandidate`), which has no listing page to reason about. All four
   * URLs below are verbatim from the live database, where every one of them
   * had been stored as "Web-discovered issuer release" on origin match alone.
   */
  it('recognises a direct issuer release by URL and rejects homepages and IR index pages', () => {
    const release = 'https://www.telkom.co.id/sites/berita/id_ID/news/transformasi-telkomgroup-mulai-tunjukkan-hasil';
    expect(isIssuerReleaseUrl(new URL(release))).toBe(true);

    for (const notARelease of [
      'https://www.telkom.co.id/',
      'https://www.telkom.co.id/sites/hubungan-investor/id_ID/page/laporan-1025',
      'https://www.telkom.co.id/sites/investor-relations/en_US/page/financial-highlights-542',
    ]) {
      expect(isIssuerReleaseUrl(new URL(notARelease))).toBe(false);
    }
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
      headers: { 'content-length': String(SOURCE_BYTE_LIMIT + 1) },
    }));
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/large', 'text/html'))
      .rejects.toMatchObject({ code: 'source_too_large' });
  });

  /*
   * M013 Slice 2. The download limit was 25 MB while extraction refused
   * anything over 10 MB, so real issuer documents were fetched and stored and
   * then discarded unread. Both limits are now one constant; a document under
   * it must be accepted here.
   */
  it('accepts a document declared under the shared byte limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('report body', {
      status: 200,
      headers: { 'content-length': String(26 * 1024 * 1024), 'content-type': 'application/pdf' },
    }));
    const result = await clientWith(fetchImpl, directory).get('https://www.sec.gov/annual', 'application/pdf');
    expect(result.status).toBe(200);
  });

  /*
   * ADR-0006 transparency. Every other rejection path logged before throwing;
   * these two did not, so `logs/outbound.log` showed nothing at all for a
   * size failure. That silence actively misled M013's own diagnosis — the log
   * looked clean while six jobs were failing on size.
   */
  it('logs a size rejection instead of throwing silently', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('small', {
      status: 200,
      headers: { 'content-length': String(SOURCE_BYTE_LIMIT + 1) },
    }));
    const logPath = path.join(directory, 'outbound.log');
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/large', 'text/html'))
      .rejects.toMatchObject({ code: 'source_too_large' });
    expect(fs.readFileSync(logPath, 'utf8')).toContain('source_too_large');
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
