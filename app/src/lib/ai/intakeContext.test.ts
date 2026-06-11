import { describe, expect, it } from "vitest";
import {
  buildIntakeConversationText,
  buildIntakeSearchQuery,
  buildIntakeSearchQueries,
  buildResearchAugmentedIntakeText,
  extractIntakeAssetHint,
  gatherIntakeWebEvidence,
} from "./intakeContext";
import type { ChatMessage } from "@/lib/domain/types";

function user(content: string, i: number): ChatMessage {
  return { id: `${i}`, role: "user", content, createdAt: i };
}

describe("intakeContext", () => {
  it("keeps prior user turns so follow-up requests retain asset context", () => {
    const text = buildIntakeConversationText([
      user("coba analisa saham BCA dengan ticker BBCA", 1),
      user("can you help me find that information?", 2),
      user("find it through internet", 3),
    ]);

    expect(text).toContain("ticker BBCA");
    expect(text).toContain("find it through internet");
    expect(buildIntakeSearchQuery(text)).toBe("BBCA.JK stock quote EPS ROE market cap");
  });

  it("adds web evidence with instruction to treat web figures as inferred", () => {
    const text = buildResearchAugmentedIntakeText("User: analyze ticker BBCA", {
      fetchedLinks: [],
      searchQuery: "BBCA.JK stock quote EPS ROE market cap",
      searchQueries: ["BBCA.JK stock quote EPS ROE market cap"],
      marketData: [],
      searchResults: [
        {
          title: "BBCA financials",
          url: "https://example.com/bbca",
          content: "Share price 9000. EPS 600. ROE 20%.",
        },
      ],
      searchedPages: [],
      errors: [],
    });

    expect(text).toContain("Research evidence:");
    expect(text).toContain("Share price 9000");
    expect(text).toContain("Treat web/link figures as inferred");
  });

  it("builds a focused IDX query from lowercase saham shorthand", () => {
    expect(buildIntakeSearchQuery("User: coba analisa saham bbca")).toBe("BBCA.JK stock quote EPS ROE market cap");
  });

  it("builds a focused IDX query from lowercase ticker and trailing stock keywords", () => {
    expect(extractIntakeAssetHint("User: MBMA Stocks")).toEqual({ ticker: "MBMA" });
    expect(buildIntakeSearchQuery("User: mbma stocks")).toBe("MBMA.JK stock quote EPS ROE market cap");
    expect(buildIntakeSearchQuery("User: coba analisa mbma")).toBe("MBMA.JK stock quote EPS ROE market cap");
    expect(buildIntakeSearchQuery("User: mbma")).toBe("MBMA.JK stock quote EPS ROE market cap");
    expect(buildIntakeSearchQueries("User: MBMA Stocks")).toEqual([
      "MBMA.JK stock quote EPS ROE market cap",
      "MBMA saham IDX laporan keuangan EPS ROE",
      "MBMA investor relations annual report financial statements",
    ]);
  });

  it("does not let stock keywords consume the next user turn as a ticker", () => {
    const text = buildIntakeConversationText([
      user("MBMA Stocks", 1),
      user("find it through internet, but only use real visible data", 2),
    ]);

    expect(extractIntakeAssetHint(text)).toEqual({ ticker: "MBMA" });
    expect(buildIntakeSearchQuery(text)).toBe("MBMA.JK stock quote EPS ROE market cap");
  });

  it("uses backend search when web research is enabled", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      const body = JSON.parse(String(init?.body ?? "{}")) as { url?: string; query?: string };
      if (String(url) === "/api/web-fetch") {
        if (body.url?.includes("/v8/finance/chart/")) {
          return new Response(
            JSON.stringify({
              content: JSON.stringify({
                chart: {
                  result: [
                    {
                      meta: {
                        symbol: "BBCA.JK",
                        exchangeName: "Jakarta",
                        currency: "IDR",
                        regularMarketPrice: 9000,
                      },
                    },
                  ],
                },
              }),
              url: body.url,
              status: 200,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (body.url === "https://example.com/bbca") {
          return new Response(
            JSON.stringify({ content: "Fetched page says EPS 600 and ROE 20%.", url: body.url, status: 200 }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not available" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          results: [
            { title: "BBCA", url: "https://example.com/bbca", content: "EPS 600 ROE 20%" },
            { title: "JPMorgan", url: "https://example.com/jpm", content: "Annual report" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const evidence = await gatherIntakeWebEvidence({
      conversationText: "User: analyze ticker BBCA",
      sources: [],
      allowWebSearch: true,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(calls).toContain("/api/web-search");
    expect(calls.filter((call) => call === "/api/web-fetch").length).toBeGreaterThanOrEqual(1);
    expect(evidence.marketData[0].content).toContain("Regular market price: 9000");
    expect(evidence.searchResults[0].content).toContain("EPS 600");
    expect(evidence.searchedPages[0].content).toContain("Fetched page says EPS 600");
    expect(evidence.searchResults.some((r) => r.title === "JPMorgan")).toBe(false);
  });
});
