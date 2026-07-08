import fs from 'node:fs';
import path from 'node:path';
import type { ProviderCallContext, ProviderDataClass, ProviderMetadata } from './provider';

export type ProviderGateOutcome = {
  allowed: boolean;
  reasonCode: string;
};

export type ProviderOutboundLogEntry = {
  timestamp: string;
  provider: string;
  modelId: string;
  route: string;
  endpoint: string;
  dataClass: ProviderDataClass | 'unknown';
  outcome: 'allowed' | 'blocked';
  reasonCode: string;
  status: number | null;
  durationMs: number | null;
};

const ALLOWED_POC_DATA_CLASSES = new Set<ProviderDataClass>([
  'public_market_data',
  'synthetic_fixture',
  'poc_workflow_confidential',
]);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function evaluateProviderGate(
  provider: ProviderMetadata,
  context: ProviderCallContext | undefined,
): ProviderGateOutcome {
  if (!context?.route) return { allowed: false, reasonCode: 'provider_context_missing' };
  if (!isKnownDataClass(context.dataClass)) return { allowed: false, reasonCode: 'provider_data_class_unknown' };
  if (!ALLOWED_POC_DATA_CLASSES.has(context.dataClass)) {
    return { allowed: false, reasonCode: `provider_data_class_blocked:${context.dataClass}` };
  }
  if (isHostedOrProductionRuntime(context)) {
    return { allowed: false, reasonCode: 'provider_runtime_not_poc_local' };
  }
  if (provider.provider !== 'mock' && !isLoopbackRuntime(context)) {
    return { allowed: false, reasonCode: 'provider_external_requires_loopback' };
  }
  return { allowed: true, reasonCode: 'provider_gate_allowed' };
}

export function writeProviderOutboundLog(logPath: string, entry: ProviderOutboundLogEntry) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function isKnownDataClass(value: unknown): value is ProviderDataClass {
  return value === 'public_market_data'
    || value === 'synthetic_fixture'
    || value === 'poc_workflow_confidential'
    || value === 'portfolio_position_data'
    || value === 'restricted_personal_financial_secret'
    || value === 'production_confidential_processing';
}

function isHostedOrProductionRuntime(context: ProviderCallContext) {
  const deployment = context.runtime?.deployment;
  return deployment === 'production'
    || deployment === 'demo'
    || deployment === 'hosted'
    || process.env.NODE_ENV === 'production'
    || process.env.VERCEL === '1'
    || process.env.JP_INVEST_HOSTED_DEMO === '1';
}

function isLoopbackRuntime(context: ProviderCallContext) {
  if (context.runtime?.deployment === 'local' || context.runtime?.deployment === 'poc') return true;
  const host = normalizeHost(context.runtime?.host) ?? hostFromUrl(context.runtime?.requestUrl);
  if (!host) return false;
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

function normalizeHost(input: string | null | undefined) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.startsWith('[')) return trimmed.split(']')[0] + ']';
  return trimmed.split(':')[0] || null;
}

function hostFromUrl(input: string | undefined) {
  if (!input) return null;
  try {
    return new URL(input).hostname;
  } catch {
    return null;
  }
}
