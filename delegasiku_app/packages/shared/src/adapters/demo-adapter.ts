/**
 * DEMO Verification Adapter
 * Per ADR-005 and FR-17
 * 
 * Provides deterministic success/rejection/unavailable fixtures
 * - Same normalized contract as live adapters
 * - Persistent "Simulation mode" labeling
 * - No real personal data
 * - Offline operation (no external calls)
 */

import { randomUUID } from 'crypto';
import { VerificationAdapter } from './verification-adapter.js';
import { NormalizedVerificationResult } from '../types/verification.js';
import { VerificationStatus } from '../types/status.js';

/**
 * DEMO adapter implementation
 * Returns deterministic fixtures based on delegation ID pattern
 */
export class DemoAdapter implements VerificationAdapter {
  getMode(): 'DEMO' {
    return 'DEMO';
  }

  async healthCheck(): Promise<{ healthy: boolean; mode: string; message?: string }> {
    return {
      healthy: true,
      mode: 'DEMO',
      message: 'Simulation mode - offline fixtures',
    };
  }

  async startVerification(
    delegationId: string,
    _callbackUrl: string
  ): Promise<{
    referenceId: string;
    externalTransactionId: string;
    verificationUrl?: string;
    qrCodeData?: string;
  }> {
    // Generate deterministic IDs
    const referenceId = `demo-ref-${delegationId.slice(0, 8)}`;
    const externalTransactionId = `demo-txn-${randomUUID()}`;

    // In DEMO mode, we simulate a verification URL but don't actually redirect
    return {
      referenceId,
      externalTransactionId,
      verificationUrl: `https://demo.delegasiku.local/verify/${externalTransactionId}`,
      qrCodeData: `DEMO-QR-${externalTransactionId}`,
    };
  }

  async fetchVerificationResult(
    externalTransactionId: string
  ): Promise<NormalizedVerificationResult> {
    // Deterministic fixtures based on transaction ID pattern
    // This allows testing different outcomes predictably
    
    if (externalTransactionId.includes('reject')) {
      return this.createRejectedFixture(externalTransactionId);
    }
    
    if (externalTransactionId.includes('unavailable')) {
      return this.createUnavailableFixture(externalTransactionId);
    }
    
    if (externalTransactionId.includes('review')) {
      return this.createManualReviewFixture(externalTransactionId);
    }
    
    // Default: successful verification
    return this.createSuccessFixture(externalTransactionId);
  }

  /**
   * Create a successful VERIFIED fixture
   */
  private createSuccessFixture(transactionId: string): NormalizedVerificationResult {
    return {
      status: VerificationStatus.VERIFIED,
      subjectReference: `demo-subject-${transactionId.slice(-8)}`,
      subjectReferenceType: 'provider_ref',
      displayName: 'Demo Representative',
      verifiedAt: new Date(),
      evidenceExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      simulationMode: true, // FR-17: Persistent simulation label
    };
  }

  /**
   * Create a REJECTED fixture
   */
  private createRejectedFixture(transactionId: string): NormalizedVerificationResult {
    return {
      status: VerificationStatus.REJECTED,
      subjectReference: `demo-rejected-${transactionId.slice(-8)}`,
      subjectReferenceType: 'provider_ref',
      reasonCode: 'DEMO_FACE_MISMATCH',
      simulationMode: true,
    };
  }

  /**
   * Create a SERVICE_UNAVAILABLE fixture
   */
  private createUnavailableFixture(transactionId: string): NormalizedVerificationResult {
    return {
      status: VerificationStatus.SERVICE_UNAVAILABLE,
      subjectReference: `demo-unavail-${transactionId.slice(-8)}`,
      subjectReferenceType: 'provider_ref',
      reasonCode: 'DEMO_PROVIDER_TIMEOUT',
      simulationMode: true,
    };
  }

  /**
   * Create a MANUAL_REVIEW fixture
   */
  private createManualReviewFixture(transactionId: string): NormalizedVerificationResult {
    return {
      status: VerificationStatus.MANUAL_REVIEW,
      subjectReference: `demo-review-${transactionId.slice(-8)}`,
      subjectReferenceType: 'provider_ref',
      reasonCode: 'DEMO_UNCLEAR_DOCUMENT',
      simulationMode: true,
    };
  }
}

/**
 * Factory function to create DEMO adapter instance
 */
export function createDemoAdapter(): DemoAdapter {
  return new DemoAdapter();
}
