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
  searchResults: WebSearchResult[];
  errors: string[];
}

const MAX_TRANSCRIPT_CHARS = 4_000;
const MAX_LINK_CHARS = 5_000;
const MAX_SEARCH_RESULT_CHARS = 900;

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

export function buildIntakeSearchQuery(conversationText: string): string {
  const ticker = conversationText.match(/\b(?:ticker|kode|symbol)\s*[:=]?\s*([A-Z]{2,5})(?:\.(?:JK|IDX))?\b/i)?.[1];
  if (ticker) {
    return `${ticker.toUpperCase()}.JK latest share price EPS ROE financial statements annual report`;
  }

  const stockHint = conversationText.match(/\b(?:saham|emiten|stock)\s+([a-z]{4})(?:\.(?:jk|idx))?\b/i)?.[1];
  if (stockHint) {
    return `${stockHint.toUpperCase()}.JK latest share price EPS ROE financial statements annual report`;
  }

  const stockCode = conversationText.match(/\b([A-Z]{4})(?:\.(?:JK|IDX))?\b/)?.[1];
  if (stockCode) {
    return `${stockCode.toUpperCase()}.JK latest share price EPS ROE financial statements annual report`;
  }

  return `${compact(conversationText).slice(0, 240)} latest valuation financial metrics`;
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
  const evidence: IntakeWebEvidence = {
    fetchedLinks: [],
    searchQuery: allowWebSearch ? buildIntakeSearchQuery(conversationText) : "",
    searchResults: [],
    errors: [],
  };

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

  if (allowWebSearch && evidence.searchQuery) {
    try {
      const data = (await postJson(fetchImpl, "/api/web-search", { query: evidence.searchQuery })) as {
        results?: WebSearchResult[];
        error?: string;
      };
      evidence.searchResults = (data.results ?? [])
        .filter((r) => r.title || r.url || r.content)
        .slice(0, 5)
        .map((r) => ({
          title: r.title ?? "",
          url: r.url ?? "",
          content: truncate(r.content ?? "", MAX_SEARCH_RESULT_CHARS),
        }));
      if (!evidence.searchResults.length && data.error) evidence.errors.push(`Search: ${data.error}`);
    } catch (err) {
      evidence.errors.push(`Search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return evidence;
}

export function formatIntakeWebEvidence(evidence: IntakeWebEvidence): string {
  const blocks: string[] = [];

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

  if (evidence.searchResults.length) {
    blocks.push(
      [
        `Web search results for: ${evidence.searchQuery}`,
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
    "Instructions: extract valuation-engine figures only when they are visible in the conversation or research evidence. Treat web/link figures as inferred. Omit fields that are not supported by the evidence.",
  ].join("\n");
}
