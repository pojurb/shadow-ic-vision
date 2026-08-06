import { load } from 'cheerio';

/**
 * Whether a fetched secondary document is an article/release, as opposed to a
 * homepage, a section index, or any other navigation page.
 *
 * Added 2026-08-06. `DEC-0015` defines its source classes by *document type* —
 * Class A is "direct company press releases and investor relations
 * announcements", Class B is news articles — but Class-C promotion classified
 * candidates by the URL's origin, and then by the URL's path shape. Neither
 * reads the document, so neither can enforce what the record actually says.
 * `ADR-0006` is explicit that a discovered target must be fetched **and
 * classified**.
 *
 * Deterministic and free: publishers already declare this in the markup they
 * serve for their own SEO and social-preview tooling. Measured against every
 * secondary snapshot retained for the real TLKM thesis — 15 documents — this
 * separates them exactly, with no false positive and no false negative:
 *
 *   - 10 genuine issuer releases and news articles: `og:type=article`, and
 *     JSON-LD `@type` of `NewsArticle`.
 *   - The 5 pages found mislabelled as "Web-discovered issuer release": the
 *     issuer homepage and four IR overview/report-index pages, all
 *     `og:type=website` with no article JSON-LD.
 *
 * No model call is involved, so this carries none of `DEC-0016`'s constraints.
 * A publisher that declares nothing is `undetermined` rather than assumed
 * either way — the caller decides what to do with that, and the honest default
 * is to fail closed.
 */
export type SecondaryDocumentKind = 'article' | 'not_article' | 'undetermined';

const ARTICLE_LD_TYPES = new Set([
  'article', 'newsarticle', 'reportagenewsarticle', 'analysisnewsarticle',
  'backgroundnewsarticle', 'opinionnewsarticle', 'reviewnewsarticle',
  'blogposting', 'pressrelease',
]);

/** `@type` may be a string or an array; JSON-LD may also nest under `@graph`. */
function collectLdTypes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectLdTypes(item, into);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  if (typeof type === 'string') into.add(type.toLowerCase());
  if (Array.isArray(type)) for (const item of type) if (typeof item === 'string') into.add(item.toLowerCase());
  if (record['@graph']) collectLdTypes(record['@graph'], into);
}

export function classifySecondaryDocument(html: string): SecondaryDocumentKind {
  const $ = load(html);

  const ldTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;
    // A single malformed block must not discard the others, and must never
    // throw into the promotion path's soft-failure discipline.
    try { collectLdTypes(JSON.parse(raw), ldTypes); } catch { /* ignore this block */ }
  });
  if ([...ldTypes].some((type) => ARTICLE_LD_TYPES.has(type))) return 'article';

  const ogType = $('meta[property="og:type"]').attr('content')?.trim().toLowerCase()
    ?? $('meta[name="og:type"]').attr('content')?.trim().toLowerCase();
  if (ogType === 'article') return 'article';
  /*
   * `website` is the value a CMS emits for a homepage or a section index, and
   * is the only negative this asserts on. Other values (`profile`, `video.*`,
   * …) are left undetermined rather than read as a denial of articlehood.
   */
  if (ogType === 'website') return 'not_article';

  // Structured article metadata without either declaration above.
  if ($('meta[property="article:published_time"]').length > 0) return 'article';

  return 'undetermined';
}
