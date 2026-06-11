import type { ChatMessage, ContextSource } from "@/lib/domain/types";

type FetchLike = typeof fetch;

interface WebFetchResult {
  url: string;
  content: string;
  status?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface IntakeWebEvidence {
  fetchedLinks: WebFetchResult[];
  searchQuery: string;
  searchQueries: string[];
  marketData: WebFetchResult[];
  searchResults: WebSearchResult[];
  searchedPages: WebFetchResult[];
  errors: string[];
}

const MAX_TRANSCRIPT_CHARS = 4_000;
const MAX_LINK_CHARS = 5_000;
const MAX_SEARCH_RESULT_CHARS = 900;
const MAX_SEARCH_PAGE_CHARS = 3_500;
const MAX_SEARCH_QUERIES = 3;
const MAX_SEARCH_RESULTS = 8;
const MAX_SEARCH_PAGES = 3;

const IGNORED_TICKER_WORDS = new Set([
  "user",
  "coba",
  "libs",
  "main",
  "test",
  "demo",
  "file",
  "link",
  "help",
  "this",
  "that",
  "have",
  "with",
  "from",
  "your",
  "them",
  "they",
  "some",
  "more",
  "does",
  "view",
  "show",
  "make",
  "deal",
  "date",
  "year",
  "rate",
  "debt",
  "cash",
  "grow",
  "free",
  "cost",
  "save",
  "edit",
  "post",
  "send",
  "saham",
  "stock",
  "bias",
  "buat",
  "dari",
  "pada",
  "yang",
  "akan",
  "dapat",
  "bisa",
  "sana",
  "sini",
  "baru",
  "lama",
  "baik",
  "juga",
  "atau",
  "saja",
  "kita",
  "kami",
  "saya",
  "kamu",
  "tiga",
  "lima",
  "satu",
  "info",
  "data",
  "case",
  "read",
  "true",
  "null",
  "feed",
  "good",
  "news",
  "plan",
  "calc",
  "book",
  "runs",
  "than",
  "will",
  "were",
  "been",
  "dont",
  "cant",
  "here",
  "much",
  "most",
  "real",
  "fair",
  "what",
  "high",
  "idr",
  "usd",
  "eps",
  "roe",
  "dcf",
  "npv",
  "ltv",
  "cac",
  "bep",
  "irr",
]);

interface AssetHint {
  ticker?: string;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)}\n[...truncated]` : clean;
}

export function buildIntakeConversationText(chat: ChatMessage[]): string {
  const lines = chat
    .filter((m) => m.role === "user")
    .map((m) => `User: ${m.content.trim()}`)
    .filter((line) => line !== "User:");

  return truncate(lines.join("\n"), MAX_TRANSCRIPT_CHARS);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function cleanTicker(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const ticker = raw.replace(/\.(JK|IDX)$/i, "").toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(ticker)) return undefined;
  return IGNORED_TICKER_WORDS.has(ticker.toLowerCase()) ? undefined : ticker;
}

export function extractIntakeAssetHint(conversationText: string): AssetHint {
  // Clean the prefix User: to avoid matching "User" as a ticker.
  const cleanText = conversationText.replace(/^User:\s*/gim, "");

  const explicit = cleanTicker(
    cleanText.match(/\b(?:ticker|kode|symbol)[ \t]*[:=]?[ \t]*([A-Za-z]{2,5})(?:\.(?:JK|IDX))?\b/i)?.[1],
  );
  if (explicit) return { ticker: explicit };

  const stockHint = cleanTicker(
    cleanText.match(
      /\b(?:saham|emiten|stock|stocks|analisa|analisis|analyze|analysis|evaluasi|eval)[ \t]+([a-zA-Z]{4})(?:\.(?:jk|idx))?\b/i,
    )?.[1],
  );
  if (stockHint) return { ticker: stockHint };

  const reverseStockHint = cleanTicker(
    cleanText.match(
      /\b([a-zA-Z]{4})[ \t]+(?:saham|emiten|stock|stocks|analisa|analisis|analyze|analysis|evaluasi|eval)\b/i,
    )?.[1],
  );
  if (reverseStockHint) return { ticker: reverseStockHint };

  const stockCode = cleanTicker(cleanText.match(/\b([A-Z]{4})(?:\.(?:JK|IDX))?\b/)?.[1]);
  if (stockCode) return { ticker: stockCode };

  const words = cleanText.match(/\b([a-zA-Z]{4})\b/g);
  if (words) {
    for (const word of words) {
      const fallback = cleanTicker(word);
      if (fallback) return { ticker: fallback };
    }
  }

  return {};
}

export function buildIntakeSearchQueries(conversationText: string): string[] {
  const hint = extractIntakeAssetHint(conversationText);
  if (hint.ticker) {
    return unique([
      `${hint.ticker}.JK stock quote EPS ROE market cap`,
      `${hint.ticker} saham IDX laporan keuangan EPS ROE`,
      `${hint.ticker} investor relations annual report financial statements`,
    ]).slice(0, MAX_SEARCH_QUERIES);
  }

  return [`${compact(conversationText).slice(0, 240)} latest valuation financial metrics`];
}

export function buildIntakeSearchQuery(conversationText: string): string {
  return buildIntakeSearchQueries(conversationText)[0] ?? "";
}

async function postJson(fetchImpl: FetchLike, url: string, body: unknown): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

function isRelevantSearchResult(result: WebSearchResult, hint: AssetHint): boolean {
  if (!hint.ticker) return true;
  const haystack = `${result.title} ${result.url} ${result.content}`.toLowerCase();
  return haystack.includes(hint.ticker.toLowerCase());
}

function resultKey(result: WebSearchResult): string {
  return result.url.trim().toLowerCase() || `${result.title}\n${result.content}`.trim().toLowerCase();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

function summarizeYahooChart(content: string): string | null {
  try {
    const data = JSON.parse(content) as {
      chart?: {
        result?: Array<{
          meta?: Record<string, unknown>;
        }>;
      };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const symbol = typeof meta.symbol === "string" ? meta.symbol : "";
    const currency = typeof meta.currency === "string" ? meta.currency : "";
    const exchange = typeof meta.exchangeName === "string" ? meta.exchangeName : "";
    const regularMarketPrice = parseNumber(meta.regularMarketPrice);
    const previousClose = parseNumber(meta.previousClose) ?? parseNumber(meta.chartPreviousClose);
    const asOf = parseNumber(meta.regularMarketTime);
    return [
      symbol && `Symbol: ${symbol}`,
      exchange && `Exchange: ${exchange}`,
      currency && `Currency: ${currency}`,
      regularMarketPrice != null && `Regular market price: ${regularMarketPrice}`,
      previousClose != null && `Previous close: ${previousClose}`,
      asOf != null && `Market timestamp (Unix seconds): ${asOf}`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}

function summarizeYahooQuoteSummary(content: string): string | null {
  try {
    const data = JSON.parse(content) as {
      quoteSummary?: {
        result?: Array<Record<string, Record<string, unknown>>>;
      };
    };
    const result = data.quoteSummary?.result?.[0];
    if (!result) return null;
    const price = result.price ?? {};
    const stats = result.defaultKeyStatistics ?? {};
    const financial = result.financialData ?? {};
    const symbol = typeof price.symbol === "string" ? price.symbol : "";
    const currency = typeof price.currency === "string" ? price.currency : "";
    const regularMarketPrice = parseNumber(price.regularMarketPrice);
    const trailingEps = parseNumber(stats.trailingEps);
    const returnOnEquity = parseNumber(financial.returnOnEquity);
    return [
      symbol && `Symbol: ${symbol}`,
      currency && `Currency: ${currency}`,
      regularMarketPrice != null && `Regular market price: ${regularMarketPrice}`,
      trailingEps != null && `Trailing EPS: ${trailingEps}`,
      returnOnEquity != null &&
        `Return on equity: ${returnOnEquity} (${(returnOnEquity * 100).toFixed(2)}% if reported as a decimal fraction)`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}

function summarizeMarketData(url: string, content: string): string {
  const summary = url.includes("/v8/finance/chart/")
    ? summarizeYahooChart(content)
    : url.includes("/v10/finance/quoteSummary/")
      ? summarizeYahooQuoteSummary(content)
      : null;
  return summary || truncate(content, MAX_SEARCH_PAGE_CHARS);
}

function marketDataUrls(hint: AssetHint): string[] {
  if (!hint.ticker) return [];
  const symbol = `${hint.ticker}.JK`;
  return [`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`];
}

export async function gatherIntakeWebEvidence({
  conversationText,
  sources,
  allowWebSearch,
  fetchImpl = fetch,
}: {
  conversationText: string;
  sources: ContextSource[];
  allowWebSearch: boolean;
  fetchImpl?: FetchLike;
}): Promise<IntakeWebEvidence> {
  const hint = extractIntakeAssetHint(conversationText);
  const searchQueries = allowWebSearch ? buildIntakeSearchQueries(conversationText) : [];
  const evidence: IntakeWebEvidence = {
    fetchedLinks: [],
    searchQuery: searchQueries[0] ?? "",
    searchQueries,
    marketData: [],
    searchResults: [],
    searchedPages: [],
    errors: [],
  };

  if (allowWebSearch) {
    for (const url of marketDataUrls(hint)) {
      try {
        const data = (await postJson(fetchImpl, "/api/web-fetch", { url })) as {
          url?: string;
          content?: string;
          status?: number;
          error?: string;
        };
        if (data.content) {
          evidence.marketData.push({
            url: data.url ?? url,
            content: summarizeMarketData(url, data.content),
            status: data.status,
          });
        } else if (data.error) {
          evidence.errors.push(`Market data ${url}: ${data.error}`);
        }
      } catch (err) {
        evidence.errors.push(`Market data ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (const source of sources) {
    if (source.kind !== "link") continue;
    try {
      const data = (await postJson(fetchImpl, "/api/web-fetch", { url: source.url })) as {
        url?: string;
        content?: string;
        status?: number;
        error?: string;
      };
      if (data.content) {
        evidence.fetchedLinks.push({
          url: data.url ?? source.url,
          content: truncate(data.content, MAX_LINK_CHARS),
          status: data.status,
        });
      } else if (data.error) {
        evidence.errors.push(`Fetch ${source.url}: ${data.error}`);
      }
    } catch (err) {
      evidence.errors.push(`Fetch ${source.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allowWebSearch && evidence.searchQueries.length) {
    const seen = new Set<string>();
    for (const query of evidence.searchQueries) {
      try {
        const data = (await postJson(fetchImpl, "/api/web-search", { query })) as {
          results?: WebSearchResult[];
          error?: string;
        };
        const results = (data.results ?? [])
          .filter((r) => r.title || r.url || r.content)
          .filter((r) => isRelevantSearchResult(r, hint))
          .map((r) => ({
            title: r.title ?? "",
            url: r.url ?? "",
            content: truncate(r.content ?? "", MAX_SEARCH_RESULT_CHARS),
          }));

        for (const result of results) {
          const key = resultKey(result);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          evidence.searchResults.push(result);
          if (evidence.searchResults.length >= MAX_SEARCH_RESULTS) break;
        }
        if (!results.length && data.error) evidence.errors.push(`Search "${query}": ${data.error}`);
      } catch (err) {
        evidence.errors.push(`Search "${query}": ${err instanceof Error ? err.message : String(err)}`);
      }
      if (evidence.searchResults.length >= MAX_SEARCH_RESULTS) break;
    }

    const pageUrls = evidence.searchResults
      .map((result) => result.url)
      .filter((url) => isHttpsUrl(url))
      .filter((url, index, urls) => urls.indexOf(url) === index)
      .slice(0, MAX_SEARCH_PAGES);

    for (const url of pageUrls) {
      try {
        const data = (await postJson(fetchImpl, "/api/web-fetch", { url })) as {
          url?: string;
          content?: string;
          status?: number;
          error?: string;
        };
        if (data.content) {
          evidence.searchedPages.push({
            url: data.url ?? url,
            content: truncate(data.content, MAX_SEARCH_PAGE_CHARS),
            status: data.status,
          });
        } else if (data.error) {
          evidence.errors.push(`Fetch search result ${url}: ${data.error}`);
        }
      } catch (err) {
        evidence.errors.push(`Fetch search result ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return evidence;
}

export function formatIntakeWebEvidence(evidence: IntakeWebEvidence): string {
  const blocks: string[] = [];

  if (evidence.marketData.length) {
    blocks.push(
      [
        "Market data extracts:",
        ...evidence.marketData.map((r, i) =>
          [`[${i + 1}] ${r.url}${r.status ? ` (HTTP ${r.status})` : ""}`, r.content].join("\n"),
        ),
      ].join("\n\n"),
    );
  }

  if (evidence.fetchedLinks.length) {
    blocks.push(
      [
        "Attached link extracts:",
        ...evidence.fetchedLinks.map((r, i) =>
          [`[${i + 1}] ${r.url}${r.status ? ` (HTTP ${r.status})` : ""}`, r.content].join("\n"),
        ),
      ].join("\n\n"),
    );
  }

  if (evidence.searchedPages.length) {
    blocks.push(
      [
        "Fetched search-result page extracts:",
        ...evidence.searchedPages.map((r, i) =>
          [`[${i + 1}] ${r.url}${r.status ? ` (HTTP ${r.status})` : ""}`, r.content].join("\n"),
        ),
      ].join("\n\n"),
    );
  }

  if (evidence.searchResults.length) {
    blocks.push(
      [
        `Web search result snippets for: ${evidence.searchQueries.join(" | ")}`,
        ...evidence.searchResults.map((r, i) =>
          [`[${i + 1}] ${r.title}`, r.url, r.content].filter(Boolean).join("\n"),
        ),
      ].join("\n\n"),
    );
  }

  if (evidence.errors.length) {
    blocks.push(["Web research warnings:", ...evidence.errors.map((e) => `- ${e}`)].join("\n"));
  }

  return blocks.join("\n\n---\n\n");
}

export function buildResearchAugmentedIntakeText(conversationText: string, evidence: IntakeWebEvidence): string {
  const webEvidence = formatIntakeWebEvidence(evidence);
  if (!webEvidence) return conversationText;
  return [
    "Conversation context:",
    conversationText,
    "",
    "Research evidence:",
    webEvidence,
    "",
    "Instructions: extract valuation-engine figures only when they are visible in the conversation or research evidence. Treat web/link figures as inferred. For Yahoo-style market data, regularMarketPrice maps to stock price, trailing EPS maps to EPS, and returnOnEquity must be converted to the unit requested by the schema. Omit fields that are not supported by the evidence.",
  ].join("\n");
}
