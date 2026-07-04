import type { SourceErrorCode, SourceSnapshot } from './adapters/types';

export class ResearchSourceError extends Error {
  constructor(
    public readonly code: SourceErrorCode,
    message: string,
    public readonly context?: { snapshot: SourceSnapshot; documentHash: string },
  ) {
    super(message);
    this.name = 'ResearchSourceError';
  }
}

export function isDegradedSourceError(error: unknown): error is ResearchSourceError {
  return error instanceof ResearchSourceError && error.code !== 'source_configuration';
}
