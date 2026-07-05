import { describe, expect, it } from 'vitest';
import { hasValidCronAuthorization } from '@/app/api/internal/research/cron/route';

describe('research cron authentication', () => {
  it('accepts only the configured bearer secret', () => {
    expect(hasValidCronAuthorization('Bearer daily-secret', 'daily-secret')).toBe(true);
    expect(hasValidCronAuthorization('Bearer wrong', 'daily-secret')).toBe(false);
    expect(hasValidCronAuthorization(null, 'daily-secret')).toBe(false);
    expect(hasValidCronAuthorization('Bearer daily-secret', '')).toBe(false);
  });
});
