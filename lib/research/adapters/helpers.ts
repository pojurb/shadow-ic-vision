import type { SourceOutcome } from './types';
import { ResearchSourceError } from '../errors';

export function unavailableOutcome<T>(error: unknown, fallbackMessage: string): SourceOutcome<T> {
  if (error instanceof ResearchSourceError) {
    if (error.code === 'source_not_found') return { kind: 'not_found', code: 'source_not_found', message: error.message };
    return { kind: 'unavailable', code: error.code, message: error.message };
  }
  return { kind: 'unavailable', code: 'source_http_error', message: fallbackMessage };
}
