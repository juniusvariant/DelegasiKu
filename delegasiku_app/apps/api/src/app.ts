/**
 * Fastify app builder (testable)
 * WP-04: wires plugins, domain services, and routes
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { prismaPlugin } from './plugins/prisma.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { createVerificationAdapter } from './adapters/index.js';
import { DelegationRepository } from './modules/delegations/delegation.repository.js';
import { DelegationService } from './modules/delegations/delegation.service.js';
import { delegationRoutes } from './modules/delegations/delegation.routes.js';
import { sessionRoutes } from './modules/session/session.routes.js';
import { systemRoutes } from './modules/system/system.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      // Redaction: never log tokens/NIK/secrets (§12.1)
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'body.password',
          'body.nik',
          '*.token',
          '*.invitationToken',
          '*.proofToken',
        ],
        censor: '[REDACTED]',
      },
    },
    trustProxy: true,
  });

  // Security + infra plugins
  await app.register(helmet);
  // CORS: allow the production web origin plus the Vite dev origin (5173) in development.
  // The browser calls the api cross-origin from the web app.
  const allowedOrigins = new Set(
    [
      config.APP_BASE_URL, // e.g. http://localhost:3000 (prod) or configured origin
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ].filter(Boolean)
  );
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow non-browser tools (curl, server-to-server) with no Origin header
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  // Core plugins
  await app.register(prismaPlugin);
  await app.register(errorHandlerPlugin);

  // Adapter (config-driven; fail fast on unknown mode)
  const adapter = createVerificationAdapter(config);

  // Services (constructor-injected; framework-agnostic)
  const delegationService = new DelegationService(
    new DelegationRepository(app.prisma),
    adapter,
    config.APP_BASE_URL
  );

  // Routes
  await app.register(async (instance) => systemRoutes(instance, adapter, config.INTEGRATION_MODE));
  await app.register(sessionRoutes);
  await app.register(async (instance) => delegationRoutes(instance, delegationService));

  return app;
}
