import path from 'node:path';
import { resolveDatabasePath } from '@/db/client';
import type { ResearchSourceMode } from './adapters/types';

export function getResearchSourceMode(): ResearchSourceMode {
  return process.env.RESEARCH_SOURCE_MODE === 'live' ? 'live' : 'mock';
}

export function getSnapshotDirectory(): string {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.SOURCE_SNAPSHOT_DIR || path.join(path.dirname(resolveDatabasePath()), 'source-snapshots'),
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
