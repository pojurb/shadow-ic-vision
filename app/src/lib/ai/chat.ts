/**
 * Streamed, grounded follow-up chat for a single analysis. Parses the Anthropic
 * SSE stream manually (no SDK) and emits text deltas via onDelta.
 */
import { ANTHROPIC_URL, anthropicHeaders, errorMessage } from "./client";
import { CHAT_SYSTEM, chatContextPreamble } from "./prompts";
import { buildFileBlocks } from "./content";
import type { Analysis, ChatMessage } from "@/lib/domain/types";

export async function streamChat(opts: {
  apiKey: string;
  model: string;
  analysis: Analysis;
  userText: string;
  onDelta: (text: string) => void;
}): Promise<string> {
  const { apiKey, model, analysis, userText, onDelta } = opts;

  const history = analysis.chat.map((m: ChatMessage) => ({ role: m.role, content: m.content }));

  const fileBlocks = await buildFileBlocks(analysis.sources);
  const preamble = chatContextPreamble(analysis);
  const preambleContent = fileBlocks.length
    ? [...fileBlocks, { type: "text", text: preamble }]
    : preamble;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      stream: true,
      system: CHAT_SYSTEM,
      messages: [
        { role: "user", content: preambleContent },
        { role: "assistant", content: "Understood — I have the locked figures and the prior bull/bear debate in mind. Ask away." },
        ...history,
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok || !res.body) throw new Error(await errorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          full += evt.delta.text;
          onDelta(evt.delta.text);
        }
      } catch {
        /* ignore keep-alive / partial lines */
      }
    }
  }

  return full;
}
