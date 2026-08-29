import { load } from 'cheerio';
import type { OfficialHttpClient } from '../http';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

/*
 * Adjacent-token-pair matching, not substring-with-hardcoded-separator: one
 * mechanism serves both the Tier 1 phrase check (financial+report,
 * laporan+keuangan) and the Info Memo type override (info+memo).
 * Separator-agnostic by construction (tokenizer discards every non-alnum
 * character), so "Laporan_Keuangan", "Laporan.Keuangan" and
 * "Laporan Keuangan" all match without a hardcoded variant for each.
 *
 * Percent-decoding first is load-bearing, not hygiene. Telkom's real report
 * URLs carry spaces as `%20` — `.../Laporan%20Tahunan%20Telkom%202023.pdf`.
 * Tokenized raw, the `20` of each escape becomes its own segment sitting
 * BETWEEN the two words, so `laporan` is followed by `20`, not `tahunan`,
 * and every adjacent-pair check fails. Measured against the real corpus in
 * `d:/jp-invest-data/db.sqlite`: five of six retained TLKM documents,
 * including the 24.3 MB Laporan Tahunan 2023 this milestone exists to
 * recover, classified `exclude` before this line existed. The whole unit
 * suite missed it because every fixture used a clean hyphenated basename and
 * none used a real URL.
 */
function rawSegments(context: string): string[] {
  let decoded = context;
  // Malformed escapes ("100%20off" is fine, "50% off" is not) throw here.
  // A URL that cannot be decoded is tokenized as-is rather than dropped.
  try { decoded = decodeURIComponent(context); } catch { /* keep raw */ }
  return decoded.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/*
 * A reporting period or a filing-form code. Tier 1 requires one IN ADDITION
 * to a document-class signal (see `classifyIssuerDocument`).
 *
 * The convention this encodes: a statutory filing is always bound to a
 * reporting period, because that is what makes it a filing rather than a
 * document about filings. A guide, a template, or an internal handbook
 * carries the same vocabulary but no period — which is precisely how
 * `edgar-filing-guide.pdf`, `annual-report-template.pdf` and
 * `pedoman-konsolidasian-internal.pdf` used to reach Tier 1.
 *
 * Two-digit period forms (`3q25`, `1h26`, `9m25`, `fy25`) are recognized
 * only when glued to a quarter/half/month/FY marker, never as a bare
 * two-digit number — `TLKM-2025AR-fullbook-54-00-hires.pdf` carries `54` and
 * `00`, and treating those as years would readmit everything this rule is
 * meant to exclude.
 */
const PERIOD_PATTERNS = [
  /^20\d{2}$/,                              // 2026
  /^20\d{4}$/,                              // 202605   (YYYYMM)
  /^20\d{6}$/,                              // 20260512 (YYYYMMDD, EDGAR style)
  /^(?:[1-4]q|q[1-4])(?:20)?\d{2}$/,        // 3q25, q325, 1q2026, q12021
  /^(?:[12]h|h[12])(?:20)?\d{2}$/,          // 1h25, h125, 1h2026
  /^(?:3|6|9|12)m(?:20)?\d{2}$/,            // 9m25, 9m2025
  /^fy(?:20)?\d{2}$/,                       // fy25, fy2025
  /^(?:[1-4]q|q[1-4]|[12]h|h[12]|fy)$/,     // bare Q3 / 1H / FY, year given elsewhere
];

function hasPeriodMarker(segments: string[], tokens: Set<string>): boolean {
  return [...tokens].some((t) => PERIOD_PATTERNS.some((pattern) => pattern.test(t)))
    || segments.some((s) => PERIOD_PATTERNS.some((pattern) => pattern.test(s)));
}

// Glue-split ONLY the exact pattern {4-digit-year}{2-letter-abbrev} or the
// reverse ("2025ar", "ar2024") — never a generic letter<->digit alternation
// over every token, which would fragment a random hash/UUID segment like
// "ar4b91" into a spurious standalone "ar" token.
function expandGluedYearAbbrev(segments: string[]): Set<string> {
  const tokens = new Set(segments);
  for (const seg of segments) {
    const m = seg.match(/^(20\d{2})([a-z]{2})$/) ?? seg.match(/^([a-z]{2})(20\d{2})$/);
    if (!m) continue;
    const [, a, b] = m;
    tokens.add(/^\d+$/.test(a) ? a : b);
    tokens.add(/^\d+$/.test(a) ? b : a);
  }
  return tokens;
}

function hasAdjacentPair(segments: string[], a: string, b: string): boolean {
  return segments.some((seg, i) => seg === a && segments[i + 1] === b);
}

// Recognizes SEC EDGAR form codes both hyphen-separated (Telkom's own style:
// "...-6-K-EDGAR.pdf" -> segments ['6','k','edgar']) and glued (another
// issuer's style: "Form_6K_....pdf" -> segment '6k'). Never exposes a bare
// 'k'/'f' token to TIER1_SHORT_TOKENS.
function hasSecFormCode(segments: string[]): boolean {
  const glued = /^(6-?k|20-?f|10-?k|10-?q)$/;
  return segments.some((seg, i) =>
    glued.test(seg)
    || (seg === '6' && segments[i + 1] === 'k')
    || (seg === '20' && segments[i + 1] === 'f')
    || (seg === '10' && (segments[i + 1] === 'k' || segments[i + 1] === 'q')));
}

const TIER1_PHRASE_PAIRS: [string, string][] = [
  ['financial', 'statement'], ['financial', 'report'],
  ['laporan', 'keuangan'], ['laporan', 'tahunan'], ['laporan', 'keberlanjutan'],
  ['annual', 'report'], ['sustainability', 'report'],
];

// Deliberately no 'audited': "unaudited".includes("audited") matches too, so
// it never actually discriminates, and every real case is already covered by
// a phrase pair or a short token. Deliberately no bare 'investor'/'laporan'/
// 'report' alone — those generic words are what let "Investor
// Presentation.pdf" or "Laporan Kegiatan CSR.pdf" slip into the original
// REPORT_TERMS list. Deliberately no 'edgar' either: EDGAR is a filing
// SYSTEM, not a document class, so `edgar-filing-guide.pdf` used to satisfy
// Tier 1 on that word alone. The form code itself (`hasSecFormCode`) is the
// real class signal, and it does not depend on the word appearing.
const TIER1_WORDS = ['konsolidasian', 'consolidated'];
const TIER1_SHORT_TOKENS = new Set(['fs', 'lk', 'ar', 'sr', 'tw']);

// Marks a document as a derivative/marketing excerpt rather than the primary
// statutory filing. Checked BEFORE the Tier 1 positive signals, so a
// filename that echoes statutory vocabulary but is actually a deck never
// reaches Tier 1 by that echo alone.
//
// Format words only. `update`, `brief` and `highlights` were removed after
// review: they describe CONTENT and attach legitimately to real filings
// ("regulatory update", "financial highlights"), so hard-excluding them costs
// recall on documents that belong in Tier 1. The period/form requirement now
// carries the precision those three were compensating for.
const DERIVATIVE_MODIFIERS = new Set([
  'presentation', 'roadshow', 'ndr', 'deck', 'summary',
  'snapshot', 'teaser', 'factsheet',
]);

/**
 * tier1 -> exact_verified-eligible statutory/regulatory filing.
 * tier2 -> Info Memo / IR-authored operational summary (DEC-0015 Class A).
 * exclude -> marketing/roadshow deck, or no recognized signal at all.
 *
 * `IssuerAdapter` below only ever emits tier1. It is wired in `service.ts`
 * to a `CitationPipeline` instance constructed with the default
 * `evidenceClass: 'official'` — a static, per-instance constant read once at
 * construction (`pipeline.ts:126-130`), NOT re-read per document from
 * `sourceTier`. A document tagged `sourceTier: 'secondary'` from THIS
 * adapter would still be extracted through `extractDeterministicCandidates`,
 * the lenient `exact_verified`-eligible path — silently defeating DEC-0015
 * §2.2's structural promotion barrier (R-010). Tier 2 is emitted only by
 * `IssuerInfoMemoAdapter` (`./issuer-info-memo.ts`), wired to the existing
 * `evidenceClass: 'secondary_issuer'` pipeline instead.
 */
export function classifyIssuerDocument(context: string): 'tier1' | 'tier2' | 'exclude' {
  const segments = rawSegments(context);
  const tokens = expandGluedYearAbbrev(segments);

  if (hasAdjacentPair(segments, 'info', 'memo')) return 'tier2';
  if (segments.some((s) => DERIVATIVE_MODIFIERS.has(s))) return 'exclude';

  /*
   * Tier 1 needs BOTH halves: what the document is, and which period it
   * reports. Either alone admits documents that merely talk about filings —
   * a template, a guide, an internal handbook — which is what the
   * single-signal rule did. The user chose this methodology on 2026-08-29
   * over an alternative that chased the same cases with a longer deny-list.
   *
   * A SEC form code satisfies the class half; it is also accepted as the
   * period half, because a form code names the filing obligation itself
   * (a 6-K is an event filing, a 20-F an annual one) rather than describing
   * a document about one.
   */
  const formCode = hasSecFormCode(segments);
  const documentClass = formCode
    || TIER1_PHRASE_PAIRS.some(([a, b]) => hasAdjacentPair(segments, a, b))
    || TIER1_WORDS.some((w) => segments.includes(w))
    || [...TIER1_SHORT_TOKENS].some((t) => tokens.has(t));
  const periodOrForm = formCode || hasPeriodMarker(segments, tokens);

  return documentClass && periodOrForm ? 'tier1' : 'exclude';
}

export class IssuerAdapter implements SourceAdapter {
  readonly mode = 'live' as const;
  constructor(private readonly sourceUrls: Record<string, string>, private readonly clients: Record<string, OfficialHttpClient>) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    const startUrl = this.sourceUrls[query.ticker.toUpperCase()];
    if (!startUrl) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: `No trusted issuer source is configured for ${query.ticker}.` };
    const origin = new URL(startUrl).origin;
    const client = this.clients[origin];
    if (!client) return { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'Issuer domain is not allowlisted.' };
    try {
      const first = await client.get(startUrl, 'text/html,application/xhtml+xml');
      const documents = discoverIssuerDocuments(new TextDecoder().decode(first.bytes), first.url, query);
      return documents.length ? { kind: 'found', value: documents.slice(0, 20) } : { kind: 'unavailable', code: 'issuer_source_unavailable', message: 'The official issuer page exposed no eligible report document.' };
    } catch (error) {
      const outcome = unavailableOutcome<SourceDocumentRef[]>(error, 'Issuer official source failed.');
      return { kind: 'unavailable', code: outcome.kind === 'unavailable' && outcome.code === 'source_too_large' ? 'crawl_limit_exceeded' : 'issuer_source_unavailable', message: outcome.kind === 'found' ? 'Issuer official source failed.' : outcome.message };
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    const client = this.clients[new URL(document.sourceUrl).origin];
    if (!client) return { kind: 'unavailable', code: 'source_access_denied', message: 'Issuer document left the trusted issuer domain.' };
    try {
      const result = await client.get(document.sourceUrl, 'application/pdf,text/html;q=0.9');
      return { kind: 'found', value: { ...document, sourceUrl: result.url, sourceFormat: result.contentType === 'application/pdf' || result.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html', rawBytes: result.bytes, retrievalTimestamp: new Date().toISOString(), contentType: result.contentType, httpStatus: result.status } };
    } catch (error) { return unavailableOutcome(error, 'Issuer official document fetch failed.'); }
  }
}

export function discoverIssuerDocuments(html: string, pageUrl: string, query: SourceQuery): SourceDocumentRef[] {
  const page = new URL(pageUrl);
  const $ = load(html);
  const found: SourceDocumentRef[] = [];
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    let url: URL;
    try { url = new URL(href, pageUrl); } catch { return; }
    const redirected = url.searchParams.get('redirect');
    if (redirected) {
      try {
        const target = new URL(redirected);
        if (normalizeHost(target.hostname) === normalizeHost(page.hostname)) url = target;
      } catch { return; }
    }
    if (url.protocol !== 'https:' || normalizeHost(url.hostname) !== normalizeHost(page.hostname) || !url.pathname.toLowerCase().endsWith('.pdf')) return;
    const container = $(element).closest('tr, article, li, section, [class*="report"], [class*="financial"]');
    const containerText = container.length ? container.first().text().slice(0, 2_000) : '';
    /*
     * Classification reads the LINK ONLY — its own text, title, image alt,
     * and basename — never the enclosing container. The same rule
     * `discoverIssuerPressReleases` states as its Rule 1, and for a sharper
     * reason here: with a container in scope, one `<section>` holding a
     * financial statement beside an Info Memo gave BOTH links the combined
     * text, and the `info memo` override fires first. Proven against the
     * real code before this change: the statutory FS link classified `tier2`
     * and vanished from the official lane entirely, silently, with no error.
     *
     * Container text stays in play for date extraction only, where a
     * neighbour's date is a wrong value rather than a lost document.
     */
    const basename = url.pathname.split('/').at(-1) ?? '';
    const linkContext = `${$(element).text()} ${$(element).attr('title') ?? ''} ${$(element).find('img').attr('alt') ?? ''} ${basename}`.toLowerCase();
    // Only tier1 is ever minted here — see classifyIssuerDocument's doc
    // comment for why tier2 must never be emitted from this adapter.
    if (classifyIssuerDocument(linkContext) !== 'tier1') return;
    const date = `${linkContext} ${containerText.toLowerCase()}`.match(/(20\d{2})[-_/]?(0[1-9]|1[0-2])[-_/]?([0-2]\d|3[01])/);
    found.push({ documentId: url.pathname.split('/').at(-1) || url.toString(), market: query.market, ticker: query.ticker.toUpperCase(), sourceUrl: url.toString(), sourceName: `Issuer official (${query.ticker.toUpperCase()})`, sourceTier: 'official', publishDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null, sourceFormat: 'pdf', discoveryUrl: pageUrl });
  });
  return found;
}

function normalizeHost(host: string) { return host.toLowerCase().replace(/^www\./, ''); }
