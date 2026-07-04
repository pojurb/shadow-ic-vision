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
