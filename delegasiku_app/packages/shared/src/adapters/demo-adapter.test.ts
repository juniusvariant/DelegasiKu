/**
 * Tests for DEMO verification adapter
 * Per ADR-005 and FR-17
 */

import { describe, it, expect } from 'vitest';
import { DemoAdapter } from './demo-adapter.js';
import { VerificationStatus } from '../types/status.js';

describe('DemoAdapter', () => {
  const adapter = new DemoAdapter();

  describe('Interface Compliance', () => {
    it('should return DEMO mode', () => {
      expect(adapter.getMode()).toBe('DEMO');
    });

    it('should pass health check', async () => {
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.mode).toBe('DEMO');
      expect(health.message).toContain('Simulation');
    });
  });

  describe('Start Verification', () => {
    it('should generate deterministic reference ID', async () => {
      const delegationId = '550e8400-e29b-41d4-a716-446655440001';
      const result = await adapter.startVerification(delegationId, 'https://callback.test');
      
      expect(result.referenceId).toMatch(/^demo-ref-/);
      expect(result.externalTransactionId).toMatch(/^demo-txn-/);
      expect(result.verificationUrl).toBeTruthy();
      expect(result.qrCodeData).toBeTruthy();
    });
  });

  describe('Fetch Verification Result - Success Path', () => {
    it('should return VERIFIED for default transaction', async () => {
      const result = await adapter.fetchVerificationResult('demo-txn-success-12345678');
      
      expect(result.status).toBe(VerificationStatus.VERIFIED);
      expect(result.subjectReference).toMatch(/^demo-subject-/);
      expect(result.subjectReferenceType).toBe('provider_ref');
      expect(result.displayName).toBe('Demo Representative');
      expect(result.verifiedAt).toBeInstanceOf(Date);
      expect(result.evidenceExpiresAt).toBeInstanceOf(Date);
      expect(result.simulationMode).toBe(true); // FR-17
    });
  });

  describe('Fetch Verification Result - Failure Paths', () => {
    it('should return REJECTED for reject pattern', async () => {
      const result = await adapter.fetchVerificationResult('demo-txn-reject-12345678');
      
      expect(result.status).toBe(VerificationStatus.REJECTED);
      expect(result.reasonCode).toBe('DEMO_FACE_MISMATCH');
      expect(result.simulationMode).toBe(true);
    });

    it('should return SERVICE_UNAVAILABLE for unavailable pattern', async () => {
      const result = await adapter.fetchVerificationResult('demo-txn-unavailable-12345678');
      
      expect(result.status).toBe(VerificationStatus.SERVICE_UNAVAILABLE);
      expect(result.reasonCode).toBe('DEMO_PROVIDER_TIMEOUT');
      expect(result.simulationMode).toBe(true);
    });

    it('should return MANUAL_REVIEW for review pattern', async () => {
      const result = await adapter.fetchVerificationResult('demo-txn-review-12345678');
      
      expect(result.status).toBe(VerificationStatus.MANUAL_REVIEW);
      expect(result.reasonCode).toBe('DEMO_UNCLEAR_DOCUMENT');
      expect(result.simulationMode).toBe(true);
    });
  });

  describe('Simulation Mode Labeling (FR-17)', () => {
    it('should always set simulationMode=true', async () => {
      const successResult = await adapter.fetchVerificationResult('success');
      const rejectResult = await adapter.fetchVerificationResult('reject');
      const unavailableResult = await adapter.fetchVerificationResult('unavailable');
      const reviewResult = await adapter.fetchVerificationResult('review');
      
      expect(successResult.simulationMode).toBe(true);
      expect(rejectResult.simulationMode).toBe(true);
      expect(unavailableResult.simulationMode).toBe(true);
      expect(reviewResult.simulationMode).toBe(true);
    });
  });

  describe('Normalized Contract (FR-05)', () => {
    it('should return consistent interface across all outcomes', async () => {
      const results = await Promise.all([
        adapter.fetchVerificationResult('success'),
        adapter.fetchVerificationResult('reject'),
        adapter.fetchVerificationResult('unavailable'),
        adapter.fetchVerificationResult('review'),
      ]);
      
      results.forEach((result) => {
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('subjectReference');
        expect(result).toHaveProperty('subjectReferenceType');
        expect(result).toHaveProperty('simulationMode');
      });
    });
  });
});
