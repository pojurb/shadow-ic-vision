import { getIssuerPressReleaseUrls, getIssuerSourceUrls, getNewsWireFeedUrls, getOutboundLogPath, getResearchSourceMode } from '../config';
import { OfficialHttpClient } from '../http';
import { IdxAdapter } from './idx';
import { IssuerAdapter } from './issuer';
import { IssuerPressReleaseAdapter } from './issuer-press';
import { MockIdxAdapter } from './mock-idx';
import { MockSecXbrlFactSource } from './mock-sec-xbrl';
import { SecCompanyConceptSource, type XbrlFactSource } from './sec-xbrl';
import { MockIssuerPressReleaseAdapter } from './mock-issuer-press';
import { MockNewsWireAdapter } from './mock-news-wire';
import { MockSecAdapter } from './mock-sec';
import { NewsWireAdapter } from './news-wire';
import { SecAdapter } from './sec';
import { SOURCE_BYTE_LIMIT, type ResearchMarket, type SourceAdapter } from './types';

export function createSourceAdapters(): Record<ResearchMarket, SourceAdapter> {
  if (getResearchSourceMode() === 'mock') return { US: new MockSecAdapter(), ID: new MockIdxAdapter() };

  const logPath = getOutboundLogPath();
  const secUserAgent = process.env.SEC_USER_AGENT ?? '';
  const issuerUrls = getIssuerSourceUrls();
  const issuerClients = Object.fromEntries([...new Set(Object.values(issuerUrls).map((value) => new URL(value).origin))].flatMap((origin) => {
    const host = new URL(origin).hostname;
    const alternateHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const client = new OfficialHttpClient({ allowedHosts: [host, alternateHost], userAgent: 'JP Invest official-source research', logPath, requestsPerSecond: 2, maxBytes: SOURCE_BYTE_LIMIT });
    return [[origin, client], [`https://${alternateHost}`, client]];
  }));
  const issuerAdapter = new IssuerAdapter(issuerUrls, issuerClients);
  return {
    US: new SecAdapter(new OfficialHttpClient({
      allowedHosts: ['www.sec.gov', 'data.sec.gov'],
      userAgent: secUserAgent,
      logPath,
      requestsPerSecond: 8,
    }), secUserAgent),
    ID: new IdxAdapter(new OfficialHttpClient({
      allowedHosts: ['www.idx.id', 'idx.id'],
      userAgent: 'JP Invest local research application',
      logPath,
      requestsPerSecond: 4,
    }), issuerAdapter),
  };
}

export type SecondarySourceAdapters = {
  issuerPr?: SourceAdapter;
  newsWire?: SourceAdapter;
};

/**
 * Exported for M008's `lib/research/discovery-promotion.ts` — the
 * DEC-0015 §3.2 domain gate needs the exact same origin -> client map Class
 * A/B already build, not a reimplementation of it (two host-matching
 * implementations would be two places to keep in sync on the one thing that
 * actually matters here: which domains are trusted).
 */
export function buildClientsByOrigin(urls: Record<string, string>, logPath: string): Record<string, OfficialHttpClient> {
  return Object.fromEntries([...new Set(Object.values(urls).map((value) => new URL(value).origin))].flatMap((origin) => {
    const host = new URL(origin).hostname;
    const alternateHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const client = new OfficialHttpClient({ allowedHosts: [host, alternateHost], userAgent: 'JP Invest official-source research', logPath, requestsPerSecond: 2, maxBytes: SOURCE_BYTE_LIMIT });
    return [[origin, client], [`https://${alternateHost}`, client]];
  }));
}

/**
 * M007 Slice 3. Sibling to `createSourceAdapters` — deliberately not a
 * change to that function's `Record<ResearchMarket, SourceAdapter>` return
 * shape, which is depended on elsewhere (including tests). Both fields are
 * optional per market: a ticker with no configured press-release URL or no
 * reachable news feed simply gets `undefined`, which callers must handle by
 * skipping that source class (never by erroring).
 */
export function createSecondarySourceAdapters(): Record<ResearchMarket, SecondarySourceAdapters> {
  if (getResearchSourceMode() === 'mock') {
    const mockIssuerPr = new MockIssuerPressReleaseAdapter();
    const mockNewsWire = new MockNewsWireAdapter();
    return {
      US: { issuerPr: mockIssuerPr, newsWire: mockNewsWire },
      ID: { issuerPr: mockIssuerPr, newsWire: mockNewsWire },
    };
  }

  const logPath = getOutboundLogPath();

  const pressReleaseUrls = getIssuerPressReleaseUrls();
  const issuerPrAdapter = Object.keys(pressReleaseUrls).length
    ? new IssuerPressReleaseAdapter(pressReleaseUrls, buildClientsByOrigin(pressReleaseUrls, logPath))
    : undefined;

  const newsFeedUrls = getNewsWireFeedUrls();
  const newsWireAdapter = Object.keys(newsFeedUrls).length
    ? new NewsWireAdapter(newsFeedUrls, buildClientsByOrigin(newsFeedUrls, logPath))
    : undefined;

  return {
    US: { issuerPr: issuerPrAdapter, newsWire: newsWireAdapter },
    ID: { issuerPr: issuerPrAdapter, newsWire: newsWireAdapter },
  };
}

/**
 * M011 Slice 4. Structured XBRL fact sources, per market.
 *
 * Mirrors `createSecondarySourceAdapters`' optional-per-market shape: a market
 * with no source is `undefined`, and callers skip it. Deliberately not a
 * throwing stub — the absence of structured facts for the ID market is a real,
 * permanent property of that market (IDX publishes no company-concept API), not
 * an error condition, and the coverage ledger reports it as a named gap rather
 * than as a failure.
 *
 * `data.sec.gov` is already in the SEC client's allowed hosts above, so this
 * adds no newly trusted domain.
 */
export function createXbrlFactSources(): Record<ResearchMarket, XbrlFactSource | undefined> {
  if (getResearchSourceMode() === 'mock') {
    return { US: new MockSecXbrlFactSource(), ID: undefined };
  }

  const secUserAgent = process.env.SEC_USER_AGENT ?? '';
  if (!secUserAgent.includes('@')) return { US: undefined, ID: undefined };

  return {
    US: new SecCompanyConceptSource(new OfficialHttpClient({
      allowedHosts: ['www.sec.gov', 'data.sec.gov'],
      userAgent: secUserAgent,
      logPath: getOutboundLogPath(),
      requestsPerSecond: 8,
    }), secUserAgent),
    ID: undefined,
  };
}
