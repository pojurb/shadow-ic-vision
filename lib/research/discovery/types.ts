import type { ResearchMarket } from '../adapters/types';

/**
 * M008 Class C. The R-013 structural gate.
 *
 * A search provider's response carries a title, a snippet, and (for
 * content-extraction providers like Tavily/Exa) a pre-summarized page body.
 * None of that may ever become evidence: search is a discovery mechanism, not
 * a source (`docs/PRODUCT_STRATEGY.md` "Evidence Rules"). The rule is enforced
 * the same way M007 enforced R-010 — structurally, in which type exists,
 * rather than by a runtime check a future caller could forget.
 *
 * This type has exactly one field. Provider adapters read `url` off the raw
 * response and discard every text field at the adapter boundary, so snippet
 * text never enters the type system at all. There is no field for a caller to
 * reach for, and no branch that could repopulate one. `discoveryCandidates`
 * (`db/schema.ts`, migration 0007) mirrors this at the persistence layer by
 * having no snippet/title column.
 *
 * Do not add a title, snippet, score, or content field here. Anything a
 * candidate URL needs to become evidence must come from actually fetching it
 * through the normal snapshot/extraction pipeline.
 */
export type DiscoveryCandidateUrl = {
  readonly url: string;
};

export type DiscoveryQuery = {
  market: ResearchMarket;
  ticker: string;
  /** Full query string sent to the provider; built by the caller, not here. */
  query: string;
  maxResults?: number;
};

export type DiscoveryErrorCode =
  | 'discovery_not_configured'
  | 'discovery_http_error'
  | 'discovery_rate_limited'
  | 'discovery_quota_exhausted'
  | 'discovery_timeout';

export type DiscoveryOutcome =
  | { kind: 'found'; value: DiscoveryCandidateUrl[] }
  | { kind: 'unavailable'; code: DiscoveryErrorCode; message: string };

/**
 * Provider-neutral discovery contract, mirroring `lib/ai/provider.ts`'s
 * posture: the project owns the interface, vendors implement it. Swapping
 * Tavily for You.com must not touch anything downstream of `search`.
 */
export interface SearchDiscoveryProvider {
  readonly providerId: string;
  search(query: DiscoveryQuery): Promise<DiscoveryOutcome>;
}
