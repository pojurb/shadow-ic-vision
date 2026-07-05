import { describe, expect, it } from 'vitest';
import { createHash } from '@/lib/research/verifier';
import { createSourceAdapters } from '@/lib/research/adapters/factory';
import { IssuerAdapter } from '@/lib/research/adapters/issuer';
import { OfficialHttpClient } from '@/lib/research/http';
import { getOutboundLogPath } from '@/lib/research/config';

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

  it('retrieves and hashes an IDX attachment or fails closed with the approved code', async () => {
    process.env.RESEARCH_SOURCE_MODE = 'live';
    const outcome = await createSourceAdapters().ID.discover({ market: 'ID', ticker: 'BBRI', documentTypes: ['financial-statement'] });
    if (outcome.kind === 'found') {
      expect(outcome.value[0]).toMatchObject({ ticker: 'BBRI', sourceTier: 'official' });
      const snapshot = await createSourceAdapters().ID.fetchSnapshot(outcome.value[0]);
      expect(snapshot.kind).toBe('found');
      if (snapshot.kind === 'found') expect(createHash(snapshot.value.rawBytes)).toHaveLength(64);
    } else {
      expect(outcome).toMatchObject({ kind: 'unavailable' });
      expect(['idx_source_unavailable', 'issuer_source_unavailable']).toContain(outcome.code);
    }
  });

  it('retrieves an official issuer report through the bounded fallback', async () => {
    const sourceUrl = 'https://www.ir-bri.com/financials.html';
    const client = new OfficialHttpClient({ allowedHosts: ['ir-bri.com', 'www.ir-bri.com'], userAgent: 'JP Invest official-source research', logPath: getOutboundLogPath(), requestsPerSecond: 2 });
    const adapter = new IssuerAdapter({ BBRI: sourceUrl }, { 'https://ir-bri.com': client, 'https://www.ir-bri.com': client });
    const discovered = await adapter.discover({ market: 'ID', ticker: 'BBRI', documentTypes: ['financial-statement'] });
    expect(discovered.kind).toBe('found');
    if (discovered.kind !== 'found') return;
    const snapshot = await adapter.fetchSnapshot(discovered.value[0]);
    expect(snapshot.kind).toBe('found');
    if (snapshot.kind === 'found') expect(createHash(snapshot.value.rawBytes)).toHaveLength(64);
  });
});
