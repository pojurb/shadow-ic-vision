import { SourceAdapter, SourceSnapshot } from './types';

export class IdxAdapter implements SourceAdapter {
  async fetchSnapshot(ticker: string, documentType: string): Promise<SourceSnapshot> {
    // Stub implementation returning a deterministic snapshot
    return {
      sourceUrl: `https://www.idx.co.id/perusahaan-tercatat/profil-perusahaan-tercatat/detail-profile/${ticker}`,
      sourceFormat: 'html',
      retrievalTimestamp: new Date().toISOString(),
      rawBytes: `
        <html>
          <body>
            <h1>Laporan Keuangan ${ticker}</h1>
            <p>Perseroan mencatatkan laba bersih sebesar Rp 1,5 Triliun pada kuartal ini, naik 10% dari periode yang sama tahun lalu.</p>
            <p>Fokus utama perusahaan tahun depan adalah ekspansi digital.</p>
          </body>
        </html>
      `
    };
  }
}
