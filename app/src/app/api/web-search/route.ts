/**
 * Server-side web search via Tavily. The Tavily API key is an operator secret
 * in `.env.local` (TAVILY_API_KEY) — it never reaches the browser. Returns up
 * to 5 results with title, url, and a content snippet per result.
 *
 * Used by non-Anthropic providers as a web_search tool fallback (P6.3).
 */
import { NextResponse } from "next/server";

const TAVILY_URL = "https://api.tavily.com/search";

export async function POST(req: Request) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TAVILY_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let query: string;
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query must be a non-empty string." }, { status: 400 });
  }

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Tavily error ${res.status}: ${body}` }, { status: 502 });
    }

    const data = await res.json();

    type TavilyResult = { title?: string; url?: string; content?: string };
    const results: { title: string; url: string; content: string }[] = (
      (data.results as TavilyResult[]) ?? []
    ).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
    }));

    return NextResponse.json({ query, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Search failed: ${msg}` }, { status: 502 });
  }
}
