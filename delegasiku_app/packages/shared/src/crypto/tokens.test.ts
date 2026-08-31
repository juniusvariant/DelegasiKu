/**
 * Tests for token generation utilities
 * Per TOKEN-DESIGN.md §8 validation checklist
 */

import { describe, it, expect } from 'vitest';
import {
  generateInvitationToken,
  generateProofToken,
  hashToken,
  constantTimeCompare,
  generateNikReference,
  verifyNikReference,
} from './tokens.js';

describe('Token Generation', () => {
  it('should generate invitation tokens with correct prefix and length', () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^inv_[A-Za-z0-9_-]{32}$/);
  });

  it('should generate proof tokens with correct prefix and length', () => {
    const token = generateProofToken();
    expect(token).toMatch(/^proof_[A-Za-z0-9_-]{32}$/);
  });

  it('should generate unique tokens on each call', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateInvitationToken());
    }
    expect(tokens.size).toBe(100); // All unique
  });
});

describe('Token Hashing', () => {
  it('should hash tokens to 64-character hex', () => {
    const token = generateInvitationToken();
    const digest = hashToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce consistent hashes for same input', () => {
    const token = 'inv_test123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashToken('inv_test1');
    const hash2 = hashToken('inv_test2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('Constant-Time Comparison', () => {
  it('should return true for identical strings', () => {
    const hash = hashToken('test');
    expect(constantTimeCompare(hash, hash)).toBe(true);
  });

  it('should return false for different strings of same length', () => {
    const hash1 = hashToken('test1');
    const hash2 = hashToken('test2');
    expect(constantTimeCompare(hash1, hash2)).toBe(false);
  });

  it('should return false for strings of different lengths', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });
});

describe('NIK Reference Generation (T4)', () => {
  const testSecret = 'test-secret-key-for-hmac';
  const testNik = '3201234567890123';

  it('should generate consistent references for same NIK and nonce', () => {
    const ref1 = generateNikReference(testNik, testSecret, 'fixed-nonce');
    const ref2 = generateNikReference(testNik, testSecret, 'fixed-nonce');
    expect(ref1.reference).toBe(ref2.reference);
    expect(ref1.nonce).toBe('fixed-nonce');
  });

  it('should generate different references for different NIKs', () => {
    const ref1 = generateNikReference('3201234567890123', testSecret);
    const ref2 = generateNikReference('3201234567890124', testSecret);
    expect(ref1.reference).not.toBe(ref2.reference);
  });

  it('should generate random nonce when not provided', () => {
    const ref1 = generateNikReference(testNik, testSecret);
    const ref2 = generateNikReference(testNik, testSecret);
    expect(ref1.nonce).not.toBe(ref2.nonce);
    expect(ref1.reference).not.toBe(ref2.reference);
  });

  it('should verify NIK reference correctly', () => {
    const { reference, nonce } = generateNikReference(testNik, testSecret);
    expect(verifyNikReference(testNik, reference, nonce, testSecret)).toBe(true);
  });

  it('should reject incorrect NIK', () => {
    const { reference, nonce } = generateNikReference(testNik, testSecret);
    expect(verifyNikReference('9999999999999999', reference, nonce, testSecret)).toBe(false);
  });

  it('should reject wrong secret', () => {
    const { reference, nonce } = generateNikReference(testNik, testSecret);
    expect(verifyNikReference(testNik, reference, nonce, 'wrong-secret')).toBe(false);
  });
});
