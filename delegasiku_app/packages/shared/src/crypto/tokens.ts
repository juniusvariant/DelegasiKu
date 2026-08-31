/**
 * Token generation utilities for DelegasiKu
 * Per TOKEN-DESIGN.md and BUILD-SPEC WP-02
 * 
 * Token Types:
 * - T1: Single-use invitation token (192-bit entropy)
 * - T2: Stable public proof token (192-bit entropy)
 * - T3: KYC request HMAC signature
 * - T4: NIK keyed-HMAC reference (for identity deduplication)
 */

import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// TOKEN GENERATION (T1, T2)
// ============================================================================

/**
 * Generate a cryptographically secure random token
 * Uses 192 bits of entropy, URL-safe base64 encoding
 * 
 * @param prefix - Optional prefix (e.g., "inv_", "proof_")
 * @returns URL-safe base64 string (32 characters + prefix)
 */
export function generateToken(prefix = ''): string {
  // 192 bits = 24 bytes → 32 base64 characters
  const buffer = randomBytes(24);
  const base64 = buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return prefix + base64;
}

/**
 * Generate T1: Single-use invitation token
 * Format: "inv_" + 192-bit random
 */
export function generateInvitationToken(): string {
  return generateToken('inv_');
}

/**
 * Generate T2: Stable public proof token
 * Format: "proof_" + 192-bit random
 */
export function generateProofToken(): string {
  return generateToken('proof_');
}

// ============================================================================
// TOKEN DIGESTS (SHA-256)
// ============================================================================

/**
 * Compute SHA-256 digest of a token for database storage
 * Tokens are NEVER stored raw, only as digests
 * 
 * @param token - The token to hash
 * @returns Hex-encoded SHA-256 digest (64 characters)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

// ============================================================================
// CONSTANT-TIME COMPARISON
// ============================================================================

/**
 * Constant-time string comparison to prevent timing attacks
 * Used for comparing token digests during lookup
 * 
 * @param a - First string (must be hex)
 * @param b - Second string (must be hex)
 * @returns true if equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  
  return timingSafeEqual(bufA, bufB);
}

// ============================================================================
// NIK HMAC REFERENCE (T4)
// ============================================================================

/**
 * Generate T4: Keyed-HMAC reference for NIK (identity deduplication)
 * Allows finding existing identities without storing raw NIK
 * 
 * Format: HMAC-SHA256(secret, "nik" || NIK || nonce)
 * The nonce ensures uniqueness even for same NIK across delegations
 * 
 * @param nik - The NIK to reference (16 digits)
 * @param secret - HMAC secret from NIK_HMAC_SECRET env var
 * @param nonce - Optional nonce for uniqueness (default: random 16 bytes)
 * @returns Object with reference and nonce
 */
export function generateNikReference(
  nik: string,
  secret: string,
  nonce?: string
): { reference: string; nonce: string } {
  // Generate or use provided nonce
  const nonceValue = nonce || randomBytes(16).toString('hex');
  
  // Canonical string: "nik" prefix + NIK + nonce
  const canonical = `nik${nik}${nonceValue}`;
  
  // HMAC-SHA256
  const hmac = createHmac('sha256', secret);
  const reference = hmac.update(canonical, 'utf8').digest('hex');
  
  return {
    reference,
    nonce: nonceValue,
  };
}

/**
 * Verify a NIK reference matches the given NIK
 * 
 * @param nik - The NIK to verify
 * @param reference - The stored HMAC reference
 * @param nonce - The nonce used during generation
 * @param secret - HMAC secret from NIK_HMAC_SECRET env var
 * @returns true if NIK matches the reference
 */
export function verifyNikReference(
  nik: string,
  reference: string,
  nonce: string,
  secret: string
): boolean {
  const computed = generateNikReference(nik, secret, nonce);
  return constantTimeCompare(computed.reference, reference);
}
