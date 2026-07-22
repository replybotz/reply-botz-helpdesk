import { describe, it, expect } from '@jest/globals';
import { createTicketSchema, updateTicketSchema } from '@/lib/validations/tickets';

describe('createTicketSchema', () => {
  it('should validate a valid ticket', () => {
    const result = createTicketSchema.safeParse({
      subject: 'Cannot login',
      description: 'I get an error when trying to login',
      priority: 'HIGH',
    });
    expect(result.success).toBe(true);
  });

  it('should default priority to MEDIUM', () => {
    const result = createTicketSchema.safeParse({
      subject: 'Issue',
      description: 'Description',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('MEDIUM');
    }
  });

  it('should reject empty subject', () => {
    const result = createTicketSchema.safeParse({
      subject: '',
      description: 'Description',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty description', () => {
    const result = createTicketSchema.safeParse({
      subject: 'Subject',
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid priority', () => {
    const result = createTicketSchema.safeParse({
      subject: 'Subject',
      description: 'Description',
      priority: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTicketSchema', () => {
  it('should validate partial updates', () => {
    const result = updateTicketSchema.safeParse({ status: 'RESOLVED' });
    expect(result.success).toBe(true);
  });

  it('should accept nullable assignedTo', () => {
    const result = updateTicketSchema.safeParse({ assignedTo: null });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = updateTicketSchema.safeParse({ status: 'INVALID' });
    expect(result.success).toBe(false);
  });
});
