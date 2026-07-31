import { describe, expect, it } from 'vitest';
import { CHAT_SYSTEM_PROMPT, STRUCTURED_SYSTEM_PROMPT, titleFromMessage } from '@/app/api/chat/route';

/**
 * Found during live testing (2026-07-30): a single shared system prompt
 * caused the free-text `chat()` reply to leak a raw JSON fence into the
 * visible chat message (see `route.ts`'s doc comment and
 * `lib/ai/adapters/ollama.ts`'s `stripLeakedJsonFence`). These assertions
 * are deterministic and model-independent — they check OUR prompt
 * construction, not live model behavior — so they can't catch a model
 * choosing to leak text anyway, only that we never hand it the shape to
 * leak in the first place.
 */
describe('chat route system prompts', () => {
  const jsonShapeKeywords = /thesis_draft|exploration_draft|"ticker"|"coreBelief"|"sectorName"/;
  const neverRecommend = 'Never recommend buying, selling, holding, reducing, or exiting a position.';

  it('CHAT_SYSTEM_PROMPT contains no JSON-shape keywords', () => {
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(jsonShapeKeywords);
  });

  it('CHAT_SYSTEM_PROMPT explicitly forbids JSON/code fences in the reply', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never include json|code fence/i);
  });

  it('STRUCTURED_SYSTEM_PROMPT still carries the JSON shape for the constrained call', () => {
    expect(STRUCTURED_SYSTEM_PROMPT).toMatch(/thesis_draft/);
    expect(STRUCTURED_SYSTEM_PROMPT).toMatch(/exploration_draft/);
  });

  it('both prompts share the identical never-recommend persona sentence', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain(neverRecommend);
    expect(STRUCTURED_SYSTEM_PROMPT).toContain(neverRecommend);
  });
});

// Found during live testing (2026-07-30): the sidebar showed "New Thesis"
// for every conversation forever. This is the first-message half of the
// fix — see `route.ts`'s doc comment.
describe('titleFromMessage', () => {
  it('returns a short message unchanged, with no ellipsis', () => {
    const short = 'I believe PLTR gross margin will remain above 80%.';
    expect(short.length).toBeLessThan(60);
    expect(titleFromMessage(short)).toBe(short);
  });

  it('returns a message of exactly 60 chars unchanged', () => {
    const exact = 'x'.repeat(60);
    expect(titleFromMessage(exact)).toBe(exact);
  });

  it('truncates a 61+ char message to 60 chars plus an ellipsis', () => {
    const long = 'x'.repeat(75);
    const result = titleFromMessage(long);
    expect(result).toBe(`${'x'.repeat(60)}…`);
    expect(result.length).toBe(61);
  });

  it('trims leading/trailing whitespace before measuring length', () => {
    expect(titleFromMessage('   hello there   ')).toBe('hello there');
  });
});
