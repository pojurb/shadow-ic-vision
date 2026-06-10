import { describe, expect, it } from "vitest";
import {
  buildIntakeConversationText,
  buildIntakeSearchQuery,
  buildResearchAugmentedIntakeText,
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
    expect(buildIntakeSearchQuery(text)).toBe(
      "BBCA.JK latest share price EPS ROE financial statements annual report",
    );
  });

  it("adds web evidence with instruction to treat web figures as inferred", () => {
    const text = buildResearchAugmentedIntakeText("User: analyze ticker BBCA", {
      fetchedLinks: [],
      searchQuery: "BBCA.JK latest share price EPS ROE financial statements annual report",
      searchResults: [
        {
          title: "BBCA financials",
          url: "https://example.com/bbca",
          content: "Share price 9000. EPS 600. ROE 20%.",
        },
      ],
      errors: [],
    });

    expect(text).toContain("Research evidence:");
    expect(text).toContain("Share price 9000");
    expect(text).toContain("Treat web/link figures as inferred");
  });

  it("builds a focused IDX query from lowercase saham shorthand", () => {
    expect(buildIntakeSearchQuery("User: coba analisa saham bbca")).toBe(
      "BBCA.JK latest share price EPS ROE financial statements annual report",
    );
  });

  it("uses backend search when web research is enabled", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          results: [{ title: "BBCA", url: "https://example.com", content: "EPS 600 ROE 20%" }],
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

    expect(calls).toEqual(["/api/web-search"]);
    expect(evidence.searchResults[0].content).toContain("EPS 600");
  });
});
