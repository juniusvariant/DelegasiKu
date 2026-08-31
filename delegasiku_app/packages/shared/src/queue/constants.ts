/**
 * BullMQ queue constants (WP-05)
 * Shared between callback (producer) and worker (consumer)
 */

export const QUEUE_NAMES = {
  VERIFICATION: 'verification',
  EXPIRY_SWEEP: 'expiry-sweep',
} as const;

/** Job types within the verification queue */
export const VERIFICATION_JOBS = {
  AUTHORITATIVE_FETCH: 'authoritative-fetch',
} as const;

/** Job payload for authoritative verification fetch (FR-06) */
export interface AuthoritativeFetchPayload {
  delegationId: string;
  externalTransactionId: string;
  /** Idempotency key from callback; duplicate deliveries collapse to one job */
  idempotencyKey: string;
  apiBaseUrl: string;
}

export const EXPIRY_SWEEP_JOB = 'sweep-expired-delegations';
