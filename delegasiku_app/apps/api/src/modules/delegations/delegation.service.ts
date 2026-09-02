/**
 * Delegation service — business logic (framework-agnostic)
 * (CODING-STANDARDS §3: services hold logic, repositories own Prisma)
 */

import type { Prisma } from '@prisma/client';
import {
  DelegationStatus,
  VerificationStatus,
  generateInvitationToken,
  generateProofToken,
  hashToken,
  constantTimeCompare,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ValidationError,
  type VerificationAdapter,
} from '@dku/shared';
import type { DelegationRepository } from './delegation.repository.js';
import {
  canBeActive,
  canTransitionTo,
  computeEffectiveProofStatus,
  getStatusFromVerification,
} from '../../domain/delegation-status.js';

export interface CreateDelegationInput {
  organizationId: string;
  caseId: string;
  allowedAction: string;
  validFrom: Date;
  expiresAt: Date;
}

export class DelegationService {
  constructor(
    private readonly repo: DelegationRepository,
    private readonly adapter: VerificationAdapter,
    private readonly appBaseUrl: string,
    private readonly callbackBaseUrl?: string
  ) {}

  /**
   * Create a delegation + issue T1 invitation (FR-02/03, AC-02)
   * Returns the delegation and the ONE-TIME plaintext invitation URL
   */
  async createDelegation(input: CreateDelegationInput) {
    // Generate T1 (invitation) and T2 (proof) tokens; store SHA-256 digests only
    const invitationToken = generateInvitationToken();
    const proofToken = generateProofToken();

    const scopeSnapshot = {
      allowedAction: input.allowedAction,
      validFrom: input.validFrom.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
    };

    const delegation = await this.repo.create({
      organization: { connect: { id: input.organizationId } },
      case: { connect: { id: input.caseId } },
      invitationTokenDigest: hashToken(invitationToken),
      publicProofTokenDigest: hashToken(proofToken),
      allowedAction: input.allowedAction,
      scopeSnapshot,
      validFrom: input.validFrom,
      expiresAt: input.expiresAt,
      status: DelegationStatus.INVITED,
    });

    await this.audit(delegation.id, 'DELEGATION_CREATED', 'admin', {
      allowedAction: input.allowedAction,
    });
    await this.audit(delegation.id, 'INVITATION_ISSUED', 'admin', {});

    return {
      delegation,
      // Plaintext tokens shown ONCE; never stored (TOKEN-DESIGN §3)
      invitationUrl: `${this.appBaseUrl}/invitations/${invitationToken}`,
      proofUrl: `${this.appBaseUrl}/proof/${proofToken}`,
    };
  }

  async listDelegations(organizationId: string) {
    return this.repo.listByOrganization(organizationId);
  }

  async getDelegationDetail(id: string) {
    const delegation = await this.repo.findById(id);
    if (!delegation) throw new NotFoundError('Delegation not found', 'DELEGATION_NOT_FOUND');
    const auditEvents = await this.repo.getAuditEvents(id);
    return { delegation, auditEvents };
  }

  /**
   * Resolve invitation → scope disclosure (FR-04, AC-03)
   * Fails closed on unknown/expired/revoked/completed invitations
   */
  async resolveInvitation(token: string) {
    const delegation = await this.findByTokenDigest(token, 'invitation');

    if (delegation.status === DelegationStatus.REVOKED) {
      throw new ConflictError('Invitation has been revoked', 'INVITATION_REVOKED');
    }
    if (delegation.acceptedAt) {
      throw new ConflictError('Invitation already accepted', 'INVITATION_ALREADY_ACCEPTED');
    }
    if (new Date() >= delegation.expiresAt) {
      throw new ConflictError('Invitation expired', 'INVITATION_EXPIRED');
    }
    if (delegation.status !== DelegationStatus.INVITED) {
      throw new ConflictError('Invitation invalid or expired', 'INVITATION_INVALID');
    }

    return {
      delegationId: delegation.id,
      scopeSnapshot: delegation.scopeSnapshot,
      expiresAt: delegation.expiresAt,
    };
  }

  /** Record representative consent (FR-04) */
  async recordConsent(token: string) {
    const { delegationId } = await this.resolveInvitation(token);
    await this.audit(delegationId, 'CONSENT_RECORDED', 'representative', {});
    return { delegationId, consentRecorded: true };
  }

  /**
   * Check invitation status for polling (allows UI to wait for async verification)
   * Unlike resolveInvitation, this allows PENDING_VERIFICATION and PENDING_ACCEPTANCE
   * so the UI can poll until the worker completes the verification.
   */
  async checkInvitationStatus(token: string) {
    const delegation = await this.findByTokenDigest(token, 'invitation');

    if (delegation.status === DelegationStatus.REVOKED) {
      throw new ConflictError('Invitation has been revoked', 'INVITATION_REVOKED');
    }
    if (delegation.acceptedAt) {
      throw new ConflictError('Invitation already accepted', 'INVITATION_ALREADY_ACCEPTED');
    }
    if (new Date() >= delegation.expiresAt) {
      throw new ConflictError('Invitation expired', 'INVITATION_EXPIRED');
    }

    return {
      status: delegation.status,
      canAccept: delegation.status === DelegationStatus.PENDING_ACCEPTANCE,
      isPending: delegation.status === DelegationStatus.PENDING_VERIFICATION,
      isFailed:
        delegation.status === DelegationStatus.REJECTED ||
        delegation.status === DelegationStatus.SERVICE_UNAVAILABLE ||
        delegation.status === DelegationStatus.MANUAL_REVIEW,
    };
  }

  /**
   * Start verification via adapter (FR-05)
   * Transitions INVITED → PENDING_VERIFICATION
   */
  async startVerification(token: string) {
    const { delegationId } = await this.resolveInvitation(token);
    const delegation = await this.repo.findById(delegationId);
    if (!delegation) throw new NotFoundError('Delegation not found');

    if (!canTransitionTo(delegation.status as DelegationStatus, DelegationStatus.PENDING_VERIFICATION)) {
      throw new ConflictError('Cannot start verification from current state', 'INVALID_TRANSITION');
    }

    // Use CALLBACK_BASE_URL if provided (for separate callback service),
    // otherwise fall back to APP_BASE_URL (monolith deployment)
    const baseUrl = this.callbackBaseUrl ?? this.appBaseUrl;
    const callbackUrl = `${baseUrl}/api/callbacks/eid/presentation`;
    const session = await this.adapter.startVerification(delegationId, callbackUrl);

    await this.repo.update(delegationId, { status: DelegationStatus.PENDING_VERIFICATION });
    await this.repo.createVerificationAttempt({
      delegation: { connect: { id: delegationId } },
      mode: this.adapter.getMode(),
      provider: 'e.id',
      referenceId: session.referenceId,
      externalTransactionId: session.externalTransactionId,
      status: VerificationStatus.PENDING,
      startedAt: new Date(),
    });
    await this.audit(delegationId, 'VERIFICATION_STARTED', 'representative', {
      mode: this.adapter.getMode(),
      simulation: this.adapter.getMode() === 'DEMO',
    });

    return {
      delegationId,
      referenceId: session.referenceId,
      externalTransactionId: session.externalTransactionId,
      verificationUrl: session.verificationUrl,
      qrCodeData: session.qrCodeData,
      simulationMode: this.adapter.getMode() === 'DEMO',
    };
  }

  /**
   * Complete verification with authoritative result (FR-06)
   * Called by worker after fetching the authoritative result.
   *
   * The webhook/worker knows only the provider session_id (externalTransactionId).
   * We resolve the delegation via verification_attempts.externalTransactionId,
   * so no delegation id needs to travel through the webhook payload.
   */
  async completeVerification(externalTransactionId: string) {
    const attempt = await this.repo.findVerificationAttemptByExternalId(externalTransactionId);
    const delegation = await this.repo.findDelegationByExternalTransactionId(externalTransactionId);

    if (!delegation) {
      // Unknown session — fail closed, reveal nothing (AC-13)
      throw new NotFoundError('Unknown verification session', 'UNKNOWN_VERIFICATION_SESSION');
    }

    const result = await this.adapter.fetchVerificationResult(externalTransactionId);
    const nextStatus = getStatusFromVerification(result.status);

    // Persist attempt outcome + transition delegation (fail-closed, §12.3/FR-18)
    if (attempt) {
      await this.repo.updateVerificationAttempt(attempt.id, {
        status: result.status,
        reasonCode: result.reasonCode ?? null,
        completedAt: new Date(),
      });
    }
    await this.repo.update(delegation.id, { status: nextStatus });
    await this.audit(delegation.id, 'VERIFICATION_COMPLETED', 'system', {
      status: result.status,
      reasonCode: result.reasonCode ?? null,
      simulation: result.simulationMode ?? false,
    });

    return { delegationId: delegation.id, verificationStatus: result.status, nextStatus };
  }

  /**
   * Accept scope → activate delegation (FR-08/09, AC-06/07)
   * Applies the activation rule; returns proof token URL on success
   */
  async acceptDelegation(token: string) {
    const delegation = await this.findByTokenDigest(token, 'invitation');

    if (delegation.status !== DelegationStatus.PENDING_ACCEPTANCE) {
      throw new ConflictError('Delegation is not pending acceptance', 'NOT_PENDING_ACCEPTANCE');
    }

    const now = new Date();
    const full = await this.repo.findWithContext(delegation.id);
    if (!full) throw new NotFoundError('Delegation not found');

    const active = canBeActive(
      {
        status: full.status as DelegationStatus,
        validFrom: full.validFrom,
        expiresAt: full.expiresAt,
        revokedAt: full.revokedAt,
        acceptedAt: now,
        activatedAt: full.activatedAt,
        verificationStatus: (full.representativeIdentity?.verificationStatus ??
          VerificationStatus.VERIFIED) as VerificationStatus,
        organizationEnabled: full.organization.status === 'enabled',
        caseActive: full.case.status === 'active',
      },
      now
    );

    if (!active) {
      throw new ConflictError('Activation rule not satisfied', 'ACTIVATION_RULE_FAILED');
    }

    const updated = await this.repo.update(delegation.id, {
      status: DelegationStatus.ACTIVE,
      acceptedAt: now,
      activatedAt: now,
    });

    await this.audit(delegation.id, 'SCOPE_ACCEPTED', 'representative', {});
    await this.audit(delegation.id, 'DELEGATION_ACTIVATED', 'system', {});

    // Note: The plaintext proof token was returned during createDelegation().
    // We cannot re-derive it from the digest stored in the database.
    // The admin should have saved the proofUrl from the creation response.
    return {
      delegation: updated,
      simulationMode: this.adapter.getMode() === 'DEMO',
    };
  }

  /**
   * Revoke an active delegation (FR-12, AC-11)
   * Effective immediately at read time (ADR-004)
   */
  async revokeDelegation(id: string, reason?: string) {
    const delegation = await this.repo.findById(id);
    if (!delegation) throw new NotFoundError('Delegation not found', 'DELEGATION_NOT_FOUND');

    if (delegation.revokedAt) {
      throw new ConflictError('Delegation already revoked', 'ALREADY_REVOKED');
    }

    const updated = await this.repo.update(id, {
      status: DelegationStatus.REVOKED,
      revokedAt: new Date(),
      revocationReason: reason ?? null,
    });

    await this.audit(id, 'DELEGATION_REVOKED', 'admin', { reason: reason ?? null });

    return updated;
  }

  /**
   * Public proof resolution (FR-11, AC-09/12/13)
   * Read-time effective status; minimized payload; fail-closed
   */
  async resolvePublicProof(proofToken: string) {
    const digest = hashToken(proofToken);
    const full = await this.repo.findByProofTokenWithContext(digest);

    // Unknown token → NOT_VALID, reveal nothing (AC-13)
    if (!full) {
      return { status: 'NOT_VALID' as const };
    }

    const status = computeEffectiveProofStatus({
      status: full.status as DelegationStatus,
      validFrom: full.validFrom,
      expiresAt: full.expiresAt,
      revokedAt: full.revokedAt,
      acceptedAt: full.acceptedAt,
      activatedAt: full.activatedAt,
      verificationStatus: (full.representativeIdentity?.verificationStatus ??
        VerificationStatus.VERIFIED) as VerificationStatus,
      organizationEnabled: full.organization.status === 'enabled',
      caseActive: full.case.status === 'active',
    });

    // Minimized FR-11 payload — no raw provider data, no NIK, no internal secrets
    return {
      status,
      organizationName: full.organization.name,
      allowedAction: full.allowedAction,
      validFrom: full.validFrom,
      expiresAt: full.expiresAt,
      representativeDisplayName: full.representativeIdentity?.displayName ?? null,
      caseReference: full.case.reference,
      simulationMode: this.adapter.getMode() === 'DEMO',
    };
  }

  // -------------------------------------------------------------------------

  private async findByTokenDigest(token: string, kind: 'invitation' | 'proof') {
    const digest = hashToken(token);
    const delegation =
      kind === 'invitation'
        ? await this.repo.findByInvitationTokenDigest(digest)
        : await this.repo.findByPublicProofTokenDigest(digest);

    if (!delegation) {
      throw new NotFoundError(
        kind === 'invitation' ? 'Invitation invalid or expired' : 'Proof not found',
        kind === 'invitation' ? 'INVITATION_INVALID' : 'PROOF_NOT_FOUND'
      );
    }

    // Defense-in-depth constant-time re-check (timing attack mitigation)
    const stored =
      kind === 'invitation' ? delegation.invitationTokenDigest : delegation.publicProofTokenDigest;
    if (!constantTimeCompare(digest, stored)) {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }

    return delegation;
  }

  private async audit(
    delegationId: string,
    eventType: string,
    actorType: 'admin' | 'representative' | 'system',
    safeMetadata: Record<string, unknown>
  ) {
    await this.repo.addAuditEvent({
      delegation: { connect: { id: delegationId } },
      eventType,
      actorType,
      safeMetadata: safeMetadata as Prisma.InputJsonValue,
    });
  }
}

/** Guard for ValidationError usage in future input validation */
export function assertValid(condition: boolean, message: string): void {
  if (!condition) throw new ValidationError(message);
}
