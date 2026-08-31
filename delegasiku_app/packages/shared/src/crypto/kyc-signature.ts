/**
 * KYC request signature utility (T3)
 * Per TOKEN-DESIGN.md §5 and PRD §13.4
 * 
 * Implements HMAC-SHA256 signing for e.id KYC Gateway requests
 * Used only in LIVE_KYC integration mode
 */

import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * Generate a unique nonce for request signing
 * Returns a UUID v4 string
 */
export function generateNonce(): string {
  // Use crypto.randomBytes to generate UUID v4
  const bytes = randomBytes(16);
  
  // Set version (4) and variant bits per RFC 4122
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  // Format as UUID string
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Compute SHA-256 hash of request body
 * 
 * @param body - Request body (string or object)
 * @returns Lowercase hex SHA-256 digest
 */
export function hashRequestBody(body: string | object): string {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  return createHash('sha256').update(bodyString, 'utf8').digest('hex');
}

/**
 * Build canonical string for KYC request signing
 * Per TOKEN-DESIGN.md §5 format
 * 
 * @param method - HTTP method (uppercase)
 * @param path - Request path (with leading slash)
 * @param timestamp - Unix epoch seconds
 * @param nonce - Unique nonce for this request
 * @param bodyHash - SHA-256 hex of request body
 * @returns Canonical string (5 newline-separated lines)
 */
export function buildCanonicalString(
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  bodyHash: string
): string {
  return [
    method.toUpperCase(),
    path,
    timestamp.toString(),
    nonce,
    bodyHash,
  ].join('\n');
}

/**
 * Sign a KYC request using HMAC-SHA256
 * 
 * @param canonical - Canonical string (from buildCanonicalString)
 * @param apiSecret - Base64-encoded API secret
 * @returns Lowercase hex HMAC-SHA256 signature
 */
export function signRequest(canonical: string, apiSecret: string): string {
  // Decode base64 secret
  const secretBuffer = Buffer.from(apiSecret, 'base64');
  
  // HMAC-SHA256
  const hmac = createHmac('sha256', secretBuffer);
  return hmac.update(canonical, 'utf8').digest('hex');
}

/**
 * Complete KYC request signing workflow
 * Generates nonce, builds canonical string, and signs
 * 
 * @param method - HTTP method
 * @param path - Request path
 * @param body - Request body
 * @param apiSecret - Base64-encoded API secret
 * @returns Object with headers to include in request
 */
export function signKycRequest(
  method: string,
  path: string,
  body: string | object,
  apiSecret: string,
  clientId: string
): {
  'X-Client-Id': string;
  'X-Timestamp': string;
  'X-Nonce': string;
  'X-Signature': string;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const bodyHash = hashRequestBody(body);
  const canonical = buildCanonicalString(method, path, timestamp, nonce, bodyHash);
  const signature = signRequest(canonical, apiSecret);
  
  return {
    'X-Client-Id': clientId,
    'X-Timestamp': timestamp.toString(),
    'X-Nonce': nonce,
    'X-Signature': signature,
  };
}
