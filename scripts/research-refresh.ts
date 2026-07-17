import './dotenv-quiet';
import 'dotenv/config';

import { refreshOfficialSources } from '../lib/research/ingestion';

async function main() {
  if (process.env.RESEARCH_SOURCE_MODE !== 'live') {
    throw new Error('Scheduled refresh requires RESEARCH_SOURCE_MODE=live.');
  }
  const result = await refreshOfficialSources('cron');
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.lastRun?.status === 'failed') process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Official-source refresh failed.'}\n`);
  process.exitCode = 1;
});
