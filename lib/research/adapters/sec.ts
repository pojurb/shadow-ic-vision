import type { OfficialHttpClient } from '../http';
import { ResearchSourceError } from '../errors';
import { unavailableOutcome } from './helpers';
import type { SourceAdapter, SourceDocumentRef, SourceOutcome, SourceQuery, SourceSnapshot } from './types';

type TickerRow = [number | string, string, string, string];
type TickerPayload = { fields?: string[]; data?: TickerRow[] };
type SubmissionPayload = {
  name?: string;
  filings?: { recent?: Record<string, unknown[]> };
};

export class SecAdapter implements SourceAdapter {
  readonly mode = 'live' as const;

  constructor(private readonly http: OfficialHttpClient, private readonly userAgent: string) {}

  async discover(query: SourceQuery): Promise<SourceOutcome<SourceDocumentRef[]>> {
    if (!this.userAgent.trim() || !this.userAgent.includes('@')) {
      return { kind: 'unavailable', code: 'source_configuration', message: 'Live SEC research requires SEC_USER_AGENT with an application name and contact email.' };
    }

    try {
      const tickerResult = await this.http.get('https://www.sec.gov/files/company_tickers_exchange.json', 'application/json');
      const tickerPayload = JSON.parse(new TextDecoder().decode(tickerResult.bytes)) as TickerPayload;
      const row = tickerPayload.data?.find((candidate) => String(candidate[2]).toUpperCase() === query.ticker.toUpperCase());
      if (!row) return { kind: 'not_found', code: 'source_not_found', message: `SEC ticker mapping did not contain ${query.ticker}.` };

      const cik = String(row[0]).padStart(10, '0');
      const submissionsResult = await this.http.get(`https://data.sec.gov/submissions/CIK${cik}.json`, 'application/json');
      const payload = JSON.parse(new TextDecoder().decode(submissionsResult.bytes)) as SubmissionPayload;
      const filing = selectLatestFiling(payload.filings?.recent ?? {}, query.documentTypes);
      if (!filing) return { kind: 'not_found', code: 'source_not_found', message: `SEC has no eligible 10-Q or 10-K filing for ${query.ticker}.` };

      const accessionPath = filing.accessionNumber.replace(/-/g, '');
      const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionPath}/${encodeURIComponent(filing.primaryDocument)}`;
      return { kind: 'found', value: [{
        documentId: filing.accessionNumber,
        market: 'US',
        ticker: query.ticker.toUpperCase(),
        sourceUrl,
        sourceName: `${payload.name ?? row[1]} SEC ${filing.form} filed ${filing.filingDate}`,
        sourceTier: 'official',
        publishDate: filing.filingDate,
        sourceFormat: filing.primaryDocument.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
      }] };
    } catch (error) {
      return unavailableOutcome(error, 'SEC discovery failed.');
    }
  }

  async fetchSnapshot(document: SourceDocumentRef): Promise<SourceOutcome<SourceSnapshot>> {
    try {
      const result = await this.http.get(document.sourceUrl, 'text/html,application/pdf;q=0.9');
      return { kind: 'found', value: {
        ...document,
        sourceUrl: result.url,
        sourceFormat: inferFormat(result.contentType, result.url),
        rawBytes: result.bytes,
        retrievalTimestamp: new Date().toISOString(),
        contentType: result.contentType,
        httpStatus: result.status,
      } };
    } catch (error) {
      return unavailableOutcome(error, 'SEC document fetch failed.');
    }
  }
}

export function selectLatestFiling(recent: Record<string, unknown[]>, requestedForms: string[]) {
  const accessions = stringArray(recent.accessionNumber);
  const forms = stringArray(recent.form);
  const filingDates = stringArray(recent.filingDate);
  const primaryDocuments = stringArray(recent.primaryDocument);
  const allowed = requestedForms.length ? requestedForms : ['10-Q', '10-K'];

  for (const preferredForm of allowed) {
    for (let index = 0; index < forms.length; index += 1) {
      if (forms[index] === preferredForm && accessions[index] && primaryDocuments[index]) {
        return {
          accessionNumber: accessions[index],
          form: forms[index],
          filingDate: filingDates[index] || null,
          primaryDocument: primaryDocuments[index],
        };
      }
    }
  }
  return null;
}

function stringArray(value: unknown[] | undefined): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? '')) : [];
}

function inferFormat(contentType: string, url: string): 'html' | 'pdf' {
  if (contentType === 'application/pdf' || url.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (contentType.includes('html') || contentType === 'text/plain') return 'html';
  throw new ResearchSourceError('unsupported_document', `Unsupported SEC content type: ${contentType}.`);
}
