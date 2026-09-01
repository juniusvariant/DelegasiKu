/**
 * Delegation routes — thin handlers (CODING-STANDARDS §3)
 * Parse/validate → call service → map result
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DelegationService } from './delegation.service.js';

const createDelegationSchema = z.object({
  organizationId: z.string().uuid(),
  caseId: z.string().uuid(),
  allowedAction: z.string().min(1).max(200),
  validFrom: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const revokeSchema = z.object({
  reason: z.string().max(500).optional(),
});

const tokenParamSchema = z.object({
  token: z.string().min(1),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function delegationRoutes(app: FastifyInstance, service: DelegationService) {
  // ----- Admin endpoints (session-guarded at app level in WP-04 final) -----

  app.post('/api/delegations', async (request, reply) => {
    const body = createDelegationSchema.parse(request.body);
    const result = await service.createDelegation({
      ...body,
      validFrom: new Date(body.validFrom),
      expiresAt: new Date(body.expiresAt),
    });
    return reply.status(201).send({
      delegation: result.delegation,
      invitationUrl: result.invitationUrl,
    });
  });

  app.get('/api/delegations', async (request) => {
    const query = z.object({ organizationId: z.string().uuid() }).parse(request.query);
    const delegations = await service.listDelegations(query.organizationId);
    return { delegations };
  });

  app.get('/api/delegations/:id', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return service.getDelegationDetail(id);
  });

  app.post('/api/delegations/:id/revoke', async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const body = revokeSchema.parse(request.body ?? {});
    const delegation = await service.revokeDelegation(id, body.reason);
    return { delegation };
  });

  // ----- Representative endpoints (invitation token) -----

  app.get('/api/invitations/:token', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    return service.resolveInvitation(token);
  });

  app.post('/api/invitations/:token/consent', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    return service.recordConsent(token);
  });

  app.post('/api/invitations/:token/verify', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    return service.startVerification(token);
  });

  app.get('/api/invitations/:token/status', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    return service.checkInvitationStatus(token);
  });

  app.post('/api/invitations/:token/accept', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    const result = await service.acceptDelegation(token);
    return {
      delegation: result.delegation,
      proofTokenDigest: result.proofTokenDigest,
      simulationMode: result.simulationMode,
    };
  });

  // ----- Public proof endpoint (no auth; minimized payload) -----

  app.get('/api/proofs/:token', async (request) => {
    const { token } = tokenParamSchema.parse(request.params);
    return service.resolvePublicProof(token);
  });

  // ----- Internal: verification completion (called by worker) -----

  app.post('/api/internal/verifications/complete', async (request) => {
    // The worker forwards only the provider session id; the service resolves
    // the delegation via verification_attempts.externalTransactionId (FR-06).
    const body = z
      .object({
        externalTransactionId: z.string().min(1),
        delegationId: z.string().uuid().optional(), // ignored; kept for back-compat
      })
      .parse(request.body);
    return service.completeVerification(body.externalTransactionId);
  });
}
