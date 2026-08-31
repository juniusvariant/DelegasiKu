/**
 * BullMQ producer (callback service)
 * Enqueues authoritative-fetch jobs; duplicate idempotency keys collapse
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  QUEUE_NAMES,
  VERIFICATION_JOBS,
  type AuthoritativeFetchPayload,
} from '@dku/shared';

export function createVerificationQueue(valkeyUrl: string): Queue {
  const connection = new IORedis(valkeyUrl, { maxRetriesPerRequest: null });
  return new Queue(QUEUE_NAMES.VERIFICATION, { connection });
}

/**
 * Enqueue authoritative fetch with idempotency (FR-15, AC-14)
 * Job ID = idempotency key → BullMQ dedupes repeated deliveries
 */
export async function enqueueAuthoritativeFetch(
  queue: Queue,
  payload: AuthoritativeFetchPayload
): Promise<{ enqueued: boolean; jobId: string }> {
  const job = await queue.add(VERIFICATION_JOBS.AUTHORITATIVE_FETCH, payload, {
    jobId: payload.idempotencyKey, // dedupe key
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });

  return { enqueued: true, jobId: job.id ?? payload.idempotencyKey };
}
