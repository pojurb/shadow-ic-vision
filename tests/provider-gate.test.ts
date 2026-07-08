import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateProviderGate } from '@/lib/ai/provider-gate';
import { providerFetch, ProviderGateError } from '@/lib/ai/provider-http';
import type { ProviderCallContext, ProviderMetadata } from '@/lib/ai/provider';

const metadata: ProviderMetadata = {
  provider: 'ollama-cloud',
  modelId: 'deepseek-v3.1:671b-cloud',
  promptVersion: '1.0.0',
  settings: { apiUrl: 'https://ollama.com/api' },
};

const allowedContext = (dataClass: ProviderCallContext['dataClass']): ProviderCallContext => ({
  route: 'tests.provider-gate',
  dataClass,
  runtime: { deployment: 'local' },
});

describe('DEC-0009 provider gate', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-invest-provider-gate-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    'public_market_data',
    'synthetic_fixture',
    'poc_workflow_confidential',
  ] as const)('allows %s in a local POC runtime', (dataClass) => {
    expect(evaluateProviderGate(metadata, allowedContext(dataClass))).toMatchObject({
      allowed: true,
      reasonCode: 'provider_gate_allowed',
    });
  });

  it.each([
    'portfolio_position_data',
    'restricted_personal_financial_secret',
    'production_confidential_processing',
  ] as const)('blocks restricted class %s', (dataClass) => {
    expect(evaluateProviderGate(metadata, allowedContext(dataClass))).toMatchObject({
      allowed: false,
      reasonCode: `provider_data_class_blocked:${dataClass}`,
    });
  });

  it('fails closed for missing and unknown data classes', () => {
    expect(evaluateProviderGate(metadata, undefined)).toMatchObject({
      allowed: false,
      reasonCode: 'provider_context_missing',
    });
    expect(evaluateProviderGate(metadata, {
      route: 'tests.provider-gate',
      dataClass: 'unknown' as ProviderCallContext['dataClass'],
      runtime: { deployment: 'local' },
    })).toMatchObject({
      allowed: false,
      reasonCode: 'provider_data_class_unknown',
    });
  });

  it('blocks external providers outside loopback or local POC runtime', () => {
    expect(evaluateProviderGate(metadata, {
      route: 'app.api.chat',
      dataClass: 'poc_workflow_confidential',
      runtime: { requestUrl: 'http://127.0.0.1:3100/api/chat', host: '127.0.0.1:3100' },
    })).toMatchObject({
      allowed: true,
      reasonCode: 'provider_gate_allowed',
    });
    expect(evaluateProviderGate(metadata, {
      route: 'app.api.chat',
      dataClass: 'poc_workflow_confidential',
      runtime: { requestUrl: 'https://example.com/api/chat', host: 'example.com' },
    })).toMatchObject({
      allowed: false,
      reasonCode: 'provider_external_requires_loopback',
    });
  });

  it('blocks hosted and production runtime indicators', () => {
    expect(evaluateProviderGate(metadata, {
      route: 'app.api.chat',
      dataClass: 'poc_workflow_confidential',
      runtime: { deployment: 'production' },
    })).toMatchObject({
      allowed: false,
      reasonCode: 'provider_runtime_not_poc_local',
    });

    vi.stubEnv('NODE_ENV', 'production');
    expect(evaluateProviderGate(metadata, allowedContext('poc_workflow_confidential'))).toMatchObject({
      allowed: false,
      reasonCode: 'provider_runtime_not_poc_local',
    });
  });

  it('logs allowed and blocked provider attempts without payloads', async () => {
    const logPath = path.join(directory, 'outbound.log');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      message: { content: 'ok' },
    }), { status: 200 }));

    await providerFetch({
      metadata,
      context: allowedContext('poc_workflow_confidential'),
      endpoint: 'ollama.chat',
      url: 'https://ollama.com/api/chat',
      init: {
        method: 'POST',
        body: JSON.stringify({ messages: [{ content: 'secret thesis text' }] }),
      },
      fetchImpl,
      logPath,
      now: () => 1_000,
    });

    await expect(providerFetch({
      metadata,
      context: allowedContext('restricted_personal_financial_secret'),
      endpoint: 'ollama.chat',
      url: 'https://ollama.com/api/chat',
      init: {
        method: 'POST',
        body: JSON.stringify({ apiKey: 'not-for-log' }),
      },
      fetchImpl,
      logPath,
      now: () => 1_000,
    })).rejects.toBeInstanceOf(ProviderGateError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ outcome: 'allowed', dataClass: 'poc_workflow_confidential' });
    expect(lines[1]).toMatchObject({ outcome: 'blocked', dataClass: 'restricted_personal_financial_secret' });
    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain('secret thesis text');
    expect(serialized).not.toContain('not-for-log');
  });
});
