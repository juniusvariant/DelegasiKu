/**
 * Tests for delegation state machine and activation rule
 * Per PRD §10.1, §10.3, FR-09, ADR-004
 */

import { describe, it, expect } from 'vitest';
import {
  computeEffectiveProofStatus,
  canBeActive,
  canTransitionTo,
  getStatusFromVerification,
} from './delegation-status.js';
import { DelegationStatus, VerificationStatus, ProofStatus } from '@dku/shared';

describe('Activation Rule (FR-09, §10.3)', () => {
  const baseActiveDelegation = {
    status: DelegationStatus.ACTIVE,
    validFrom: new Date('2026-01-01'),
    expiresAt: new Date('2026-12-31'),
    revokedAt: null,
    acceptedAt: new Date('2026-01-15'),
    activatedAt: new Date('2026-01-15'),
    verificationStatus: VerificationStatus.VERIFIED,
    organizationEnabled: true,
    caseActive: true,
  };

  it('should be active when all conditions met', () => {
    const now = new Date('2026-06-01');
    expect(canBeActive(baseActiveDelegation, now)).toBe(true);
  });

  it('should NOT be active if organization disabled', () => {
    const delegation = { ...baseActiveDelegation, organizationEnabled: false };
    expect(canBeActive(delegation, new Date('2026-06-01'))).toBe(false);
  });

  it('should NOT be active if case inactive', () => {
    const delegation = { ...baseActiveDelegation, caseActive: false };
    expect(canBeActive(delegation, new Date('2026-06-01'))).toBe(false);
  });

  it('should NOT be active if not VERIFIED', () => {
    const delegation = {
      ...baseActiveDelegation,
      verificationStatus: VerificationStatus.PENDING,
    };
    expect(canBeActive(delegation, new Date('2026-06-01'))).toBe(false);
  });

  it('should NOT be active if not accepted', () => {
    const delegation = { ...baseActiveDelegation, acceptedAt: null };
    expect(canBeActive(delegation, new Date('2026-06-01'))).toBe(false);
  });

  it('should NOT be active before valid_from', () => {
    const now = new Date('2025-12-01');
    expect(canBeActive(baseActiveDelegation, now)).toBe(false);
  });

  it('should NOT be active after expires_at', () => {
    const now = new Date('2027-01-01');
    expect(canBeActive(baseActiveDelegation, now)).toBe(false);
  });

  it('should NOT be active if revoked', () => {
    const delegation = { ...baseActiveDelegation, revokedAt: new Date('2026-06-01') };
    expect(canBeActive(delegation, new Date('2026-06-15'))).toBe(false);
  });
});

describe('Effective Proof Status (ADR-004, FR-13)', () => {
  it('should return REVOKED when revoked_at is set (highest precedence)', () => {
    const delegation = {
      status: DelegationStatus.REVOKED,
      validFrom: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      revokedAt: new Date('2026-06-01'),
      acceptedAt: new Date('2026-01-15'),
      activatedAt: new Date('2026-01-15'),
      verificationStatus: VerificationStatus.VERIFIED,
      organizationEnabled: true,
      caseActive: true,
    };
    
    const now = new Date('2026-06-15');
    expect(computeEffectiveProofStatus(delegation, now)).toBe(ProofStatus.REVOKED);
  });

  it('should return EXPIRED when past expires_at', () => {
    const delegation = {
      status: DelegationStatus.ACTIVE,
      validFrom: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      revokedAt: null,
      acceptedAt: new Date('2026-01-15'),
      activatedAt: new Date('2026-01-15'),
      verificationStatus: VerificationStatus.VERIFIED,
      organizationEnabled: true,
      caseActive: true,
    };
    
    const now = new Date('2027-01-15');
    expect(computeEffectiveProofStatus(delegation, now)).toBe(ProofStatus.EXPIRED);
  });

  it('should return ACTIVE when activation rules met', () => {
    const delegation = {
      status: DelegationStatus.ACTIVE,
      validFrom: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      revokedAt: null,
      acceptedAt: new Date('2026-01-15'),
      activatedAt: new Date('2026-01-15'),
      verificationStatus: VerificationStatus.VERIFIED,
      organizationEnabled: true,
      caseActive: true,
    };
    
    const now = new Date('2026-06-01');
    expect(computeEffectiveProofStatus(delegation, now)).toBe(ProofStatus.ACTIVE);
  });

  it('should return NOT_VALID when activation rules not met', () => {
    const delegation = {
      status: DelegationStatus.PENDING_ACCEPTANCE,
      validFrom: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      revokedAt: null,
      acceptedAt: null, // Not accepted yet
      activatedAt: null,
      verificationStatus: VerificationStatus.VERIFIED,
      organizationEnabled: true,
      caseActive: true,
    };
    
    const now = new Date('2026-06-01');
    expect(computeEffectiveProofStatus(delegation, now)).toBe(ProofStatus.NOT_VALID);
  });
});

describe('State Transitions', () => {
  it('should allow DRAFT → INVITED', () => {
    expect(canTransitionTo(DelegationStatus.DRAFT, DelegationStatus.INVITED)).toBe(true);
  });

  it('should allow INVITED → PENDING_VERIFICATION', () => {
    expect(canTransitionTo(DelegationStatus.INVITED, DelegationStatus.PENDING_VERIFICATION)).toBe(
      true
    );
  });

  it('should allow PENDING_VERIFICATION → PENDING_ACCEPTANCE', () => {
    expect(
      canTransitionTo(DelegationStatus.PENDING_VERIFICATION, DelegationStatus.PENDING_ACCEPTANCE)
    ).toBe(true);
  });

  it('should allow PENDING_ACCEPTANCE → ACTIVE', () => {
    expect(canTransitionTo(DelegationStatus.PENDING_ACCEPTANCE, DelegationStatus.ACTIVE)).toBe(
      true
    );
  });

  it('should allow ACTIVE → REVOKED', () => {
    expect(canTransitionTo(DelegationStatus.ACTIVE, DelegationStatus.REVOKED)).toBe(true);
  });

  it('should NOT allow DRAFT → ACTIVE (skipping states)', () => {
    expect(canTransitionTo(DelegationStatus.DRAFT, DelegationStatus.ACTIVE)).toBe(false);
  });

  it('should NOT allow transitions from terminal REVOKED', () => {
    expect(canTransitionTo(DelegationStatus.REVOKED, DelegationStatus.ACTIVE)).toBe(false);
  });

  it('should NOT allow transitions from terminal EXPIRED', () => {
    expect(canTransitionTo(DelegationStatus.EXPIRED, DelegationStatus.ACTIVE)).toBe(false);
  });
});

describe('Verification to Status Mapping', () => {
  it('should map VERIFIED → PENDING_ACCEPTANCE', () => {
    expect(getStatusFromVerification(VerificationStatus.VERIFIED)).toBe(
      DelegationStatus.PENDING_ACCEPTANCE
    );
  });

  it('should map REJECTED → REJECTED', () => {
    expect(getStatusFromVerification(VerificationStatus.REJECTED)).toBe(
      DelegationStatus.REJECTED
    );
  });

  it('should map MANUAL_REVIEW → MANUAL_REVIEW', () => {
    expect(getStatusFromVerification(VerificationStatus.MANUAL_REVIEW)).toBe(
      DelegationStatus.MANUAL_REVIEW
    );
  });

  it('should map SERVICE_UNAVAILABLE → SERVICE_UNAVAILABLE', () => {
    expect(getStatusFromVerification(VerificationStatus.SERVICE_UNAVAILABLE)).toBe(
      DelegationStatus.SERVICE_UNAVAILABLE
    );
  });
});
