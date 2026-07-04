import { getOutboundLogPath, getResearchSourceMode } from '../config';
import { OfficialHttpClient } from '../http';
import { IdxAdapter } from './idx';
import { MockIdxAdapter } from './mock-idx';
import { MockSecAdapter } from './mock-sec';
import { SecAdapter } from './sec';
import type { ResearchMarket, SourceAdapter } from './types';

export function createSourceAdapters(): Record<ResearchMarket, SourceAdapter> {
  if (getResearchSourceMode() === 'mock') return { US: new MockSecAdapter(), ID: new MockIdxAdapter() };

  const logPath = getOutboundLogPath();
  const secUserAgent = process.env.SEC_USER_AGENT ?? '';
  return {
    US: new SecAdapter(new OfficialHttpClient({
      allowedHosts: ['www.sec.gov', 'data.sec.gov'],
      userAgent: secUserAgent,
      logPath,
      requestsPerSecond: 8,
    }), secUserAgent),
    ID: new IdxAdapter(new OfficialHttpClient({
      allowedHosts: ['www.idx.co.id', 'idx.co.id'],
      userAgent: 'JP Invest local research application',
      logPath,
      requestsPerSecond: 4,
    })),
  };
}
