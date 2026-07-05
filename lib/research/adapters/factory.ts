import { getIssuerSourceUrls, getOutboundLogPath, getResearchSourceMode } from '../config';
import { OfficialHttpClient } from '../http';
import { IdxAdapter } from './idx';
import { IssuerAdapter } from './issuer';
import { MockIdxAdapter } from './mock-idx';
import { MockSecAdapter } from './mock-sec';
import { SecAdapter } from './sec';
import type { ResearchMarket, SourceAdapter } from './types';

export function createSourceAdapters(): Record<ResearchMarket, SourceAdapter> {
  if (getResearchSourceMode() === 'mock') return { US: new MockSecAdapter(), ID: new MockIdxAdapter() };

  const logPath = getOutboundLogPath();
  const secUserAgent = process.env.SEC_USER_AGENT ?? '';
  const issuerUrls = getIssuerSourceUrls();
  const issuerClients = Object.fromEntries([...new Set(Object.values(issuerUrls).map((value) => new URL(value).origin))].flatMap((origin) => {
    const host = new URL(origin).hostname;
    const alternateHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const client = new OfficialHttpClient({ allowedHosts: [host, alternateHost], userAgent: 'JP Invest official-source research', logPath, requestsPerSecond: 2, maxBytes: 25 * 1024 * 1024 });
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
