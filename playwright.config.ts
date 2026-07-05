import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    ...(process.env.CI || process.env.E2E_BROWSER === 'chromium' ? {} : { channel: 'msedge' as const }),
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DB_PATH: path.join(process.cwd(), '.tmp-e2e', 'db.sqlite'),
      LLM_PROVIDER_TYPE: 'mock',
      RESEARCH_SOURCE_MODE: 'mock',
      SOURCE_SNAPSHOT_DIR: path.join(process.cwd(), '.tmp-e2e', 'source-snapshots'),
    },
  },
});
