import { describe, expect, it } from 'vitest';
import { createHash, normalizeText, verifyExactMatch } from '@/lib/research/verifier';

describe('citation verifier', () => {
  const source = normalizeText("The company's commercial revenue grew 40% year-over-year.");

  it('allows a character-exact substring', () => {
    expect(verifyExactMatch('commercial revenue grew 40%', source)).toBe(true);
  });

  it.each([
    'commercial revenue grew 41%',
    'Commercial revenue grew 40%',
    'commercial revenue grew 40% (industry leading)',
  ])('blocks a mutated quote: %s', (quote) => {
    expect(() => verifyExactMatch(quote, source)).toThrow('CITATION HALLUCINATION DETECTED');
  });

  it('canonicalizes source whitespace without changing case', () => {
    expect(normalizeText('  Revenue\n\tgrew   40%  ')).toBe('Revenue grew 40%');
  });

  it('creates stable SHA-256 hashes', () => {
    expect(createHash('jp-invest')).toBe(createHash('jp-invest'));
    expect(createHash('jp-invest')).toHaveLength(64);
  });
});
