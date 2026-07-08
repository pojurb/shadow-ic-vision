import { getOutboundLogPath } from '@/lib/research/config';
import { evaluateProviderGate, writeProviderOutboundLog } from './provider-gate';
import type { ProviderCallContext, ProviderMetadata } from './provider';

type ProviderFetchOptions = {
  metadata: ProviderMetadata;
  context: ProviderCallContext;
  endpoint: string;
  url: string;
  init: RequestInit;
  fetchImpl?: typeof fetch;
  now?: () => number;
  logPath?: string;
};

export class ProviderGateError extends Error {
  constructor(readonly reasonCode: string) {
    super(`Provider call blocked by DEC-0009 gate: ${reasonCode}`);
    this.name = 'ProviderGateError';
  }
}

export async function providerFetch(options: ProviderFetchOptions): Promise<Response> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const gate = evaluateProviderGate(options.metadata, options.context);
  const logPath = options.logPath ?? getOutboundLogPath();

  if (!gate.allowed) {
    writeProviderOutboundLog(logPath, {
      timestamp: new Date().toISOString(),
      provider: options.metadata.provider,
      modelId: options.metadata.modelId,
      route: options.context?.route ?? 'unknown',
      endpoint: options.endpoint,
      dataClass: options.context?.dataClass ?? 'unknown',
      outcome: 'blocked',
      reasonCode: gate.reasonCode,
      status: null,
      durationMs: Math.max(0, now() - startedAt),
    });
    throw new ProviderGateError(gate.reasonCode);
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(options.url, options.init);
    writeProviderOutboundLog(logPath, {
      timestamp: new Date().toISOString(),
      provider: options.metadata.provider,
      modelId: options.metadata.modelId,
      route: options.context.route,
      endpoint: options.endpoint,
      dataClass: options.context.dataClass,
      outcome: 'allowed',
      reasonCode: gate.reasonCode,
      status: response.status,
      durationMs: Math.max(0, now() - startedAt),
    });
    return response;
  } catch (error) {
    writeProviderOutboundLog(logPath, {
      timestamp: new Date().toISOString(),
      provider: options.metadata.provider,
      modelId: options.metadata.modelId,
      route: options.context.route,
      endpoint: options.endpoint,
      dataClass: options.context.dataClass,
      outcome: 'allowed',
      reasonCode: error instanceof Error ? `provider_fetch_error:${error.name}` : 'provider_fetch_error',
      status: null,
      durationMs: Math.max(0, now() - startedAt),
    });
    throw error;
  }
}
