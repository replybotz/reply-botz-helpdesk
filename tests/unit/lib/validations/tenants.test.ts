import { describe, it, expect } from '@jest/globals';
import { createTenantSchema, updateTenantSchema } from '@/lib/validations/tenants';

describe('createTenantSchema', () => {
  it('should validate a valid tenant', () => {
    const result = createTenantSchema.safeParse({
      name: 'Acme Corp',
      slug: 'acme-corp',
    });
    expect(result.success).toBe(true);
  });

  it('should default plan to FREE', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plan).toBe('FREE');
    }
  });

  it('should reject slug with uppercase', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'MySlug',
    });
    expect(result.success).toBe(false);
  });

  it('should reject slug with spaces', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'my slug',
    });
    expect(result.success).toBe(false);
  });

  it('should reject slug shorter than 2 chars', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'a',
    });
    expect(result.success).toBe(false);
  });

  it('should accept slug with numbers and hyphens', () => {
    const result = createTenantSchema.safeParse({
      name: 'Test',
      slug: 'my-company-123',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateTenantSchema', () => {
  it('should validate partial updates', () => {
    const result = updateTenantSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('should accept plan update', () => {
    const result = updateTenantSchema.safeParse({ plan: 'ENTERPRISE' });
    expect(result.success).toBe(true);
  });

  it('should accept nullable domain', () => {
    const result = updateTenantSchema.safeParse({ domain: null });
    expect(result.success).toBe(true);
  });

  it('should reject invalid plan', () => {
    const result = updateTenantSchema.safeParse({ plan: 'INVALID' });
    expect(result.success).toBe(false);
  });
});
