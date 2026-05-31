/**
 * Server-side URL fetcher. Clients can't cross-origin fetch arbitrary URLs
 * (CORS), but this route handler runs on the server where there's no such
 * restriction. Returns cleaned plain text (scripts/styles stripped, HTML
 * tags removed, content capped at 12 000 chars to keep context manageable).
 *
 * Used by non-Anthropic providers as a web_fetch tool fallback (P6.3).
 */
import { NextResponse } from "next/server";

const MAX_CHARS = 12_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof url !== "string" || !url.startsWith("https://")) {
    return NextResponse.json({ error: "url must be an https:// string." }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JP-Invest-Workspace/1.0; +https://github.com/pojurb/demo1)",
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    const text = contentType.includes("html") ? stripHtml(raw) : raw;
    const content = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n[…truncated]" : text;

    return NextResponse.json({ url, content, status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Fetch failed: ${msg}` }, { status: 502 });
  }
}
