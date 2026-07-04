import { describe, expect, it } from 'vitest';
import {
  chatRequestSchema,
  confirmRequestSchema,
  researchRetryRequestSchema,
} from '@/lib/domain/contracts';

describe('API boundary validation', () => {
  const conversationId = '77d80b7f-4d57-46ab-9341-f972b6ecf5f3';
  const messageId = '79f651e7-77ab-4745-84f9-d20b7efef6e3';

  it('rejects empty and oversized chat input', () => {
    expect(chatRequestSchema.safeParse({ conversationId, content: '  ' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ conversationId, content: 'x'.repeat(4_001) }).success).toBe(false);
  });

  it('accepts a valid confirmation and rejects malformed ids', () => {
    expect(confirmRequestSchema.safeParse({ conversationId, messageId }).success).toBe(true);
    expect(confirmRequestSchema.safeParse({ conversationId: 'missing', messageId }).success).toBe(false);
  });

  it('rejects malformed retry ids', () => {
    expect(researchRetryRequestSchema.safeParse({ jobId: 'unknown' }).success).toBe(false);
  });
});
