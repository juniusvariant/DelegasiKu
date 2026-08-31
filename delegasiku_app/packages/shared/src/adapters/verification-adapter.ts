/**
 * Verification Adapter Port (Interface)
 * Per ADR-005 and FR-05
 * 
 * All three adapters (DEMO, LIVE_VERIFIER, LIVE_KYC) implement this interface
 * to provide a normalized verification result contract.
 */

import { NormalizedVerificationResult } from '../types/verification.js';

/**
 * Verification adapter interface
 * Abstracts the differences between DEMO, LIVE_VERIFIER, and LIVE_KYC modes
 */
export interface VerificationAdapter {
  /**
   * Start a verification session
   * 
   * @param delegationId - DelegasiKu delegation ID for correlation
   * @param callbackUrl - URL for provider to send results (webhook)
   * @returns Provider-specific session/transaction reference
   */
  startVerification(
    delegationId: string,
    callbackUrl: string
  ): Promise<{
    referenceId: string; // DelegasiKu correlation ID
    externalTransactionId: string; // Provider's transaction ID (opaque)
    verificationUrl?: string; // URL to redirect representative (LIVE_VERIFIER)
    qrCodeData?: string; // QR code data for scanning (LIVE_VERIFIER)
  }>;

  /**
   * Fetch verification result (authoritative)
   * Called by worker after webhook notification (FR-06)
   * 
   * @param externalTransactionId - Provider's transaction ID
   * @returns Normalized verification result
   */
  fetchVerificationResult(
    externalTransactionId: string
  ): Promise<NormalizedVerificationResult>;

  /**
   * Get adapter mode identifier
   */
  getMode(): 'DEMO' | 'LIVE_VERIFIER' | 'LIVE_KYC';

  /**
   * Check if adapter is properly configured and ready
   * Used by diagnostics endpoint (§13.1)
   */
  healthCheck(): Promise<{
    healthy: boolean;
    mode: string;
    message?: string;
  }>;
}
