import path from 'node:path';
import type { ResearchSourceMode } from './adapters/types';

export function getResearchSourceMode(): ResearchSourceMode {
  return process.env.RESEARCH_SOURCE_MODE === 'live' ? 'live' : 'mock';
}

export function getSnapshotDirectory(): string {
  const databasePath = path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DB_PATH || '../jp-invest-data/db.sqlite',
  );
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.SOURCE_SNAPSHOT_DIR || path.join(path.dirname(databasePath), 'source-snapshots'),
  );
}

export function getOutboundLogPath(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.OUTBOUND_LOG_PATH || 'logs/outbound.log');
}

export function getCronSecret(): string {
  return process.env.RESEARCH_CRON_SECRET?.trim() ?? '';
}

export function getResearchSchedule(): string {
  return process.env.RESEARCH_REFRESH_SCHEDULE?.trim() || '0 8 * * *';
}

export function getIssuerSourceUrls(): Record<string, string> {
  const raw = process.env.ISSUER_SOURCE_URLS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([ticker, value]) =>
      typeof value === 'string' && value.startsWith('https://') ? [[ticker.toUpperCase(), value]] : [],
    ));
  } catch {
    return {};
  }
}

// M007 Class A: same shape as getIssuerSourceUrls (ticker -> allowlisted
// IR page URL), but for press-release pages rather than financial-report
// pages — kept as a separate env var and reader so the two source classes
// (official-filing-mirror vs. secondary press releases) can be configured
// and revoked independently.
export function getIssuerPressReleaseUrls(): Record<string, string> {
  const raw = process.env.ISSUER_PRESS_RELEASE_URLS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([ticker, value]) =>
      typeof value === 'string' && value.startsWith('https://') ? [[ticker.toUpperCase(), value]] : [],
    ));
  } catch {
    return {};
  }
}

// M008 Class C: API key for the search-discovery provider under evaluation.
// Kept as its own reader (rather than folded into a generic provider config)
// so discovery access can be revoked independently of the DEC-0010 LLM
// provider key — they are different vendors serving different roles.
export function getSearchDiscoveryApiKey(): string {
  return process.env.SEARCH_DISCOVERY_API_KEY?.trim() ?? '';
}

// M007 Class B: publisher name -> allowlisted RSS/Atom/JSON feed URL. Not
// keyed by ticker (a news wire serves many tickers from one feed) — the
// NewsWireAdapter filters items by ticker after fetching.
export function getNewsWireFeedUrls(): Record<string, string> {
  const raw = process.env.NEWS_WIRE_FEED_URLS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([publisherName, value]) =>
      typeof value === 'string' && value.startsWith('https://') ? [[publisherName, value]] : [],
    ));
  } catch {
    return {};
  }
}
