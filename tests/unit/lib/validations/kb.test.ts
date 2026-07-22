import { describe, it, expect } from '@jest/globals';
import { createArticleSchema, updateArticleSchema } from '@/lib/validations/kb';

describe('createArticleSchema', () => {
  it('should validate a valid article', () => {
    const result = createArticleSchema.safeParse({
      title: 'Getting Started',
      content: 'Welcome to our platform...',
      tags: ['getting-started', 'faq'],
      status: 'DRAFT',
    });
    expect(result.success).toBe(true);
  });

  it('should default to DRAFT status', () => {
    const result = createArticleSchema.safeParse({
      title: 'Title',
      content: 'Content',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('DRAFT');
    }
  });

  it('should default tags to empty array', () => {
    const result = createArticleSchema.safeParse({
      title: 'Title',
      content: 'Content',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it('should reject empty title', () => {
    const result = createArticleSchema.safeParse({
      title: '',
      content: 'Content',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = createArticleSchema.safeParse({
      title: 'Title',
      content: 'Content',
      status: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateArticleSchema', () => {
  it('should validate partial updates', () => {
    const result = updateArticleSchema.safeParse({ status: 'PUBLISHED' });
    expect(result.success).toBe(true);
  });

  it('should accept tags update', () => {
    const result = updateArticleSchema.safeParse({ tags: ['new-tag'] });
    expect(result.success).toBe(true);
  });
});
