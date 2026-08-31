/**
 * Prisma client plugin for Fastify
 * Single shared instance with connection lifecycle management
 */

import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

  await prisma.$connect();
  app.log.info('Prisma connected to PostgreSQL');

  app.decorate('prisma', prisma);

  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    instance.log.info('Prisma disconnected');
  });
});
