import { describe, expect, it } from 'vitest';
import { classifyAssurance } from '@/lib/research/assurance';

describe('classifyAssurance', () => {
  /*
   * The trap this module exists downstream of: `"unaudited".includes("audited")`
   * is true, which is exactly why `issuer.ts`'s TIER1 lists deliberately carry
   * no 'audited' token at all. Any implementation that substring-matches
   * "audited" first will call every unaudited interim report audited — the one
   * direction this must never fail in.
   */
  it('reads an explicit Indonesian "not audited" title as unaudited, not audited', () => {
    // Verbatim from IDX's announcement API for TLKM's Q1 2026 filing.
    expect(classifyAssurance({ title: 'Penyampaian Laporan Keuangan Interim Yang Tidak Diaudit' })).toBe('unaudited');
  });

  it('reads an explicit English "unaudited" title as unaudited', () => {
    expect(classifyAssurance({ title: 'Unaudited Interim Financial Statements Q1 2026' })).toBe('unaudited');
  });

  it('reads an explicit audited annual title as audited', () => {
    // Also verbatim from IDX, the annual counterpart of the case above.
    expect(classifyAssurance({ title: 'Penyampaian Laporan Keuangan Tahunan' })).toBe('audited');
    expect(classifyAssurance({ title: 'Audited Consolidated Financial Statements 2025' })).toBe('audited');
  });

  it('maps SEC form codes, which are the least ambiguous signal available', () => {
    expect(classifyAssurance({ formCode: '10-K' })).toBe('audited');
    expect(classifyAssurance({ formCode: '20-F' })).toBe('audited');
    expect(classifyAssurance({ formCode: '10-Q' })).toBe('unaudited');
    // Amendments inherit the assurance of the form they amend.
    expect(classifyAssurance({ formCode: '10-K/A' })).toBe('audited');
    expect(classifyAssurance({ formCode: '10-Q/A' })).toBe('unaudited');
  });

  it('falls back to period shape in a filename when no explicit wording exists', () => {
    // Real TLKM filenames from the live corpus.
    expect(classifyAssurance({ fileName: 'Telkom-FS-Bahasa-TW-II-2026.pdf' })).toBe('unaudited');
    expect(classifyAssurance({ fileName: 'TLKM-2025AR-fullbook-54-00-hires.pdf' })).toBe('audited');
    expect(classifyAssurance({ fileName: 'FinancialStatement-2026-I-TLKM.pdf' })).toBe('unknown');
  });

  it('prefers an explicit statement over an inferred period shape', () => {
    // Annual-shaped name, but the title says plainly it is not audited.
    expect(classifyAssurance({
      title: 'Laporan Keuangan Tahunan Yang Tidak Diaudit',
      fileName: 'TLKM-2025AR-fullbook.pdf',
    })).toBe('unaudited');
  });

  it('returns unknown rather than guessing, and never defaults to audited', () => {
    expect(classifyAssurance({})).toBe('unknown');
    expect(classifyAssurance({ title: null, fileName: null, formCode: null })).toBe('unknown');
    expect(classifyAssurance({ title: 'Sustainability Report 2025' })).toBe('unknown');
    expect(classifyAssurance({ fileName: 'investor-presentation.pdf' })).toBe('unknown');
  });
});
