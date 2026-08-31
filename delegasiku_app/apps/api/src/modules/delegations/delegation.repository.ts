/**
 * Delegation repository — owns all Prisma access for delegations
 * (CODING-STANDARDS §3: services never import @prisma/client directly)
 */

import type { PrismaClient, Prisma, Delegation } from '@prisma/client';

export class DelegationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.DelegationCreateInput): Promise<Delegation> {
    return this.prisma.delegation.create({ data });
  }

  async findById(id: string): Promise<Delegation | null> {
    return this.prisma.delegation.findUnique({ where: { id } });
  }

  async findByInvitationTokenDigest(digest: string): Promise<Delegation | null> {
    return this.prisma.delegation.findUnique({
      where: { invitationTokenDigest: digest },
    });
  }

  async findByPublicProofTokenDigest(digest: string): Promise<Delegation | null> {
    return this.prisma.delegation.findUnique({
      where: { publicProofTokenDigest: digest },
    });
  }

  async listByOrganization(organizationId: string): Promise<Delegation[]> {
    return this.prisma.delegation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.DelegationUpdateInput): Promise<Delegation> {
    return this.prisma.delegation.update({ where: { id }, data });
  }

  /** Fetch delegation with org + case for activation-rule evaluation */
  async findWithContext(id: string) {
    return this.prisma.delegation.findUnique({
      where: { id },
      include: {
        organization: true,
        case: true,
        representativeIdentity: true,
      },
    });
  }

  async findByProofTokenWithContext(digest: string) {
    return this.prisma.delegation.findUnique({
      where: { publicProofTokenDigest: digest },
      include: {
        organization: true,
        case: true,
        representativeIdentity: true,
      },
    });
  }

  /** Audit timeline for a delegation (FR-14) */
  async getAuditEvents(delegationId: string) {
    return this.prisma.auditEvent.findMany({
      where: { delegationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAuditEvent(data: Prisma.AuditEventCreateInput) {
    return this.prisma.auditEvent.create({ data });
  }

  async createVerificationAttempt(data: Prisma.VerificationAttemptCreateInput) {
    return this.prisma.verificationAttempt.create({ data });
  }

  /**
   * Resolve a delegation from a provider transaction/session id (FR-06).
   * The webhook carries only the provider session_id; we correlate back to the
   * delegation via the verification_attempts row written at startVerification.
   */
  async findDelegationByExternalTransactionId(externalTransactionId: string) {
    const attempt = await this.prisma.verificationAttempt.findFirst({
      where: { externalTransactionId },
      orderBy: { startedAt: 'desc' },
      include: { delegation: true },
    });
    return attempt?.delegation ?? null;
  }

  async findVerificationAttemptByExternalId(externalTransactionId: string) {
    return this.prisma.verificationAttempt.findFirst({
      where: { externalTransactionId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async updateVerificationAttempt(id: string, data: Prisma.VerificationAttemptUpdateInput) {
    return this.prisma.verificationAttempt.update({ where: { id }, data });
  }
}
