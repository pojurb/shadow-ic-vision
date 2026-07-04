import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the provided text.
 * Used for chain-of-custody tracking.
 */
export function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Standardizes text for deterministic matching.
 * Normalizes whitespace while preserving case for character-exact verification.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministically checks if the quote is a 100% exact substring of the canonical source text.
 * @throws Error if the quote is a hallucination or not found.
 */
export function verifyExactMatch(quote: string, canonicalSource: string): boolean {
  if (!canonicalSource.includes(quote)) {
    throw new Error(`CITATION HALLUCINATION DETECTED: Quote not found in source text.\nQuote: "${quote}"`);
  }

  return true;
}
