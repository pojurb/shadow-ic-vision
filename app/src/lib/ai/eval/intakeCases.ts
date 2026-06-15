import type { ContextSource } from "@/lib/domain/types";
import type { IntakeOutput } from "@/lib/ai/schemas";
import type { IntakeWebEvidence } from "@/lib/ai/intakeContext";
import { buildResearchAugmentedIntakeText } from "@/lib/ai/intakeContext";

interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface ExpectedIntakeValue {
  value: number;
  tolerance?: number;
}

export interface IntakeEvalExpectations {
  ticker?: string;
  vertical: "stocks" | "startups" | "conventional";
  mode: "scoping" | "figures";
  queryIncludes: string[];
  requiredFields: string[];
  forbiddenFields: string[];
  expectedValues?: Record<string, ExpectedIntakeValue>;
  minSearchResults?: number;
  minFetchedSearchPages?: number;
  minEvidenceCandidates?: number;
  requireRelevantSearchResults?: boolean;
  forbiddenEvidencePatterns?: RegExp[];
  requiredEvidenceUrls?: string[];
}

export interface IntakeEvalCase {
  id: string;
  name: string;
  conversationText: string;
  allowWebSearch: boolean;
  sources: ContextSource[];
  expected: IntakeEvalExpectations;
  mockFetchByUrl: Record<string, string>;
  mockSearchByQuery: Record<string, WebSearchResult[]>;
  passingOutput: IntakeOutput;
}

const emptyThesis = {
  summary: "",
  assumptions: [],
  thesisBreakers: [],
  watchItems: [],
  valuationAssumptions: [],
  catalysts: [],
  openQuestions: [],
  evidenceCandidates: [],
};

function chart(symbol: string, price: number): string {
  return JSON.stringify({
    chart: {
      result: [
        {
          meta: {
            symbol,
            exchangeName: "Jakarta",
            currency: "IDR",
            regularMarketPrice: price,
            previousClose: price - 25,
            regularMarketTime: 1_786_368_000,
          },
        },
      ],
    },
  });
}

export const INTAKE_EVAL_CASES: IntakeEvalCase[] = [
  {
    id: "mbma-noisy-stock",
    name: "MBMA noisy stock prompt with polluted search result",
    conversationText: [
      "User: MBMA Stocks",
      "User: find it through internet, but only use real visible data.",
    ].join("\n"),
    allowWebSearch: true,
    sources: [],
    expected: {
      ticker: "MBMA",
      vertical: "stocks",
      mode: "figures",
      queryIncludes: [
        "MBMA.JK stock quote EPS ROE market cap",
        "MBMA saham IDX laporan keuangan EPS ROE",
        "MBMA investor relations annual report financial statements",
      ],
      requiredFields: ["price", "eps", "roe"],
      forbiddenFields: ["discountRate", "terminalMult"],
      expectedValues: {
        price: { value: 5000 },
        eps: { value: 500 },
        roe: { value: 15 },
      },
      minSearchResults: 2,
      minFetchedSearchPages: 2,
      minEvidenceCandidates: 2,
      requireRelevantSearchResults: true,
      forbiddenEvidencePatterns: [/jpmorgan/i, /nasdaq/i, /generic annual report/i],
      requiredEvidenceUrls: [
        "https://finance.yahoo.com/quote/MBMA.JK",
        "https://stockanalysis.com/quote/idx/MBMA/financials/",
      ],
    },
    mockFetchByUrl: {
      "https://query1.finance.yahoo.com/v8/finance/chart/MBMA.JK?range=5d&interval=1d": chart("MBMA.JK", 5000),
      "https://finance.yahoo.com/quote/MBMA.JK": "MBMA.JK quote page. Regular market price 5000 IDR.",
      "https://stockanalysis.com/quote/idx/MBMA/financials/": "MBMA financials. EPS 500. Return on equity 15%.",
      "https://www.reuters.com/markets/companies/MBMA.JK": "MBMA.JK company profile and market data.",
    },
    mockSearchByQuery: {
      "MBMA.JK stock quote EPS ROE market cap": [
        {
          title: "MBMA.JK stock quote",
          url: "https://finance.yahoo.com/quote/MBMA.JK",
          content: "MBMA.JK quote with price 5000 IDR.",
        },
        {
          title: "MBMA financials",
          url: "https://stockanalysis.com/quote/idx/MBMA/financials/",
          content: "MBMA EPS 500 and ROE 15%.",
        },
        {
          title: "JPMorgan annual report",
          url: "https://example.com/jpmorgan",
          content: "JPMorgan Chase annual report.",
        },
      ],
      "MBMA saham IDX laporan keuangan EPS ROE": [
        {
          title: "MBMA laporan keuangan",
          url: "https://www.reuters.com/markets/companies/MBMA.JK",
          content: "MBMA.JK financial profile.",
        },
      ],
      "MBMA investor relations annual report financial statements": [],
    },
    passingOutput: {
      vertical: "stocks",
      mode: "figures",
      assetName: "MBMA",
      title: "MBMA stock analysis",
      note: "Price, EPS, and ROE were visible in the research evidence.",
      fields: [
        {
          key: "price",
          value: 5000,
          source: "inferred",
          provenance: {
            title: "MBMA.JK stock quote",
            url: "https://finance.yahoo.com/quote/MBMA.JK",
            asOf: "2026-08-08T00:00:00Z",
            valueType: "current",
            confidence: "high",
            sourceKind: "third_party",
          },
        },
        {
          key: "eps",
          value: 500,
          source: "inferred",
          provenance: {
            title: "MBMA financials",
            url: "https://stockanalysis.com/quote/idx/MBMA/financials/",
            asOf: "FY2025",
            valueType: "annual",
            confidence: "high",
            sourceKind: "third_party",
          },
        },
        {
          key: "roe",
          value: 15,
          source: "inferred",
          provenance: {
            title: "MBMA financials",
            url: "https://stockanalysis.com/quote/idx/MBMA/financials/",
            asOf: "FY2025",
            valueType: "annual",
            confidence: "medium",
            sourceKind: "third_party",
          },
        },
      ],
      thesis: {
        ...emptyThesis,
        summary: "MBMA has enough visible price and profitability data for a first-pass stock setup.",
        evidenceCandidates: [
          {
            title: "MBMA.JK stock quote",
            url: "https://finance.yahoo.com/quote/MBMA.JK",
            note: "Visible market price.",
            type: "market_data",
            relation: "neutral",
            reliability: "third_party",
          },
          {
            title: "MBMA financials",
            url: "https://stockanalysis.com/quote/idx/MBMA/financials/",
            note: "Visible EPS and ROE.",
            type: "article",
            relation: "neutral",
            reliability: "third_party",
          },
        ],
      },
    },
  },
  {
    id: "bbca-followup-context",
    name: "BBCA lowercase ticker retained through follow-up turns",
    conversationText: [
      "User: coba analisa saham bca dengan ticker bbca",
      "User: can you help me find that information?",
      "User: find it through internet",
    ].join("\n"),
    allowWebSearch: true,
    sources: [],
    expected: {
      ticker: "BBCA",
      vertical: "stocks",
      mode: "figures",
      queryIncludes: [
        "BBCA.JK stock quote EPS ROE market cap",
        "BBCA saham IDX laporan keuangan EPS ROE",
      ],
      requiredFields: ["price", "eps", "roe"],
      forbiddenFields: ["discountRate", "terminalMult"],
      expectedValues: {
        price: { value: 9000 },
        eps: { value: 600 },
        roe: { value: 20 },
      },
      minSearchResults: 2,
      minFetchedSearchPages: 2,
      minEvidenceCandidates: 2,
      requireRelevantSearchResults: true,
      forbiddenEvidencePatterns: [/jpmorgan/i, /generic annual report/i],
      requiredEvidenceUrls: [
        "https://finance.yahoo.com/quote/BBCA.JK",
        "https://example.com/bbca-financials",
      ],
    },
    mockFetchByUrl: {
      "https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=5d&interval=1d": chart("BBCA.JK", 9000),
      "https://finance.yahoo.com/quote/BBCA.JK": "BBCA.JK quote page. Regular market price 9000 IDR.",
      "https://example.com/bbca-financials": "BBCA financial page. EPS 600. ROE 20%.",
    },
    mockSearchByQuery: {
      "BBCA.JK stock quote EPS ROE market cap": [
        {
          title: "BBCA.JK stock quote",
          url: "https://finance.yahoo.com/quote/BBCA.JK",
          content: "BBCA.JK price 9000 IDR.",
        },
        {
          title: "BBCA financials",
          url: "https://example.com/bbca-financials",
          content: "BBCA EPS 600 and ROE 20%.",
        },
      ],
      "BBCA saham IDX laporan keuangan EPS ROE": [
        {
          title: "BBCA laporan keuangan",
          url: "https://example.com/bbca-financials",
          content: "BBCA EPS 600 and ROE 20%.",
        },
      ],
      "BBCA investor relations annual report financial statements": [],
    },
    passingOutput: {
      vertical: "stocks",
      mode: "figures",
      assetName: "BBCA",
      title: "BBCA stock analysis",
      note: "Price, EPS, and ROE were visible in the research evidence.",
      fields: [
        {
          key: "price",
          value: 9000,
          source: "inferred",
          provenance: {
            title: "BBCA.JK stock quote",
            url: "https://finance.yahoo.com/quote/BBCA.JK",
            asOf: "2026-08-08T00:00:00Z",
            valueType: "current",
            confidence: "high",
            sourceKind: "third_party",
          },
        },
        {
          key: "eps",
          value: 600,
          source: "inferred",
          provenance: {
            title: "BBCA financials",
            url: "https://example.com/bbca-financials",
            asOf: "FY2025",
            valueType: "annual",
            confidence: "high",
            sourceKind: "third_party",
          },
        },
        {
          key: "roe",
          value: 20,
          source: "inferred",
          provenance: {
            title: "BBCA financials",
            url: "https://example.com/bbca-financials",
            asOf: "FY2025",
            valueType: "annual",
            confidence: "medium",
            sourceKind: "third_party",
          },
        },
      ],
      thesis: {
        ...emptyThesis,
        summary: "BBCA has visible market and profitability data for an initial stock setup.",
        evidenceCandidates: [
          {
            title: "BBCA.JK stock quote",
            url: "https://finance.yahoo.com/quote/BBCA.JK",
            note: "Visible market price.",
            type: "market_data",
            relation: "neutral",
            reliability: "third_party",
          },
          {
            title: "BBCA financials",
            url: "https://example.com/bbca-financials",
            note: "Visible EPS and ROE.",
            type: "article",
            relation: "neutral",
            reliability: "third_party",
          },
        ],
      },
    },
  },
  {
    id: "goto-price-only",
    name: "GOTO price-only evidence remains scoping",
    conversationText: "User: analyze ticker GOTO, find current stock data only if visible",
    allowWebSearch: true,
    sources: [],
    expected: {
      ticker: "GOTO",
      vertical: "stocks",
      mode: "scoping",
      queryIncludes: ["GOTO.JK stock quote EPS ROE market cap"],
      requiredFields: ["price"],
      forbiddenFields: ["eps", "roe", "discountRate", "terminalMult"],
      expectedValues: {
        price: { value: 80 },
      },
      minSearchResults: 1,
      minFetchedSearchPages: 1,
      minEvidenceCandidates: 1,
      requireRelevantSearchResults: true,
      forbiddenEvidencePatterns: [/eps/i, /roe/i, /generic annual report/i],
      requiredEvidenceUrls: ["https://finance.yahoo.com/quote/GOTO.JK"],
    },
    mockFetchByUrl: {
      "https://query1.finance.yahoo.com/v8/finance/chart/GOTO.JK?range=5d&interval=1d": chart("GOTO.JK", 80),
      "https://finance.yahoo.com/quote/GOTO.JK": "GOTO.JK quote page. Regular market price 80 IDR. No EPS or ROE visible in this extract.",
    },
    mockSearchByQuery: {
      "GOTO.JK stock quote EPS ROE market cap": [
        {
          title: "GOTO.JK stock quote",
          url: "https://finance.yahoo.com/quote/GOTO.JK",
          content: "GOTO.JK price 80 IDR.",
        },
      ],
      "GOTO saham IDX laporan keuangan EPS ROE": [],
      "GOTO investor relations annual report financial statements": [],
    },
    passingOutput: {
      vertical: "stocks",
      mode: "scoping",
      assetName: "GOTO",
      title: "GOTO stock analysis",
      note: "Only price was visible; EPS and ROE were not supported by the evidence.",
      fields: [{ key: "price", value: 80, source: "inferred" }],
      thesis: {
        ...emptyThesis,
        summary: "GOTO needs more financial data before the valuation engine can run.",
        openQuestions: ["What are the latest EPS and ROE figures?"],
        evidenceCandidates: [
          {
            title: "GOTO.JK stock quote",
            url: "https://finance.yahoo.com/quote/GOTO.JK",
            note: "Visible market price.",
            type: "market_data",
            relation: "neutral",
            reliability: "third_party",
          },
        ],
      },
    },
  },
];

export function expectedEvidenceForCase(testCase: IntakeEvalCase): IntakeWebEvidence {
  const searchResults = Object.values(testCase.mockSearchByQuery).flat();
  return {
    fetchedLinks: [],
    searchQuery: testCase.expected.queryIncludes[0] ?? "",
    searchQueries: testCase.expected.queryIncludes,
    marketData: Object.entries(testCase.mockFetchByUrl)
      .filter(([url]) => url.includes("/v8/finance/chart/"))
      .map(([url, content]) => ({ url, content })),
    searchResults,
    searchedPages: Object.entries(testCase.mockFetchByUrl)
      .filter(([url]) => !url.includes("/v8/finance/chart/"))
      .map(([url, content]) => ({ url, content })),
    errors: [],
  };
}

export function buildIntakeEvalText(testCase: IntakeEvalCase, evidence = expectedEvidenceForCase(testCase)): string {
  return buildResearchAugmentedIntakeText(testCase.conversationText, evidence);
}

export function createIntakeEvalFetch(testCase: IntakeEvalCase): typeof fetch {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string; url?: string };
    const endpoint = String(url);

    if (endpoint === "/api/web-search") {
      return new Response(JSON.stringify({ results: testCase.mockSearchByQuery[body.query ?? ""] ?? [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (endpoint === "/api/web-fetch") {
      const content = body.url ? testCase.mockFetchByUrl[body.url] : undefined;
      if (content) {
        return new Response(JSON.stringify({ url: body.url, content, status: 200 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "mock fixture has no content for URL" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown mock endpoint" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}
