import 'dotenv/config';
import { Worker } from 'bullmq';
import { prisma } from '@/lib/db';
import { queueConnection } from './connection';
import { AI_QUEUE_NAME, scheduleMaintenance, type AiJob } from './ai-queue';
import { processAiJob, recordJobFailure } from './handlers';

const CONCURRENCY = Number(process.env.AI_WORKER_CONCURRENCY ?? 4);

const worker = new Worker<AiJob>(AI_QUEUE_NAME, (job) => processAiJob(job.data), {
  connection: queueConnection(),
  concurrency: CONCURRENCY,
});

worker.on('completed', (job) => {
  console.warn(`[ai-worker] completed ${job.name} (${job.id})`);
});

worker.on('failed', async (job, error) => {
  console.error(`[ai-worker] failed ${job?.name} (${job?.id}):`, error.message);

  // Only surface a failure once BullMQ has exhausted its retries, so a
  // transient provider error doesn't show the agent a dead end.
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts.attempts ?? 1;
  const suggestionId =
    job?.data && 'suggestionId' in job.data ? job.data.suggestionId : undefined;
  if (suggestionId && attemptsMade >= maxAttempts) {
    await recordJobFailure(suggestionId, error.message);
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

scheduleMaintenance().catch((error) => {
  console.error('[ai-worker] could not schedule maintenance jobs:', error);
});

console.warn(`[ai-worker] listening on "${AI_QUEUE_NAME}" (concurrency ${CONCURRENCY})`);
