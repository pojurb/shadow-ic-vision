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
 * Converts to lowercase and normalizes whitespace (replaces all contiguous whitespace with a single space).
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministically checks if the quote is a 100% exact substring of the canonical source text.
 * @throws Error if the quote is a hallucination or not found.
 */
export function verifyExactMatch(quote: string, canonicalSource: string): boolean {
  const normalizedQuote = normalizeText(quote);
  const normalizedSource = normalizeText(canonicalSource);

  if (!normalizedSource.includes(normalizedQuote)) {
    throw new Error(`CITATION HALLUCINATION DETECTED: Quote not found in source text.\nQuote: "${quote}"`);
  }

  return true;
}
