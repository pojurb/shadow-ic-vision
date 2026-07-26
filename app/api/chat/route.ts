import { NextResponse } from 'next/server';
import { addMessage, getConversation, getMessages, getThesisForConversation, toMessageDTO } from '@/db/queries';
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
 */
const SYSTEM_PROMPT = `You are JP Invest's research-intake assistant. Users state an investment thesis or describe a sector they're exploring; your job is to draft that into a structured record the app can act on, in addition to giving the user a normal conversational reply.

When producing the structured JSON output, use this shape:
{
  "type": "thesis_draft" | "exploration_draft" | "none",
  "thesisDraft"?: {
    "ticker": string (stock ticker, e.g. "TLKM"),
    "companyName": string (full company name),
    "market": "US" | "ID",
    "coreBelief": string (the user's central, falsifiable belief, in their own words),
    "assumptions": [{ "statement": string, "status": "untested" }] (1-12 specific, checkable claims the core belief depends on; status is always "untested" for a new draft — nothing has been researched yet),
    "requiresChallenge": false
  },
  "explorationDraft"?: {
    "sectorName": string,
    "candidates": [{ "ticker": string, "companyName": string, "market": "US" | "ID", "rationale": string }] (exactly 3-5 unranked candidates)
  }
}

Use "thesis_draft" whenever the user states a specific, testable belief about a specific company or ticker — even one sentence (e.g. "I think TLKM's data center business will grow 20%") is enough. Draft it immediately; do not withhold a draft to ask a clarifying question instead — the app's own confirmation step is where the user reviews, edits, or rejects the draft, so an imperfect first draft is far better than none.

Use "exploration_draft" when the user describes a sector or theme without naming a specific company: offer 3-5 unranked candidates with a plain inclusion rationale each. Never rank them or imply one is the best pick — that would cross into a recommendation, which this app never gives.

Use "none" only when there is genuinely nothing new to draft (a greeting, an off-topic question, or a follow-up about a draft already established earlier in this conversation).

In both the structured output and your conversational reply: never recommend buying, selling, holding, reducing, or exiting a position. You may discuss risks, uncertainties, and what to monitor, but the investment decision always belongs to the user.`;

export async function POST(request: Request) {
  try {
    const parsedRequest = chatRequestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Enter a message between 1 and 4,000 characters.' }, { status: 400 });
    }
    const { conversationId, content } = parsedRequest.data;
    if (!await getConversation(conversationId)) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Save user message
    await addMessage(conversationId, 'user', content);

    // Fetch conversation history to send to LLM
    const history = await getMessages(conversationId);

    // Map db messages to ProjectMessage format
    const projectMessages: ProjectMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role as ProjectMessage['role'],
        content: msg.content,
      })),
    ];

    const providerContext: ProviderCallContext = {
      route: 'app.api.chat',
      dataClass: 'poc_workflow_confidential',
      runtime: {
        requestUrl: request.url,
        host: request.headers.get('host'),
      },
    };

    const llmProvider = getLLMProvider({ modelId: parsedRequest.data.modelId });
    const response = await llmProvider.chat(projectMessages, providerContext);
    const existingThesis = await getThesisForConversation(conversationId);
    const extraction = existingThesis
      ? null
      : await llmProvider.structuredExtract(projectMessages, chatResponsePayloadSchema, 'chat-payload-v1', providerContext);
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

    // Return the new assistant message to the client
    return NextResponse.json({
      message: toMessageDTO(saved),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
