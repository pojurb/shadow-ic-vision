import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findOfficialIdxDocument } from '@/lib/research/adapters/idx';
import { SecAdapter, selectLatestFiling } from '@/lib/research/adapters/sec';
import { OfficialHttpClient, resetHttpStateForTests } from '@/lib/research/http';

describe('official source adapters', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-http-'));
    resetHttpStateForTests();
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('selects the latest 10-Q and falls back to 10-K by form priority', () => {
    const recent = {
      accessionNumber: ['annual', 'quarterly'],
      form: ['10-K', '10-Q'],
      filingDate: ['2026-06-01', '2026-05-01'],
      primaryDocument: ['annual.htm', 'quarterly.htm'],
    };
    expect(selectLatestFiling(recent, ['10-Q', '10-K'])).toMatchObject({ accessionNumber: 'quarterly', form: '10-Q' });
    expect(selectLatestFiling({ ...recent, form: ['10-K', '8-K'] }, ['10-Q', '10-K'])).toMatchObject({ accessionNumber: 'annual', form: '10-K' });
  });

  it('resolves an SEC ticker to CIK and constructs the primary filing URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('company_tickers_exchange')) {
        return new Response(JSON.stringify({ data: [[1321655, 'Palantir Technologies Inc.', 'PLTR', 'NYSE']] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        name: 'Palantir Technologies Inc.',
        filings: { recent: {
          accessionNumber: ['0001321655-26-000001'],
          form: ['10-Q'],
          filingDate: ['2026-05-08'],
          primaryDocument: ['pltr-20260331.htm'],
        } },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const http = new OfficialHttpClient({
      allowedHosts: ['www.sec.gov', 'data.sec.gov'],
      userAgent: 'JP Invest test@example.com',
      logPath: path.join(directory, 'outbound.log'),
      fetchImpl,
      sleep: async () => undefined,
      now: (() => { let current = 1_000; return () => current += 1_000; })(),
    });
    const outcome = await new SecAdapter(http, 'JP Invest test@example.com').discover({
      market: 'US', ticker: 'PLTR', documentTypes: ['10-Q', '10-K'],
    });
    expect(outcome).toMatchObject({
      kind: 'found',
      value: [{
        documentId: '0001321655-26-000001',
        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1321655/000132165526000001/pltr-20260331.htm',
      }],
    });
  });

  it('accepts an IDX document only with ticker, official URL, and publication date', () => {
    const html = '<a href="https://www.idx.co.id/files/BBRI-Q1-2026.pdf">BBRI laporan keuangan 30/04/2026</a>';
    expect(findOfficialIdxDocument(html, 'BBRI')).toMatchObject({
      ticker: 'BBRI',
      publishDate: '2026-04-30',
      sourceFormat: 'pdf',
    });
    expect(findOfficialIdxDocument('<a href="https://example.com/BBRI.pdf">BBRI 30/04/2026</a>', 'BBRI')).toBeNull();
    expect(findOfficialIdxDocument('<a href="https://www.idx.co.id/BBRI.pdf">BBRI</a>', 'BBRI')).toBeNull();
  });

  it('blocks non-allowlisted URLs before fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = clientWith(fetchImpl, directory);
    await expect(client.get('https://example.com/source', 'text/html')).rejects.toMatchObject({ code: 'source_redirect_blocked' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks redirects outside the allowlist', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/escape' },
    }));
    const client = clientWith(fetchImpl, directory);
    await expect(client.get('https://www.sec.gov/start', 'text/html')).rejects.toMatchObject({ code: 'source_redirect_blocked' });
  });

  it('retries transient responses and caches a successful result', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('<p>ok</p>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const client = clientWith(fetchImpl, directory);
    const first = await client.get('https://www.sec.gov/document', 'text/html');
    const second = await client.get('https://www.sec.gov/document', 'text/html');
    expect(new TextDecoder().decode(first.bytes)).toBe('<p>ok</p>');
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('classifies repeated aborts as a source timeout', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'AbortError';
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/slow', 'text/html'))
      .rejects.toMatchObject({ code: 'source_timeout' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('rejects a response that declares an oversized document', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('small', {
      status: 200,
      headers: { 'content-length': String(26 * 1024 * 1024) },
    }));
    await expect(clientWith(fetchImpl, directory).get('https://www.sec.gov/large', 'text/html'))
      .rejects.toMatchObject({ code: 'source_too_large' });
  });
});

function clientWith(fetchImpl: typeof fetch, directory: string) {
  return new OfficialHttpClient({
    allowedHosts: ['www.sec.gov'],
    userAgent: 'JP Invest test@example.com',
    logPath: path.join(directory, 'outbound.log'),
    fetchImpl,
    sleep: async () => undefined,
    now: (() => { let current = 1_000; return () => current += 1_000; })(),
    random: () => 0,
  });
}
