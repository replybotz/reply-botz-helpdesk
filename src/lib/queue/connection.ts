import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ bundles its own ioredis copy, so passing a shared client instance
 * fails to typecheck. Parse REDIS_URL into plain connection options instead —
 * BullMQ then owns its connections, which it needs anyway:
 * `maxRetriesPerRequest: null` is required for its blocking commands and is
 * incompatible with the app's Redis client.
 */
export function queueConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const db = url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : undefined;

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: decodeURIComponent(url.password) || undefined,
    ...(Number.isFinite(db) ? { db } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
