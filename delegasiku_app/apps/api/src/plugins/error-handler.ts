/**
 * Error handler plugin (CODING-STANDARDS §6)
 * Maps domain errors to consistent HTTP responses
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '@dku/shared';

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: FastifyError | DomainError, request: FastifyRequest, reply: FastifyReply) => {
      // Domain errors carry their own status + code
      if (error instanceof DomainError) {
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            status: error.statusCode,
          },
        });
      }

      // Fastify validation errors (JSON Schema)
      const fastifyError = error as FastifyError;
      if (fastifyError.statusCode && fastifyError.statusCode < 500) {
        return reply.status(fastifyError.statusCode).send({
          error: {
            code: fastifyError.code ?? 'BAD_REQUEST',
            message: fastifyError.message,
            status: fastifyError.statusCode,
          },
        });
      }

      // Unknown errors: log server-side (redacted), return generic 500
      request.log.error({ err: fastifyError }, 'Unhandled error');
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          status: 500,
        },
      });
    }
  );
});
