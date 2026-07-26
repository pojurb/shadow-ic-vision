import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { getOutboundLogPath, getResearchSourceMode, getSnapshotDirectory } from '../lib/research/config';
import { buildPromotionClients, promoteAllEligibleCandidates } from '../lib/research/discovery-promotion';

/**
 * M008 Slice 3, explicit path. Companion to the automatic promotion that
 * runs inside `processResearchJobs` — this script exists for the case
 * `processResearchJobs` cannot cover: a user adds a new domain to
 * `ISSUER_PRESS_RELEASE_URLS`/`NEWS_WIRE_FEED_URLS` in `.env` *after* a
 * candidate was already discovered and rejected as
 * `domain_not_allowlisted`. Nothing re-evaluates that candidate until either
 * a fresh discovery search happens to return the same URL again (not
 * guaranteed) or this script runs. See the M008 packet §8, "Promotion
 * trigger strategy (RESOLVED)".
 */
async function main() {
  const { db } = getDatabase();
  const clients = buildPromotionClients(getOutboundLogPath());
  const stats = await promoteAllEligibleCandidates({
    db,
    snapshotDirectory: getSnapshotDirectory(),
    sourceMode: getResearchSourceMode(),
    now: () => new Date(),
    clients,
  });
  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Discovery promotion sweep failed.'}\n`);
  process.exitCode = 1;
});
