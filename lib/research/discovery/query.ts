import type { ResearchMarket } from '../adapters/types';

/**
 * Mirrors the exact query shape used in §0's 12 live Tavily runs
 * (`docs/evals/M008/discovery-cases.json`'s `query` field) — the packet's
 * coverage numbers were measured against this phrasing, not a generic
 * "ticker + market" string, so production must build the same query a
 * changed phrasing here would silently invalidate the recorded eval
 * evidence.
 */
export function buildDiscoveryQuery(market: ResearchMarket, ticker: string, companyName: string): string {
  return market === 'ID'
    ? `${ticker} ${companyName} laporan keuangan siaran pers`
    : `${ticker} ${companyName} investor relations press release quarterly results`;
}
