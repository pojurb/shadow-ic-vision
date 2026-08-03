import { NextResponse } from 'next/server';
import { addMessage, getConversation, getMessages, getThesisForConversation, toMessageDTO, updateConversationTitle } from '@/db/queries';
import { getLLMProvider } from '@/lib/ai/factory';
import type { ProjectMessage, ProviderCallContext } from '@/lib/ai/provider';
import { chatRequestSchema, chatResponsePayloadSchema, type ChatResponsePayload } from '@/lib/domain/contracts';

/**
 * Found missing during live testing (2026-07-26): this route sent raw
 * conversation history to the model with no system message at all, for
 * both the free-text `chat()` call and the `structuredExtract()` call
 * asking for a `ChatResponsePayload`. Without any framing, a live model
 * has no way to know this app expects a structured thesis/exploration
 * draft rather than a normal conversational reply — it behaved exactly
 * like a generic financial-analysis chatbot, because that's all the
 * context it was given. `npm run test:e2e` never caught this because it
 * always runs with `LLM_PROVIDER_TYPE=mock`; the M001 Kimi provider eval's
 * "93.3% assumption extraction completeness" evidence was measured against
 * a different, simpler evaluator-only schema
 * (`scripts/eval-m001-provider.ts`'s `buildIntakePrompt`), not this route's
 * actual `chatResponsePayloadSchema`/`thesisDraftSchema` — so nothing had
 * actually exercised this exact path with a real model before now.
 *
 * Found during live testing (2026-07-30): the fix above introduced a
 * SECOND bug. `chat()` (free text, becomes `message.content`) and
 * `structuredExtract()` (JSON, becomes `structuredPayload`) are separate
 * model completions, but both reused this one prompt — which spelled out
 * the exact JSON shape and said "in addition to giving the user a normal
 * conversational reply." Nothing told the model the JSON belonged only to
 * the constrained `structuredExtract` call, so the free-text `chat()`
 * reply routinely blended prose with a literal ` ```json {...}``` ` fence,
 * which `ChatUI.tsx` then rendered raw (see also the `chat()` fix in
 * `lib/ai/adapters/ollama.ts`). Split into two prompts so the model can't
 * leak a schema it's never shown in the free-text call, rather than asking
 * one completion to hold "here is the shape" and "never produce it" at
 * once.
 */
export const CHAT_SYSTEM_PROMPT = `You are JP Invest's research-intake assistant. Users state an investment thesis or describe a sector they're exploring.

Reply with a short, clear, conversational answer only — plain prose. Never include JSON, a code fence (\`\`\`), or any structured data block in your reply; a separate process handles turning the user's message into a structured record, so you don't need to produce or describe that structure yourself.

Never recommend buying, selling, holding, reducing, or exiting a position. You may discuss risks, uncertainties, and what to monitor, but the investment decision always belongs to the user.`;

export const STRUCTURED_SYSTEM_PROMPT = `You are JP Invest's research-intake assistant. Draft the user's most recent message into a structured record the app can act on.

When producing the structured JSON output, use this shape:
{
  "type": "thesis_draft" | "exploration_draft" | "none",
  "thesisDraft"?: {
    "ticker": string (stock ticker, e.g. "TLKM"),
    "companyName": string (full company name),
    "market": "US" | "ID",
    "coreBelief": string (the user's central, falsifiable belief, in their own words),
    "assumptions": [{ "statement": string, "status": "untested", "measurement": MeasurementContract }] (1-12 specific, checkable claims the core belief depends on; status is always "untested" for a new draft — nothing has been researched yet),
    "requiresChallenge": false
  },
  "explorationDraft"?: {
    "sectorName": string,
    "candidates": [{ "ticker": string, "companyName": string, "market": "US" | "ID", "rationale": string }] (exactly 3-5 unranked candidates)
  }
}

Each assumption carries a "measurement" block normalizing it to a checkable quantity:
{
  "resolution": "resolved" | "ambiguous" | "not_measurable",
  "metric": string (the measurable quantity, e.g. "automotive gross margin"),
  "definitionVariant": string (which of several defensible definitions — consolidated versus segment, GAAP versus adjusted, including versus excluding one-time items),
  "operator": "gte" | "gt" | "lte" | "lt" | "eq" | "increases" | "decreases" | "none",
  "threshold": number | null,
  "unit": "percent" | "ratio" | "usd" | "idr" | "count" | "unspecified",
  "timeBasis": "instant" | "duration_quarter" | "duration_ytd" | "duration_annual" | "duration_ttm" | "unspecified" (a point-in-time balance versus a flow measured over a period — a deferred-revenue balance is "instant", revenue recognized in a quarter is "duration_quarter"),
  "sourceTags": string[] (candidate us-gaap XBRL element names, most specific first, bare names with no prefix — e.g. ["GrossProfit"]. Empty for non-US issuers, which publish no XBRL company facts),
  "clarifyingQuestion": string | null,
  "ambiguityReason": "none" | "metric_undefined" | "definition_variant_ambiguous" | "threshold_missing" | "time_basis_ambiguous" | "unit_ambiguous"
}

Use "resolved" only when metric, definition variant, operator, threshold, unit, and time basis are all settled from what the user actually said; then "clarifyingQuestion" must be null and "ambiguityReason" must be "none". When one of them cannot be settled, use "ambiguous", name the "ambiguityReason", and write exactly one "clarifyingQuestion" — the draft still appears for the user to review, and the app asks your question before research starts. When an assumption is genuinely qualitative rather than numeric, use "not_measurable" with "operator": "none" rather than inventing a threshold the user never stated. If an earlier turn asked a clarifying question and the user has now answered it, re-draft that assumption as "resolved".

Use "thesis_draft" whenever the user states a specific, testable belief about a specific company or ticker — even one sentence (e.g. "I think TLKM's data center business will grow 20%") is enough. Draft it immediately: always produce the draft, never withhold one. Ambiguity belongs inside the measurement block, not in a refusal to draft — the app's own confirmation step is where the user reviews, edits, or rejects the draft, so an imperfect first draft is far better than none.

Use "exploration_draft" when the user describes a sector or theme without naming a specific company: offer 3-5 unranked candidates with a plain inclusion rationale each. Never rank them or imply one is the best pick — that would cross into a recommendation, which this app never gives.

Use "none" only when there is genuinely nothing new to draft (a greeting, an off-topic question, or a follow-up about a draft already established earlier in this conversation).

Never recommend buying, selling, holding, reducing, or exiting a position. You may discuss risks, uncertainties, and what to monitor, but the investment decision always belongs to the user.`;

/**
 * Found during live testing (2026-07-30): the sidebar showed the literal
 * string "New Thesis" for every conversation, forever — `conversations.title`
 * is set once at creation (`app/api/conversations/route.ts`) and was never
 * updated again anywhere in the codebase. This snippet replaces that
 * placeholder with the user's own words the moment they say something, so
 * the sidebar is never stuck on the generic string once a real conversation
 * exists. `confirmDraft` (`lib/research/service.ts`) later upgrades it again
 * to the canonical ticker/company title once a thesis is confirmed.
 */
export function titleFromMessage(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export async function POST(request: Request) {
  try {
    const parsedRequest = chatRequestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Enter a message between 1 and 4,000 characters.' }, { status: 400 });
    }
    const { conversationId, content } = parsedRequest.data;
    // Found missing during live testing (2026-07-30): this used to check
    // `getConversation`'s truthiness and discard the row. The row's `title`
    // is needed below to detect the first-message case, so it's captured
    // instead of thrown away.
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Save user message
    await addMessage(conversationId, 'user', content);

    // First user message in this conversation: replace the 'New Thesis'
    // placeholder — see `titleFromMessage`'s doc comment. This sentinel check
    // depends on `app/api/conversations/route.ts` continuing to seed new
    // conversations with the literal string 'New Thesis'.
    let updatedTitle: string | undefined;
    if (conversation.title === 'New Thesis') {
      updatedTitle = titleFromMessage(content);
      await updateConversationTitle(conversationId, updatedTitle);
    }

    // Fetch conversation history to send to LLM
    const history = await getMessages(conversationId);
    const historyMessages: ProjectMessage[] = history.map((msg) => ({
      role: msg.role as ProjectMessage['role'],
      content: msg.content,
    }));

    // Two separate model completions, each with the prompt appropriate to
    // its own job — see the doc comment above the prompts for why a shared
    // prompt caused the free-text reply to leak JSON.
    const chatMessages: ProjectMessage[] = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...historyMessages];
    const structuredMessages: ProjectMessage[] = [{ role: 'system', content: STRUCTURED_SYSTEM_PROMPT }, ...historyMessages];

    const providerContext: ProviderCallContext = {
      route: 'app.api.chat',
      dataClass: 'poc_workflow_confidential',
      runtime: {
        requestUrl: request.url,
        host: request.headers.get('host'),
      },
    };

    const llmProvider = getLLMProvider({ modelId: parsedRequest.data.modelId });
    const response = await llmProvider.chat(chatMessages, providerContext);
    const existingThesis = await getThesisForConversation(conversationId);
    const extraction = existingThesis
      ? null
      : await llmProvider.structuredExtract(structuredMessages, chatResponsePayloadSchema, 'chat-payload-v1', providerContext);
    const structuredPayload: ChatResponsePayload | undefined = extraction?.success ? extraction.data ?? undefined : undefined;

    // Save assistant message
    const savedMsgId = await addMessage(
      conversationId, 
      'assistant', 
      response.text, 
      {
        providerMetadata: response.metadata,
        structuredPayload,
        validationOutcome: extraction
          ? extraction.success ? 'valid' : 'invalid'
          : 'not_applicable',
      },
    );

    const saved = (await getMessages(conversationId)).find((message) => message.id === savedMsgId);
    if (!saved) throw new Error('Assistant message was not persisted.');

    // Return the new assistant message to the client, plus the updated
    // title (only present when this was the first user message) so the
    // client can patch the sidebar without a second round-trip.
    return NextResponse.json({
      message: toMessageDTO(saved),
      ...(updatedTitle ? { conversationTitle: updatedTitle } : {}),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
