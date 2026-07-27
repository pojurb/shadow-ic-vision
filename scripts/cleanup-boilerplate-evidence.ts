import './dotenv-quiet';
import 'dotenv/config';

import { getDatabase } from '../db/client';
import { cleanupBoilerplateEvidence } from '../lib/research/evidence-cleanup';

/**
 * M010 Slice 4. Removes secondary evidence rows the M010-fixed extractor would
 * no longer produce — the cleanup M009 explicitly deferred.
 *
 * DRY RUN BY DEFAULT. `--apply` is required to write anything, and the dry run
 * prints the identical report, so what a reviewer approves is what runs.
 * Deletion is safe to review because it is derived, not guessed: the raw
 * snapshot `.bin` and its `source_snapshots` row are never touched, so the
 * chain of custody for *what was fetched* survives intact — only the derived,
 * wrong-precision evidence row goes. `getDatabase()` additionally writes a
 * timestamped full-DB backup before any migration.
 */
async function main() {
  const apply = process.argv.includes('--apply');
  const { db } = getDatabase();
  const report = await cleanupBoilerplateEvidence({ db, apply });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!apply) {
    process.stdout.write('\nDry run. Re-run with --apply to delete the rows listed above.\n');
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Evidence cleanup failed.'}\n`);
  process.exitCode = 1;
});
