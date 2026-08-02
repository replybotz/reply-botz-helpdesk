const mockPrisma = {
  aiSuggestion: { update: jest.fn() },
  ticket: { findFirst: jest.fn(), update: jest.fn() },
};
const mockAudit = jest.fn();
const mockDraftReply = jest.fn();
const mockTriageTicket = jest.fn();

jest.mock('@/lib/db', () => ({ prisma: mockPrisma }));
jest.mock('@/lib/audit', () => ({ audit: mockAudit }));
jest.mock('@/lib/ai/reply', () => ({ draftReply: mockDraftReply }));
jest.mock('@/lib/ai/triage', () => ({ triageTicket: mockTriageTicket }));

import { handleDraftReply, handleTriageTicket, recordJobFailure } from '@/lib/queue/handlers';

const TENANT = 'tenant-1';
const SUGGESTION = 'suggestion-1';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiSuggestion.update.mockResolvedValue({});
  mockPrisma.ticket.update.mockResolvedValue({});
});

describe('handleDraftReply', () => {
  it('stores the draft and its citations as READY', async () => {
    mockDraftReply.mockResolvedValue({
      content: 'Here is how to reset your password.',
      citations: [{ id: 'kb-1', title: 'Password reset', slug: 'password-reset' }],
      model: 'claude-opus-5',
    });

    await handleDraftReply({
      type: 'draft-reply',
      tenantId: TENANT,
      conversationId: 'conv-1',
      suggestionId: SUGGESTION,
    });

    expect(mockPrisma.aiSuggestion.update).toHaveBeenCalledWith({
      where: { id: SUGGESTION },
      data: expect.objectContaining({
        status: 'READY',
        content: 'Here is how to reset your password.',
        model: 'claude-opus-5',
        error: null,
      }),
    });
  });

  it('propagates provider errors so BullMQ can retry', async () => {
    mockDraftReply.mockRejectedValue(new Error('provider timeout'));

    await expect(
      handleDraftReply({
        type: 'draft-reply',
        tenantId: TENANT,
        conversationId: 'conv-1',
        suggestionId: SUGGESTION,
      }),
    ).rejects.toThrow('provider timeout');

    // The suggestion stays PENDING — a retry may still succeed.
    expect(mockPrisma.aiSuggestion.update).not.toHaveBeenCalled();
  });
});

describe('handleTriageTicket', () => {
  const ticket = { id: 'ticket-1', subject: 'Double charged', description: 'Billed twice.' };

  const triage = {
    priority: 'HIGH' as const,
    category: 'billing',
    summary: 'Customer double-charged.',
    tags: ['billing'],
    sentiment: 'FRUSTRATED' as const,
    needsHumanReview: false,
    reasoning: 'Money already taken.',
  };

  function job() {
    return {
      type: 'triage-ticket' as const,
      tenantId: TENANT,
      ticketId: ticket.id,
      suggestionId: SUGGESTION,
    };
  }

  it('applies the priority and audits when the model is confident', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue(ticket);
    mockTriageTicket.mockResolvedValue({ triage, model: 'gpt-5' });

    await handleTriageTicket(job());

    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: ticket.id },
      data: { priority: 'HIGH' },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ticket.ai_triaged', entityId: ticket.id }),
    );
  });

  it('leaves the ticket alone when the model flags it for human review', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue(ticket);
    mockTriageTicket.mockResolvedValue({
      triage: { ...triage, needsHumanReview: true },
      model: 'gpt-5',
    });

    await handleTriageTicket(job());

    // The suggestion is still recorded so an agent can see the assessment...
    expect(mockPrisma.aiSuggestion.update).toHaveBeenCalled();
    // ...but priority is not changed automatically.
    expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('fails when the ticket is missing or belongs to another tenant', async () => {
    mockPrisma.ticket.findFirst.mockResolvedValue(null);

    await expect(handleTriageTicket(job())).rejects.toThrow('not found');
    expect(mockTriageTicket).not.toHaveBeenCalled();
  });
});

describe('recordJobFailure', () => {
  it('marks the suggestion FAILED with a truncated error', async () => {
    await recordJobFailure(SUGGESTION, 'x'.repeat(2000));

    const [[args]] = mockPrisma.aiSuggestion.update.mock.calls;
    expect(args.data.status).toBe('FAILED');
    expect(args.data.error).toHaveLength(1000);
  });

  it('swallows a write failure rather than crashing the worker', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPrisma.aiSuggestion.update.mockRejectedValue(new Error('db down'));

    await expect(recordJobFailure(SUGGESTION, 'boom')).resolves.toBeUndefined();
  });
});
