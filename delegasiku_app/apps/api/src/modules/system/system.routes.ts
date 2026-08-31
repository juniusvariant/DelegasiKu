/**
 * System routes: health, diagnostics, org/case info, demo reset
 */

import type { FastifyInstance } from 'fastify';
import type { VerificationAdapter } from '@dku/shared';

export async function systemRoutes(
  app: FastifyInstance,
  adapter: VerificationAdapter,
  integrationMode: string
) {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async () => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return { status: 'not_ready' };
    }
  });

  /** Diagnostics (§13.1): integration mode + provider status, NO secrets */
  app.get('/api/diagnostics', async () => {
    const health = await adapter.healthCheck();
    return {
      integrationMode,
      provider: health,
      demoLabel: integrationMode === 'DEMO' ? 'Simulation mode' : null,
    };
  });

  /** Seeded org (FR-01) */
  app.get('/api/organizations/current', async () => {
    const org = await app.prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    return { organization: org };
  });

  /** Seeded cases (FR-01) */
  app.get('/api/cases', async () => {
    const cases = await app.prisma.case.findMany({ orderBy: { createdAt: 'asc' } });
    return { cases };
  });

  /** Demo reset (§12.6) — re-seed the demo scenario */
  app.post('/api/admin/demo/reset', async (request) => {
    await app.prisma.$transaction([
      app.prisma.auditEvent.deleteMany(),
      app.prisma.verificationAttempt.deleteMany(),
      app.prisma.delegation.deleteMany(),
      app.prisma.representativeIdentity.deleteMany(),
    ]);
    request.log.info('Demo state reset (delegations/attempts/audits cleared)');
    return { reset: true };
  });
}
