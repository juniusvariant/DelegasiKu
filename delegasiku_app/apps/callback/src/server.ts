/**
 * Callback service (WP-05, FR-15)
 * Webhook intake: validate → dedupe → enqueue → fast 2xx
 * Never activates from callback (FR-06); raw bodies never logged (§12.1)
 */

import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { createVerificationQueue, enqueueAuthoritativeFetch } from './queue.js';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const VALKEY_URL = process.env.VALKEY_URL ?? 'redis://localhost:6379';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
const EID_WEBHOOK_SECRET = process.env.EID_VERIFIER_WEBHOOK_SECRET ?? '';

// Real e.id Verifier presentation webhook payload (scan / reject / approve).
// The gateway POSTs the VP session object to default_webhook_url on each event.
// Key identifier is `session_id` (the VP session), status is the lifecycle enum.
const presentationEventSchema = z.object({
  session_id: z.string().min(1),
  status: z.string().optional(), // PENDING|SCANNED|WAITING_APPROVAL|APPROVED|REJECTED|EXPIRED|CANCELED
  event_type: z.string().optional(),
  reject_reason: z.string().nullable().optional(),
  // Optional correlation back to our delegation if we set it at request time
  external_reference: z.string().optional(),
  delegation_id: z.string().optional(),
});

const kycEventSchema = z.object({
  transaction_id: z.string().min(1),
  reference_id: z.string().min(1).optional(),
  event_type: z.string().optional(),
  status: z.string().optional(),
});

export async function buildCallbackApp() {
  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
          : undefined,
      redact: {
        paths: ['body.transactionId', 'body.transaction_id', 'req.headers["x-signature"]'],
        censor: '[REDACTED]',
      },
    },
    trustProxy: true,
  });

  await app.register(helmet);
  await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });

  const queue = createVerificationQueue(VALKEY_URL);

  app.get('/healthz', async () => ({ status: 'ok' }));

  /**
   * Verifier presentation event (LIVE_VERIFIER notification)
   * Fast 2xx; enqueue authoritative fetch (FR-06/15, AC-05/14)
   */
  app.post('/api/callbacks/eid/presentation', async (request, reply) => {
    // Verify webhook signature in LIVE mode (skipped in DEMO)
    if (EID_WEBHOOK_SECRET && request.headers['x-signature'] !== EID_WEBHOOK_SECRET) {
      request.log.warn('Invalid webhook signature');
      return reply.status(401).send({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature', status: 401 } });
    }

    const parsed = presentationEventSchema.safeParse(request.body);
    if (!parsed.success) {
      // Still 2xx to avoid provider retries on malformed payload (logged)
      request.log.warn({ issues: parsed.error.issues }, 'Malformed presentation event');
      return reply.status(202).send({ received: true, processed: false });
    }

    const event = parsed.data;
    // Idempotency on the VP session id: duplicate deliveries collapse to one job (AC-14)
    const idempotencyKey = `presentation-${event.session_id}`;

    const { enqueued } = await enqueueAuthoritativeFetch(queue, {
      delegationId: event.delegation_id ?? event.external_reference ?? 'unknown',
      externalTransactionId: event.session_id,
      idempotencyKey,
      apiBaseUrl: API_BASE_URL,
    });

    request.log.info({ idempotencyKey, status: event.status, enqueued }, 'Presentation event accepted');
    return reply.status(202).send({ received: true, enqueued });
  });

  /** KYC status event (LIVE_KYC notification) */
  app.post('/api/callbacks/eid/kyc', async (request, reply) => {
    if (EID_WEBHOOK_SECRET && request.headers['x-signature'] !== EID_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature', status: 401 } });
    }

    const parsed = kycEventSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ issues: parsed.error.issues }, 'Malformed KYC event');
      return reply.status(202).send({ received: true, processed: false });
    }

    const event = parsed.data;
    const idempotencyKey = `kyc-${event.transaction_id}`;

    const { enqueued } = await enqueueAuthoritativeFetch(queue, {
      delegationId: event.reference_id ?? 'unknown',
      externalTransactionId: event.transaction_id,
      idempotencyKey,
      apiBaseUrl: API_BASE_URL,
    });

    request.log.info({ idempotencyKey, enqueued }, 'KYC event accepted');
    return reply.status(202).send({ received: true, enqueued });
  });

  app.addHook('onClose', async () => {
    await queue.close();
  });

  return app;
}

const start = async () => {
  const app = await buildCallbackApp();
  try {
    const port = Number(process.env.PORT) || 3002;
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
    app.log.info(`Callback server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Only auto-start when run directly (not when imported for tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
