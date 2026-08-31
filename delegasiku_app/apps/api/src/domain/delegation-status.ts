/**
 * Delegation State Machine (PRD §10.1)
 * Pure functions for status transitions
 * 
 * Flow:
 * DRAFT → INVITED → PENDING_VERIFICATION → PENDING_ACCEPTANCE → ACTIVE
 * 
 * Terminal states: REVOKED, EXPIRED
 * Failure states: REJECTED, MANUAL_REVIEW, SERVICE_UNAVAILABLE
 */

import { DelegationStatus, VerificationStatus, ProofStatus } from '@dku/shared';

/**
 * Delegation data for status computation
 */
export interface DelegationData {
  status: DelegationStatus;
  validFrom: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  activatedAt: Date | null;
  verificationStatus: VerificationStatus;
  organizationEnabled: boolean;
  caseActive: boolean;
}

/**
 * Compute effective proof status (read-time, ADR-004)
 * Precedence: revoked → expired → activation rules → NOT_VALID
 * 
 * @param delegation - Delegation data
 * @param now - Current timestamp (for testing)
 * @returns Effective proof status
 */
export function computeEffectiveProofStatus(
  delegation: DelegationData,
  now: Date = new Date()
): ProofStatus {
  // Revoked takes precedence
  if (delegation.revokedAt) {
    return ProofStatus.REVOKED;
  }
  
  // Then check expiry
  if (now >= delegation.expiresAt) {
    return ProofStatus.EXPIRED;
  }
  
  // Check activation rules
  if (canBeActive(delegation, now)) {
    return ProofStatus.ACTIVE;
  }
  
  return ProofStatus.NOT_VALID;
}

/**
 * Activation rule (PRD §10.3, FR-09)
 * Active iff:
 * - Organization enabled
 * - Case active
 * - Verification VERIFIED
 * - Accepted by representative
 * - now >= valid_from
 * - now < expires_at
 * - NOT revoked
 * 
 * @param delegation - Delegation data
 * @param now - Current timestamp
 * @returns true if delegation can be active
 */
export function canBeActive(
  delegation: DelegationData,
  now: Date = new Date()
): boolean {
  return (
    delegation.organizationEnabled &&
    delegation.caseActive &&
    delegation.verificationStatus === VerificationStatus.VERIFIED &&
    delegation.acceptedAt !== null &&
    now >= delegation.validFrom &&
    now < delegation.expiresAt &&
    delegation.revokedAt === null
  );
}

/**
 * Check if delegation can transition to a new status
 * 
 * @param currentStatus - Current delegation status
 * @param targetStatus - Desired status
 * @returns true if transition is valid
 */
export function canTransitionTo(
  currentStatus: DelegationStatus,
  targetStatus: DelegationStatus
): boolean {
  const validTransitions: Record<DelegationStatus, DelegationStatus[]> = {
    [DelegationStatus.DRAFT]: [DelegationStatus.INVITED],
    [DelegationStatus.INVITED]: [
      DelegationStatus.PENDING_VERIFICATION,
      DelegationStatus.REVOKED,
    ],
    [DelegationStatus.PENDING_VERIFICATION]: [
      DelegationStatus.PENDING_ACCEPTANCE,
      DelegationStatus.REJECTED,
      DelegationStatus.MANUAL_REVIEW,
      DelegationStatus.SERVICE_UNAVAILABLE,
      DelegationStatus.REVOKED,
    ],
    [DelegationStatus.PENDING_ACCEPTANCE]: [
      DelegationStatus.ACTIVE,
      DelegationStatus.REVOKED,
    ],
    [DelegationStatus.ACTIVE]: [
      DelegationStatus.REVOKED,
      DelegationStatus.EXPIRED,
    ],
    [DelegationStatus.REJECTED]: [], // Terminal
    [DelegationStatus.MANUAL_REVIEW]: [
      DelegationStatus.PENDING_ACCEPTANCE,
      DelegationStatus.REJECTED,
    ],
    [DelegationStatus.SERVICE_UNAVAILABLE]: [
      DelegationStatus.PENDING_VERIFICATION, // Retry
      DelegationStatus.REVOKED,
    ],
    [DelegationStatus.REVOKED]: [], // Terminal
    [DelegationStatus.EXPIRED]: [], // Terminal
  };
  
  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

/**
 * Determine next status based on verification result
 * 
 * @param verificationStatus - Verification outcome
 * @returns Next delegation status
 */
export function getStatusFromVerification(
  verificationStatus: VerificationStatus
): DelegationStatus {
  switch (verificationStatus) {
    case VerificationStatus.VERIFIED:
      return DelegationStatus.PENDING_ACCEPTANCE;
    case VerificationStatus.REJECTED:
      return DelegationStatus.REJECTED;
    case VerificationStatus.MANUAL_REVIEW:
      return DelegationStatus.MANUAL_REVIEW;
    case VerificationStatus.SERVICE_UNAVAILABLE:
      return DelegationStatus.SERVICE_UNAVAILABLE;
    default:
      return DelegationStatus.PENDING_VERIFICATION;
  }
}
