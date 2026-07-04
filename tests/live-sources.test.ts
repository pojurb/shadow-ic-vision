import { describe, expect, it } from 'vitest';
import { createHash } from '@/lib/research/verifier';
import { createSourceAdapters } from '@/lib/research/adapters/factory';

const enabled = process.env.RUN_LIVE_SOURCE_TESTS === '1';

describe.skipIf(!enabled)('opt-in live official sources', () => {
  it('retrieves and hashes a current SEC filing', async () => {
    process.env.RESEARCH_SOURCE_MODE = 'live';
    const adapter = createSourceAdapters().US;
    const discovered = await adapter.discover({ market: 'US', ticker: 'PLTR', documentTypes: ['10-Q', '10-K'] });
    expect(discovered.kind).toBe('found');
    if (discovered.kind !== 'found') return;
    const snapshot = await adapter.fetchSnapshot(discovered.value[0]);
    expect(snapshot.kind).toBe('found');
    if (snapshot.kind !== 'found') return;
    expect(createHash(snapshot.value.rawBytes)).toHaveLength(64);
  });

  it('retrieves IDX metadata or fails closed with the approved code', async () => {
    process.env.RESEARCH_SOURCE_MODE = 'live';
    const outcome = await createSourceAdapters().ID.discover({ market: 'ID', ticker: 'BBRI', documentTypes: ['financial-statement'] });
    if (outcome.kind === 'found') {
      expect(outcome.value[0]).toMatchObject({ ticker: 'BBRI', sourceTier: 'official' });
    } else {
      expect(outcome).toMatchObject({ kind: 'unavailable', code: 'idx_source_unavailable' });
    }
  });
});
