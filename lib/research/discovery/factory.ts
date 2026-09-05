import { getOutboundLogPath, getResearchSourceMode, getSearchDiscoveryApiKey } from '../config';
import { TavilyDiscoveryProvider } from './tavily';
import type { DiscoveryOutcome, SearchDiscoveryProvider } from './types';

/**
 * M008 Slice 1 established this factory so swapping the live provider touches
 * one call site. Its original comment argued no mock/live branch was needed —
 * that `TavilyDiscoveryProvider` failing closed on an empty key made "an
 * unconfigured key ... itself the safe default in every environment,
 * including tests."
 *
 * **M015 step 3: that reasoning is disproven and is deliberately overturned
 * here.** It held only where no key is configured. In any environment whose
 * `.env` carries a real `SEARCH_DISCOVERY_API_KEY` — which is the developer
 * machine, and `vitest.config.ts` sets `RESEARCH_SOURCE_MODE: 'mock'` but
 * cannot unset a key the process already loaded — the empty-key guard never
 * fires and every mock-mode run reaches the network. The 2026-09-05 audit
 * measured the consequence: 61 live Tavily requests, all HTTP 200, from a
 * test suite and an E2E run that were both nominally offline.
 *
 * The correction is to stop treating key presence as the control and use the
 * same signal the other three lanes already use — `createSourceAdapters`,
 * `createSecondarySourceAdapters`, and `createXbrlFactSources` each branch on
 * `getResearchSourceMode()` before reading any credential. Discovery was the
 * lone outlier; it is no longer.
 *
 * Mock mode returns a provider that is *off*, not one that returns fixture
 * URLs the way the sibling mocks return fixture documents. Discovery's whole
 * function is finding new external URLs, and a fixture URL has nowhere honest
 * to go: it is either not on the promotion allowlist (persisting a misleading
 * `domain_not_allowlisted` rejection) or it sits pending forever now that
 * `promotePendingForAssumption` also refuses to fetch in mock mode. "This lane
 * is switched off" is the true statement, and `discovery_disabled_by_mode`
 * says it without being mistaken for "searched and found nothing".
 */
class DisabledDiscoveryProvider implements SearchDiscoveryProvider {
  readonly providerId = 'disabled';

  async search(): Promise<DiscoveryOutcome> {
    return {
      kind: 'unavailable',
      code: 'discovery_disabled_by_mode',
      message: 'Discovery is disabled because RESEARCH_SOURCE_MODE is not live.',
    };
  }
}

export function createDiscoveryProvider(): SearchDiscoveryProvider {
  if (getResearchSourceMode() === 'mock') return new DisabledDiscoveryProvider();

  return new TavilyDiscoveryProvider({
    apiKey: getSearchDiscoveryApiKey(),
    logPath: getOutboundLogPath(),
  });
}
