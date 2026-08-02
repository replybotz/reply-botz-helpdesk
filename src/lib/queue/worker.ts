import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/db';
import { draftReply } from '@/lib/ai/reply';
import { triageTicket } from '@/lib/ai/triage';
import { audit } from '@/lib/audit';
import { queueConnection } from './connection';
import { AI_QUEUE_NAME, type AiJob } from './ai-queue';

const CONCURRENCY = Number(process.env.AI_WORKER_CONCURRENCY ?? 4);

async function handleDraftReply(job: Extract<AiJob, { type: 'draft-reply' }>) {
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

async function handleTriageTicket(job: Extract<AiJob, { type: 'triage-ticket' }>) {
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

async function processJob(job: Job<AiJob>): Promise<void> {
  switch (job.data.type) {
    case 'draft-reply':
      return handleDraftReply(job.data);
    case 'triage-ticket':
      return handleTriageTicket(job.data);
  }
}

const worker = new Worker<AiJob>(AI_QUEUE_NAME, processJob, {
  connection: queueConnection(),
  concurrency: CONCURRENCY,
});

worker.on('completed', (job) => {
  console.warn(`[ai-worker] completed ${job.name} (${job.id})`);
});

worker.on('failed', async (job, error) => {
  console.error(`[ai-worker] failed ${job?.name} (${job?.id}):`, error.message);
  // Only mark the suggestion failed once BullMQ has exhausted its retries,
  // so a transient provider error doesn't surface to the agent as a failure.
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts.attempts ?? 1;
  if (job?.data.suggestionId && attemptsMade >= maxAttempts) {
    await prisma.aiSuggestion
      .update({
        where: { id: job.data.suggestionId },
        data: { status: 'FAILED', error: error.message.slice(0, 1000) },
      })
      .catch((updateError) => {
        console.error('[ai-worker] could not record failure:', updateError);
      });
  }
});

async function shutdown(signal: string) {
  console.warn(`[ai-worker] ${signal} received, draining...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.warn(`[ai-worker] listening on "${AI_QUEUE_NAME}" (concurrency ${CONCURRENCY})`);
