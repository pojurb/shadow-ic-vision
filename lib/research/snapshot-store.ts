import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { AppDatabase } from '@/db/client';
import { researchJobSources, sourceDiscoveries, sourceSnapshots } from '@/db/schema';
import type { ResearchSourceMode, SourceSnapshot } from './adapters/types';

export function persistSourceSnapshot(input: {
  db: AppDatabase;
  jobId: string;
  snapshot: SourceSnapshot;
  documentHash: string;
  sourceMode: ResearchSourceMode;
  snapshotDirectory: string;
  outcome: 'verified' | 'rejected';
  errorCode?: string;
}) {
  fs.mkdirSync(input.snapshotDirectory, { recursive: true });
  const storagePath = path.join(input.snapshotDirectory, `${input.documentHash}.bin`);
  if (!fs.existsSync(storagePath)) fs.writeFileSync(storagePath, input.snapshot.rawBytes);

  input.db.transaction((tx) => {
    tx.insert(sourceSnapshots).values({
      documentHash: input.documentHash,
      documentId: input.snapshot.documentId,
      market: input.snapshot.market,
      ticker: input.snapshot.ticker,
      sourceUrl: input.snapshot.sourceUrl,
      sourceName: input.snapshot.sourceName,
      sourceTier: input.snapshot.sourceTier,
      sourceFormat: input.snapshot.sourceFormat,
      contentType: input.snapshot.contentType,
      httpStatus: input.snapshot.httpStatus,
      publishDate: input.snapshot.publishDate,
      retrievalTimestamp: input.snapshot.retrievalTimestamp,
      storagePath,
      sourceMode: input.sourceMode,
    }).onConflictDoNothing().run();
    tx.insert(researchJobSources).values({
      jobId: input.jobId,
      documentHash: input.documentHash,
      outcome: input.outcome,
      errorCode: input.errorCode ?? null,
    }).onConflictDoUpdate({
      target: [researchJobSources.jobId, researchJobSources.documentHash],
      set: { outcome: input.outcome, errorCode: input.errorCode ?? null },
    }).run();
    if (input.snapshot.discoveryUrl) {
      tx.insert(sourceDiscoveries).values({
        documentHash: input.documentHash,
        discoveredFromUrl: input.snapshot.discoveryUrl,
        discoveryMethod: input.snapshot.sourceName.startsWith('Issuer official') ? 'issuer_crawl' : 'exchange_api',
      }).onConflictDoNothing().run();
    }
  });

  return storagePath;
}
