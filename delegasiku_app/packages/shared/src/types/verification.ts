import { VerificationStatus } from './status.js';

/**
 * Normalized verification result contract (FR-05, ADR-005)
 * All three adapters (DEMO, LIVE_VERIFIER, LIVE_KYC) must return this structure
 */
export interface NormalizedVerificationResult {
  status: VerificationStatus;
  subjectReference: string; // Opaque or HMAC'd identifier, never raw NIK
  subjectReferenceType: 'nik_hmac' | 'provider_ref' | 'did';
  displayName?: string; // With consent only
  verifiedAt?: Date;
  evidenceExpiresAt?: Date | null;
  reasonCode?: string; // For REJECTED, MANUAL_REVIEW, SERVICE_UNAVAILABLE
  simulationMode?: boolean; // DEMO adapter sets this to true
}
