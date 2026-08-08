import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { AppDatabase } from '@/db/client';
import { researchJobSources, sourceDiscoveries, sourceSnapshots, portfolioPositions, portfolioAlerts } from '@/db/schema';
import type { ResearchSourceMode, SourceSnapshot } from './adapters/types';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export function persistSourceSnapshot(input: {
  db: AppDatabase;
  /**
   * M008: optional. `research_job_sources.job_id` is a required FK, so a
   * fetch with no owning `researchJobs` row (the CLI-triggered discovery
   * promotion path in `lib/research/discovery-promotion.ts` has none) simply
   * skips that audit insert below — the snapshot itself, and the
   * `portfolioAlerts`/`sourceDiscoveries` bookkeeping tied to the snapshot
   * rather than to a job, still happen unconditionally.
   */
  jobId?: string;
  snapshot: SourceSnapshot;
  documentHash: string;
  sourceMode: ResearchSourceMode;
  snapshotDirectory: string;
  outcome: 'verified' | 'rejected';
  errorCode?: string;
}) {
  fs.mkdirSync(input.snapshotDirectory, { recursive: true });
  const storagePath = path.join(input.snapshotDirectory, `${input.documentHash}.bin`);
  /*
   * M013. An empty file is a failed write, not a stored document.
   *
   * This was guarded by `existsSync` alone, so a zero-byte file could never be
   * replaced — the guard read "already stored" from mere existence. A real
   * defect produced exactly those: `pdfjs.getDocument` detaches the buffer it
   * is handed and persistence runs afterwards, leaving seven of fifteen
   * snapshots empty. `extractPdf` now hands pdfjs a copy, so no new ones
   * appear; without this line the existing ones would stay empty for the life
   * of the store, since every later fetch of the same document would decline
   * to write.
   *
   * Storage is content-addressed — the filename *is* the hash of the intended
   * content — so a zero-byte file at that path cannot be a legitimate version
   * of it. A retained non-empty snapshot is still never overwritten.
   */
  const stored = fs.existsSync(storagePath) ? fs.statSync(storagePath).size : 0;
  if (stored === 0) fs.writeFileSync(storagePath, input.snapshot.rawBytes);

  input.db.transaction((tx) => {
    const newSnapshot = tx.insert(sourceSnapshots).values({
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
    }).onConflictDoNothing().returning({ documentHash: sourceSnapshots.documentHash }).get();

    if (newSnapshot) {
      const positions = tx.select({ id: portfolioPositions.id })
        .from(portfolioPositions)
        .where(and(
          eq(portfolioPositions.ticker, input.snapshot.ticker),
          eq(portfolioPositions.market, input.snapshot.market)
        ))
        .all();

      for (const pos of positions) {
        tx.insert(portfolioAlerts).values({
          id: randomUUID(),
          positionId: pos.id,
          documentHash: input.documentHash,
          isRead: false,
        }).run();
      }
    }

    if (input.jobId) {
      tx.insert(researchJobSources).values({
        jobId: input.jobId,
        documentHash: input.documentHash,
        outcome: input.outcome,
        errorCode: input.errorCode ?? null,
      }).onConflictDoUpdate({
        target: [researchJobSources.jobId, researchJobSources.documentHash],
        set: { outcome: input.outcome, errorCode: input.errorCode ?? null },
      }).run();
    }

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

