import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
    conditions: ['react-server'],
  },
  test: {
    environment: 'node',
    include: ['tests/live-sources.test.ts'],
    restoreMocks: true,
    env: {
      RUN_LIVE_SOURCE_TESTS: '1',
      RESEARCH_SOURCE_MODE: 'live',
    },
  },
});
