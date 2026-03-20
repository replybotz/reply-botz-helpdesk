import { describe, it, expect } from '@jest/globals';
import { createConversationSchema, sendMessageSchema } from '@/lib/validations/conversations';

describe('createConversationSchema', () => {
  it('should validate with defaults', () => {
    const result = createConversationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe('LIVE_CHAT');
    }
  });

  it('should accept valid channel', () => {
    const result = createConversationSchema.safeParse({ channel: 'EMAIL' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid channel', () => {
    const result = createConversationSchema.safeParse({ channel: 'SMS' });
    expect(result.success).toBe(false);
  });

  it('should accept customerId', () => {
    const result = createConversationSchema.safeParse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('sendMessageSchema', () => {
  it('should validate message with content', () => {
    const result = sendMessageSchema.safeParse({ content: 'Hello!' });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = sendMessageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('should accept optional role', () => {
    const result = sendMessageSchema.safeParse({ content: 'Hello', role: 'AGENT' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const result = sendMessageSchema.safeParse({ content: 'Hello', role: 'INVALID' });
    expect(result.success).toBe(false);
  });
});
