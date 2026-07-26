import { getOutboundLogPath, getSearchDiscoveryApiKey } from '../config';
import { TavilyDiscoveryProvider } from './tavily';
import type { SearchDiscoveryProvider } from './types';

/**
 * M008 Slice 1. Provider-neutral factory, mirroring `createSecondarySourceAdapters`'s
 * shape: production code asks this factory for a provider rather than
 * constructing `TavilyDiscoveryProvider` directly, so swapping the live
 * provider later (§0's Google News RSS / Serper candidates are parked, not
 * deleted) touches one call site. `TavilyDiscoveryProvider` already fails
 * closed with no network call when `getSearchDiscoveryApiKey()` is empty
 * (proven in `tests/discovery-eval.test.ts`), so no separate mock/live branch
 * is needed here the way `createSecondarySourceAdapters` needs one — an
 * unconfigured key is itself the safe default in every environment,
 * including tests.
 */
export function createDiscoveryProvider(): SearchDiscoveryProvider {
  return new TavilyDiscoveryProvider({
    apiKey: getSearchDiscoveryApiKey(),
    logPath: getOutboundLogPath(),
  });
}
