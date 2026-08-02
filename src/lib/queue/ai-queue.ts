import { Queue } from 'bullmq';
import { queueConnection } from './connection';

export const AI_QUEUE_NAME = 'ai';

export type AiJob =
  | { type: 'draft-reply'; tenantId: string; conversationId: string; suggestionId: string }
  | { type: 'triage-ticket'; tenantId: string; ticketId: string; suggestionId: string }
  /** Housekeeping, scheduled by the worker rather than requested by a user. */
  | { type: 'purge-sessions' };

export const PURGE_SESSIONS_JOB = 'purge-sessions';

function createAiQueue() {
  return new Queue<AiJob>(AI_QUEUE_NAME, {
    connection: queueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
}

type AiQueue = ReturnType<typeof createAiQueue>;

const globalForQueue = globalThis as unknown as { aiQueue?: AiQueue };

export const aiQueue: AiQueue = globalForQueue.aiQueue ?? createAiQueue();

if (process.env.NODE_ENV !== 'production') globalForQueue.aiQueue = aiQueue;

export async function enqueueAiJob(
  job: Extract<AiJob, { suggestionId: string }>,
): Promise<void> {
  // jobId dedupes retries of the same suggestion.
  await aiQueue.add(job.type, job, { jobId: job.suggestionId });
}

/**
 * Register the recurring session purge. Repeatable jobs are keyed by name, so
 * calling this on every worker boot updates rather than duplicates the schedule.
 */
export async function scheduleMaintenance(): Promise<void> {
  await aiQueue.add(
    PURGE_SESSIONS_JOB,
    { type: 'purge-sessions' },
    {
      repeat: { pattern: '17 * * * *' },
      removeOnComplete: true,
      attempts: 1,
    },
  );
}
