import { describe, expect, it } from 'vitest';
import { classifySecondaryDocument } from '@/lib/research/secondary-document';

/*
 * Fixtures mirror the declarations actually found in the secondary snapshots
 * retained for the real TLKM thesis. Across those 15 documents the signal
 * separated them exactly: every genuine issuer release and news article
 * declared `og:type=article` with JSON-LD `NewsArticle`, and all five pages
 * that had been mislabelled "Web-discovered issuer release" — the issuer
 * homepage and four IR overview/report-index pages — declared
 * `og:type=website` with no article JSON-LD.
 */
describe('classifySecondaryDocument', () => {
  it('recognises an article from JSON-LD, including inside an @graph or a type array', () => {
    expect(classifySecondaryDocument(
      '<html><head><script type="application/ld+json">{"@type":"NewsArticle","headline":"x"}</script></head></html>',
    )).toBe('article');

    expect(classifySecondaryDocument(
      '<html><head><script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["Article","CreativeWork"]}]}</script></head></html>',
    )).toBe('article');
  });

  it('recognises an article from og:type when no JSON-LD is present', () => {
    expect(classifySecondaryDocument('<html><head><meta property="og:type" content="article"/></head></html>')).toBe('article');
  });

  it('classifies a section index or homepage as not an article', () => {
    expect(classifySecondaryDocument('<html><head><meta property="og:type" content="website"/></head></html>')).toBe('not_article');
  });

  /*
   * The mislabelled IR pages carried `DataFeed`/`WebPage` JSON-LD alongside
   * `og:type=website`. A non-article JSON-LD type must not be mistaken for an
   * article declaration, and must not suppress the `website` negative either.
   */
  it('does not read a non-article JSON-LD type as an article', () => {
    expect(classifySecondaryDocument(
      '<html><head><script type="application/ld+json">{"@type":"DataFeed"}</script>'
      + '<meta property="og:type" content="website"/></head></html>',
    )).toBe('not_article');
  });

  it('returns undetermined when the document declares nothing, rather than guessing', () => {
    expect(classifySecondaryDocument('<html><body><p>Some text with no declarations at all.</p></body></html>')).toBe('undetermined');
    // An unrelated og:type is not a denial of articlehood.
    expect(classifySecondaryDocument('<html><head><meta property="og:type" content="profile"/></head></html>')).toBe('undetermined');
  });

  it('survives a malformed JSON-LD block without throwing or discarding the others', () => {
    expect(classifySecondaryDocument(
      '<html><head><script type="application/ld+json">{ not json </script>'
      + '<script type="application/ld+json">{"@type":"NewsArticle"}</script></head></html>',
    )).toBe('article');
  });
});
