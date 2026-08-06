import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { cleanupMislabelledPromotions } from '../lib/research/promotion-cleanup';

/**
 * Repairs rows written before Class-C promotion classified the documents it
 * fetched (`cf306da`): pages labelled "Web-discovered issuer release" that are
 * not releases, and the evidence derived from them.
 *
 * DRY RUN BY DEFAULT. `--apply` is required to write anything, and the dry run
 * prints the identical report, so what a reviewer approves is what runs — the
 * same discipline as `cleanup-boilerplate-evidence.ts`.
 *
 * Raw snapshots and their `source_snapshots` rows are retained; only the
 * descriptive label changes. The fetch genuinely happened and is
 * content-addressed, and that record is what made this defect provable in the
 * first place. `getDatabase()` additionally writes a timestamped full-DB
 * backup before any migration.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const { db } = getDatabase();
  const report = cleanupMislabelledPromotions({ db, apply });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!apply) {
    process.stdout.write('\nDry run. Re-run with --apply to write the changes listed above.\n');
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Promotion cleanup failed.'}\n`);
  process.exitCode = 1;
});
