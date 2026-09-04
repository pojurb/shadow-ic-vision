/**
 * M013 follow-on, step 6 — the assurance axis.
 *
 * An unaudited interim statement and an audited annual one are both statutory
 * filings, both reach `sourceTier: 'official'`, and both can produce
 * `exact_verified` evidence. Nothing downstream has ever distinguished them,
 * so a figure that a later audited report may restate reads exactly like one
 * that has already been through an audit. Confirmed live on the TLKM thesis:
 * IDX's own announcement title for the Q1 2026 filing is *"Penyampaian
 * Laporan Keuangan Interim Yang Tidak Diaudit"*, and it classifies `tier1`
 * identically to the annual report.
 *
 * This module answers one narrow question — what assurance does THIS document
 * carry — and nothing else. It does not decide whether the document belongs in
 * Tier 1 at all (`classifyIssuerDocument` owns that), and it does not decide
 * what the verdict should do about an unaudited figure (a product decision,
 * deliberately not encoded here).
 *
 * Pure and total: every input returns a value, and the value it returns when
 * it cannot tell is `unknown` — never `audited`. Failing toward "more assured
 * than we know" is the one direction this must never fail in.
 */

export type AssuranceLevel =
  /** A statutory audited report — an auditor's opinion is attached. */
  | 'audited'
  /** An interim or otherwise explicitly unaudited statement. */
  | 'unaudited'
  /** No signal available. Distinct from `unaudited`: we do not know. */
  | 'unknown';

/** Lowercased, with every non-alphanumeric run collapsed to a single space. */
function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/*
 * Checked first, and the reason the order is not an implementation detail:
 * `"unaudited".includes("audited")` is true, and `"tidak diaudit"` contains
 * `"diaudit"`. Any positive check that runs first reads every one of these as
 * audited. `issuer.ts` carries the same warning for the same reason.
 */
const NOT_AUDITED_PHRASES = ['tidak diaudit', 'belum diaudit', 'tanpa audit', 'unaudited', 'not audited'];
const AUDITED_PHRASES = ['audited', 'diaudit', 'audit report', 'laporan auditor'];

/** Period vocabulary, used only when no explicit assurance wording exists. */
const ANNUAL_TOKENS = new Set(['tahunan', 'annual', 'ar']);
const INTERIM_TOKENS = new Set(['interim', 'triwulan', 'tw', 'kuartal', 'semester']);
const INTERIM_PERIOD_PATTERNS = [
  /^(?:[1-4]q|q[1-4])(?:20)?\d{0,4}$/,   // q1, 3q25, q12026
  /^(?:[12]h|h[12])(?:20)?\d{0,4}$/,     // 1h, 1h26
  /^(?:3|6|9)m(?:20)?\d{0,4}$/,          // 9m25 — 12m is a full year, deliberately absent
];
/** `2025ar` / `2026tw` arrive glued; `issuer.ts` splits the same shape. */
const GLUED_YEAR_ABBREV = /^20\d{2}(ar|tw|fy)$/;

function tokensOf(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of text.split(' ')) {
    if (!raw) continue;
    tokens.add(raw);
    const glued = GLUED_YEAR_ABBREV.exec(raw);
    if (glued) tokens.add(glued[1]);
  }
  return tokens;
}

/**
 * Assurance for one document, from whatever signal the caller has. Every
 * adapter has a different one: IDX carries an explicit announcement title, SEC
 * carries a form code, the issuer crawl carries only a filename — so the
 * caller passes what it has and this decides, rather than each adapter
 * inventing its own rule.
 */
export function classifyAssurance(input: {
  title?: string | null;
  fileName?: string | null;
  formCode?: string | null;
}): AssuranceLevel {
  const wording = `${normalize(input.title)} ${normalize(input.fileName)}`.trim();

  if (NOT_AUDITED_PHRASES.some((phrase) => wording.includes(phrase))) return 'unaudited';
  if (AUDITED_PHRASES.some((phrase) => wording.includes(phrase))) return 'audited';

  /*
   * Form codes are the least ambiguous signal in the system — a 10-K carries
   * an auditor's opinion by definition and a 10-Q does not — so they outrank
   * the period-shape guesswork below, though not an issuer's own explicit
   * wording above. An amendment inherits what it amends.
   */
  const form = normalize(input.formCode).replace(/ a$/, '');
  if (form === '10 k' || form === '20 f' || form === '40 f') return 'audited';
  if (form === '10 q') return 'unaudited';

  const tokens = tokensOf(wording);
  const interim = [...tokens].some((t) => INTERIM_TOKENS.has(t)
    || INTERIM_PERIOD_PATTERNS.some((pattern) => pattern.test(t)));
  if (interim) return 'unaudited';
  if ([...tokens].some((t) => ANNUAL_TOKENS.has(t))) return 'audited';

  return 'unknown';
}
