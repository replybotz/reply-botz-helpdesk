import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { draftReply } from '@/lib/ai/reply';
import { triageTicket } from '@/lib/ai/triage';
import { audit } from '@/lib/audit';
import type { AiJob } from './ai-queue';

export async function handleDraftReply(
  job: Extract<AiJob, { type: 'draft-reply' }>,
): Promise<void> {
  const result = await draftReply({
    tenantId: job.tenantId,
    conversationId: job.conversationId,
  });

  await prisma.aiSuggestion.update({
    where: { id: job.suggestionId },
    data: {
      status: 'READY',
      content: result.content,
      model: result.model,
      data: { citations: result.citations } as unknown as Prisma.InputJsonValue,
      error: null,
    },
  });
}

export async function handleTriageTicket(
  job: Extract<AiJob, { type: 'triage-ticket' }>,
): Promise<void> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: job.ticketId, tenantId: job.tenantId },
    select: { id: true, subject: true, description: true },
  });
  if (!ticket) throw new Error(`Ticket ${job.ticketId} not found`);

  const { triage, model } = await triageTicket({
    tenantId: job.tenantId,
    subject: ticket.subject,
    description: ticket.description,
  });

  await prisma.aiSuggestion.update({
    where: { id: job.suggestionId },
    data: {
      status: 'READY',
      model,
      content: triage.summary,
      data: triage as unknown as Prisma.InputJsonValue,
      error: null,
    },
  });

  // The triage result is advisory: priority is applied automatically, but a
  // ticket the model flagged as ambiguous or sensitive is left for a person.
  if (!triage.needsHumanReview) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { priority: triage.priority },
    });
    await audit({
      tenantId: job.tenantId,
      action: 'ticket.ai_triaged',
      entityType: 'ticket',
      entityId: ticket.id,
      changes: { priority: triage.priority, category: triage.category, model },
    });
  }
}

export async function processAiJob(job: AiJob): Promise<void> {
  switch (job.type) {
    case 'draft-reply':
      return handleDraftReply(job);
    case 'triage-ticket':
      return handleTriageTicket(job);
  }
}

/**
 * Record a terminal failure on the suggestion so the agent sees why nothing
 * arrived. Called only once BullMQ has exhausted its retries.
 */
export async function recordJobFailure(suggestionId: string, message: string): Promise<void> {
  await prisma.aiSuggestion
    .update({
      where: { id: suggestionId },
      data: { status: 'FAILED', error: message.slice(0, 1000) },
    })
    .catch((error) => {
      console.error('[ai-worker] could not record failure:', error);
    });
}
