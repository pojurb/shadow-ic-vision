import 'server-only';

import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '@/db/client';
import { discoveryCandidates } from '@/db/schema';
import type { ResearchMarket } from '../adapters/types';
import type { DiscoveryCandidateUrl } from './types';

/**
 * M008 Workflow 1 step 2. Upserts each discovered URL into
 * `discoveryCandidates` via the table's existing
 * `(market, ticker, candidateUrl)` unique index. Deliberately
 * `onConflictDoNothing`, not an update: a repeat discovery of a URL already
 * `fetched`/`rejected`/`unreachable` from a prior run must not reset it back
 * to `pending` and re-offer it for promotion — the candidate's lifecycle,
 * once it leaves `pending`, is owned by the promotion path
 * (`lib/research/discovery-promotion.ts`), not by rediscovery.
 */
export function persistDiscoveryCandidates(params: {
  db: AppDatabase;
  market: ResearchMarket;
  ticker: string;
  searchQuery: string;
  candidates: DiscoveryCandidateUrl[];
  now: () => Date;
}): void {
  if (params.candidates.length === 0) return;
  const nowIso = params.now().toISOString();
  for (const candidate of params.candidates) {
    params.db.insert(discoveryCandidates).values({
      id: randomUUID(),
      market: params.market,
      ticker: params.ticker,
      candidateUrl: candidate.url,
      discoveredVia: 'web_search',
      searchQuery: params.searchQuery,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    }).onConflictDoNothing().run();
  }
}
