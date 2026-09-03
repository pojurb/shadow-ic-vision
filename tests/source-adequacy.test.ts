import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '@/db/client';
import { assumptions, conversations, messages, theses } from '@/db/schema';
import {
  closedAssumptionIds,
  computeContractFingerprint,
  getLiveSourceAdequacy,
  recordSourceAdequacy,
  type ContractSubstance,
} from '@/lib/research/source-adequacy';

// M013 Q6. This is exactly A6's real contract, kept as a fixture rather than
// invented — the module exists because of this assumption, and a fixture
// that mirrors it keeps the tests honest about what's actually being
// classified.
const A6_CONTRACT: ContractSubstance = {
  metric: 'MW kapasitas listrik firm dari PLN yang diamankan NeutraDC',
  definitionVariant: 'Snapshot MW firm (bukan LoI/studi kelayakan) vs benchmark BDx 1,2 GW (1200 MW)',
  operator: 'gte',
  threshold: 1200,
  unit: 'count',
  timeBasis: 'instant',
};

describe('computeContractFingerprint', () => {
  it('is deterministic for identical substance', () => {
    expect(computeContractFingerprint(A6_CONTRACT)).toBe(computeContractFingerprint({ ...A6_CONTRACT }));
  });

  it('changes when the threshold changes — the exact edit that should reopen a closed assumption', () => {
    const revised: ContractSubstance = { ...A6_CONTRACT, threshold: 200 };
    expect(computeContractFingerprint(revised)).not.toBe(computeContractFingerprint(A6_CONTRACT));
  });

  it('changes when the definitionVariant changes even with the same threshold', () => {
    const revised: ContractSubstance = { ...A6_CONTRACT, definitionVariant: 'coverage ratio vs announced pipeline demand' };
    expect(computeContractFingerprint(revised)).not.toBe(computeContractFingerprint(A6_CONTRACT));
  });

  it('is stable across a null and a zero threshold, which are not the same value', () => {
    const withNull: ContractSubstance = { ...A6_CONTRACT, threshold: null };
    const withZero: ContractSubstance = { ...A6_CONTRACT, threshold: 0 };
    expect(computeContractFingerprint(withNull)).not.toBe(computeContractFingerprint(withZero));
  });
});

describe('source adequacy persistence', () => {
  let handle: DatabaseHandle;
  let directory: string;
  const thesisId = '6f1a9c3e-1111-4c1a-9a1e-000000000001';
  const assumptionId = '6f1a9c3e-1111-4c1a-9a1e-000000000002';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-adequacy-'));
    handle = createDatabase(path.join(directory, 'test.sqlite'));
    const conversationId = '6f1a9c3e-1111-4c1a-9a1e-000000000003';
    const messageId = '6f1a9c3e-1111-4c1a-9a1e-000000000004';
    handle.db.insert(conversations).values({ id: conversationId, title: 'TLKM thesis' }).run();
    handle.db.insert(messages).values({ id: messageId, conversationId, role: 'assistant', content: 'draft' }).run();
    handle.db.insert(theses).values({
      id: thesisId, conversationId, draftMessageId: messageId, ticker: 'TLKM', companyName: 'Telkom',
      market: 'ID', coreBelief: 'NeutraDC secures firm PLN power.', title: 'TLKM', description: 'TLKM',
    }).run();
    handle.db.insert(assumptions).values({
      id: assumptionId, thesisId,
      statement: 'NeutraDC mampu mengamankan kapasitas listrik firm dari PLN.',
    }).run();
  });

  afterEach(() => {
    handle.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('round-trips through recordSourceAdequacy and getLiveSourceAdequacy', async () => {
    await recordSourceAdequacy({
      db: handle.db, assumptionId, classification: 'C',
      reasoning: 'No public source for firm PLN MW after full corpus review.',
      contract: A6_CONTRACT,
    });

    const live = await getLiveSourceAdequacy({ db: handle.db, assumptionId, contract: A6_CONTRACT });
    expect(live).toMatchObject({ classification: 'C', assumptionId });
  });

  it('returns null once the contract changes — a stale row never silently keeps blocking research', async () => {
    await recordSourceAdequacy({
      db: handle.db, assumptionId, classification: 'C',
      reasoning: 'No public source for firm PLN MW after full corpus review.',
      contract: A6_CONTRACT,
    });

    const revisedContract: ContractSubstance = { ...A6_CONTRACT, threshold: 200 };
    const live = await getLiveSourceAdequacy({ db: handle.db, assumptionId, contract: revisedContract });
    expect(live).toBeNull();
  });

  it('returns null for an assumption that was never classified', async () => {
    const live = await getLiveSourceAdequacy({ db: handle.db, assumptionId, contract: A6_CONTRACT });
    expect(live).toBeNull();
  });

  it('upserts rather than accumulating rows on re-classification', async () => {
    await recordSourceAdequacy({ db: handle.db, assumptionId, classification: 'B', reasoning: 'first pass', contract: A6_CONTRACT });
    await recordSourceAdequacy({ db: handle.db, assumptionId, classification: 'C', reasoning: 'revised after full review', contract: A6_CONTRACT });

    const live = await getLiveSourceAdequacy({ db: handle.db, assumptionId, contract: A6_CONTRACT });
    expect(live).toMatchObject({ classification: 'C', reasoning: 'revised after full review' });
  });

  it('closedAssumptionIds returns only C-classified assumptions whose fingerprint still matches', async () => {
    const otherAssumptionId = '6f1a9c3e-1111-4c1a-9a1e-000000000005';
    handle.db.insert(assumptions).values({ id: otherAssumptionId, thesisId, statement: 'A different assumption, classified B not C.' }).run();

    await recordSourceAdequacy({ db: handle.db, assumptionId, classification: 'C', reasoning: 'closed', contract: A6_CONTRACT });
    await recordSourceAdequacy({ db: handle.db, assumptionId: otherAssumptionId, classification: 'B', reasoning: 'exists but blocked', contract: A6_CONTRACT });

    const contracts = new Map<string, ContractSubstance>([
      [assumptionId, A6_CONTRACT],
      [otherAssumptionId, A6_CONTRACT],
    ]);
    const closed = closedAssumptionIds(handle.db, contracts);
    expect(closed).toEqual(new Set([assumptionId]));
  });

  it('closedAssumptionIds excludes a C-classified assumption whose contract has since changed', async () => {
    await recordSourceAdequacy({ db: handle.db, assumptionId, classification: 'C', reasoning: 'closed', contract: A6_CONTRACT });

    const revisedContract: ContractSubstance = { ...A6_CONTRACT, threshold: 200 };
    const contracts = new Map<string, ContractSubstance>([[assumptionId, revisedContract]]);
    const closed = closedAssumptionIds(handle.db, contracts);
    expect(closed).toEqual(new Set());
  });
});
