/**
 * Worker (WP-05, FR-06)
 * BullMQ consumer: authoritative fetch → state transition via api
 * Plus: expiry sweep complementing read-time expiry (ADR-004)
 */

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import {
  QUEUE_NAMES,
  VERIFICATION_JOBS,
  EXPIRY_SWEEP_JOB,
  type AuthoritativeFetchPayload,
} from '@dku/shared';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
      : undefined,
});

const VALKEY_URL = process.env.VALKEY_URL ?? 'redis://localhost:6379';
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

const connection = new IORedis(VALKEY_URL, { maxRetriesPerRequest: null });

/**
 * Authoritative fetch processor (FR-06)
 * Callbacks are notifications only; this worker calls api to fetch the
 * authoritative result and transition state — never trust the webhook payload.
 */
async function processAuthoritativeFetch(payload: AuthoritativeFetchPayload): Promise<void> {
  logger.info(
    { delegationId: payload.delegationId, txn: '[REDACTED]' },
    'Processing authoritative fetch'
  );

  // Forward only the provider session id; the api resolves the delegation via
  // verification_attempts.externalTransactionId (FR-06). No delegation id needed.
  const response = await fetch(`${payload.apiBaseUrl}/api/internal/verifications/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalTransactionId: payload.externalTransactionId,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API verification completion failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as { nextStatus: string };
  logger.info({ nextStatus: result.nextStatus }, 'Authoritative fetch completed');
}

const worker = new Worker(
  QUEUE_NAMES.VERIFICATION,
  async (job) => {
    if (job.name === VERIFICATION_JOBS.AUTHORITATIVE_FETCH) {
      await processAuthoritativeFetch(job.data as AuthoritativeFetchPayload);
    }
  },
  { connection, concurrency: CONCURRENCY }
);

worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Job completed'));
worker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'Job failed')
);

/**
 * Expiry sweep (complements read-time expiry; ADR-004)
 * Read-time status is authoritative; this sweep persists EXPIRED markers
 * for reporting and audit, scheduled via repeatable job.
 */
async function scheduleExpirySweep(): Promise<void> {
  const sweepQueue = new Queue(QUEUE_NAMES.EXPIRY_SWEEP, { connection });
  await sweepQueue.add(
    EXPIRY_SWEEP_JOB,
    { ranAt: new Date().toISOString() },
    {
      repeat: { every: 60_000 }, // every minute
      removeOnComplete: 10,
      removeOnFail: 50,
    }
  );
  logger.info('Expiry sweep scheduled (every 60s)');
}

const start = async (): Promise<void> => {
  logger.info('Worker starting...');
  await scheduleExpirySweep();
  logger.info({ concurrency: CONCURRENCY }, 'Worker ready');
};

const shutdown = async (): Promise<void> => {
  logger.info('Worker shutting down...');
  await worker.close();
  await connection.quit();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

start().catch((err) => {
  logger.error(err, 'Worker failed to start');
  process.exit(1);
});
