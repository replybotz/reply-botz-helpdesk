import { describe, it, expect } from '@jest/globals';
import { createUserSchema, updateUserSchema } from '@/lib/validations/users';

describe('createUserSchema', () => {
  it('should validate a valid user', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      displayName: 'Test User',
      role: 'AGENT',
    });
    expect(result.success).toBe(true);
  });

  it('should reject weak password', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'weak',
      displayName: 'Test',
      role: 'AGENT',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without uppercase', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'password1',
      displayName: 'Test',
      role: 'AGENT',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'Password',
      displayName: 'Test',
      role: 'AGENT',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      password: 'Password1',
      displayName: 'Test',
      role: 'AGENT',
    });
    expect(result.success).toBe(false);
  });

  it('should reject SUPER_ADMIN role', () => {
    const result = createUserSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      displayName: 'Test',
      role: 'SUPER_ADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid roles', () => {
    for (const role of ['TENANT_ADMIN', 'SUPERVISOR', 'AGENT', 'CUSTOMER']) {
      const result = createUserSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
        displayName: 'Test',
        role,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('updateUserSchema', () => {
  it('should validate partial updates', () => {
    const result = updateUserSchema.safeParse({ displayName: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('should accept status update', () => {
    const result = updateUserSchema.safeParse({ status: 'SUSPENDED' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = updateUserSchema.safeParse({ status: 'INVALID' });
    expect(result.success).toBe(false);
  });
});
