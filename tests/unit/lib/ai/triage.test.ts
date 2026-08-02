import { triageSchema } from '@/lib/ai/triage';

describe('triageSchema', () => {
  const valid = {
    priority: 'HIGH',
    category: 'billing',
    summary: 'Customer was double-charged for the March invoice.',
    tags: ['billing', 'refund'],
    sentiment: 'FRUSTRATED',
    needsHumanReview: true,
    reasoning: 'Payment issue with money already taken.',
  };

  it('accepts a well-formed triage result', () => {
    expect(triageSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a priority outside the ticket enum', () => {
    // Providers without native schema enforcement can invent values; the
    // schema is what stops them reaching the database.
    expect(triageSchema.safeParse({ ...valid, priority: 'CRITICAL' }).success).toBe(false);
  });

  it('rejects a sentiment outside the enum', () => {
    expect(triageSchema.safeParse({ ...valid, sentiment: 'ANGRY' }).success).toBe(false);
  });

  it('requires needsHumanReview to be boolean, not a string', () => {
    expect(triageSchema.safeParse({ ...valid, needsHumanReview: 'yes' }).success).toBe(false);
  });

  it('rejects a result missing required fields', () => {
    expect(triageSchema.safeParse({ priority: 'LOW' }).success).toBe(false);
  });

  it('produces priorities the Prisma TicketPriority enum accepts', () => {
    const parsed = triageSchema.parse(valid);
    expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(parsed.priority);
  });
});
