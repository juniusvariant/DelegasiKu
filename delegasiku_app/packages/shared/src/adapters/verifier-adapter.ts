/**
 * LIVE_VERIFIER adapter (WP-07, ADR-005 §13.2)
 * e.id Verifier API: presentation (VP) request → webhook → fetch VP result → normalize
 *
 * Flow (per docs.e.id/en/verifier):
 *  1. Get Access Token (client_id + client_secret) → Bearer token
 *  2. Create VP Request → QR payload (challenge, qr_token) for holder to scan
 *  3. Holder presents → gateway sends Presentation Webhook (notification only, FR-06)
 *  4. Get VP Result (authoritative server-side fetch) → normalize
 *
 * Data minimization: only the normalized result is returned; raw VP payloads
 * and claims are never persisted (§13.6).
 */

import { VerificationAdapter } from './verification-adapter.js';
import { NormalizedVerificationResult } from '../types/verification.js';
import { VerificationStatus } from '../types/status.js';

export interface VerifierConfig {
  baseUrl: string; // e.g. https://gateway.e.id
  clientId: string;
  clientSecret: string;
  /** Document schema ID (verifier_doc_schema_id) the holder must present */
  verificationSchemaId?: string;
}

/** Real gateway wraps payloads: { code, message, status, data: {...} } */
interface GatewayEnvelope<T> {
  code?: number;
  message?: string;
  status?: boolean;
  data?: T;
}

interface TokenData {
  token: string; // JWT access token
  refresh_token?: string;
  expire?: string; // ISO timestamp
  refresh_expires?: string;
}

/** Real VP request response (wrapped in gateway envelope) */
interface CreateVpRequestData {
  session_id: string;
  eid_oauth_url?: string;
  expires_at?: string;
  status?: string;
  qr_data?: {
    challenge?: string;
    qr_token?: string;
    schema_id?: string;
    event_type?: string;
  };
}

/** Real VP Session (simple) response — status always available (poll-friendly) */
interface VpSessionSimpleData {
  session_id: string;
  event_type?: string;
  status?: string; // "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
  reject_reason?: string | null;
  expires_at?: string;
  presentation_ttl?: number;
}

/** Real VP Result response — claims only available when APPROVED + within TTL */
interface VpResultData {
  claims?: Record<string, unknown>;
  presentation?: { claims?: Record<string, unknown> };
  subject?: string;
  holder?: string;
  holder_did?: string;
  verified_at?: string;
}

export class LiveVerifierAdapter implements VerificationAdapter {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: VerifierConfig) {}

  getMode(): 'LIVE_VERIFIER' {
    return 'LIVE_VERIFIER';
  }

  async healthCheck(): Promise<{ healthy: boolean; mode: string; message?: string }> {
    try {
      await this.getAccessToken();
      return { healthy: true, mode: 'LIVE_VERIFIER', message: 'Verifier API reachable' };
    } catch (err) {
      return {
        healthy: false,
        mode: 'LIVE_VERIFIER',
        message: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }

  /**
   * Create a VP request for the holder to scan (FR-05)
   * Returns QR payload + references for the callback/worker to correlate
   */
  async startVerification(
    delegationId: string,
    callbackUrl: string
  ): Promise<{
    referenceId: string;
    externalTransactionId: string;
    verificationUrl?: string;
    qrCodeData?: string;
  }> {
    const token = await this.getAccessToken();

    // Real API: verifier_doc_schema_id (document schema) + expires_in (minutes)
    const body: Record<string, unknown> = {
      verifier_doc_schema_id: this.config.verificationSchemaId,
      expires_in: 15,
      callback_url: callbackUrl,
      // Correlate back to our delegation (opaque to provider)
      external_reference: delegationId,
    };

    const res = await this.fetchJson<GatewayEnvelope<CreateVpRequestData>>(
      `${this.config.baseUrl}/api/v1/verifier/presentation/request`,
      {
        method: 'POST',
        headers: this.authHeaders(token),
        body: JSON.stringify(body),
      }
    );

    const sessionId = res.data?.session_id;
    if (!sessionId) {
      throw new Error(`Verifier API did not return a session_id: ${res.message ?? ''}`);
    }

    return {
      referenceId: `verifier-${delegationId.slice(0, 8)}`,
      externalTransactionId: sessionId,
      verificationUrl: res.data?.eid_oauth_url,
      qrCodeData: res.data?.qr_data?.qr_token ?? res.data?.qr_data?.challenge,
    };
  }

  /**
   * Authoritative fetch of the VP result (FR-06)
   * Called by the worker after the webhook notification; never trust the webhook body.
   *
   * Two-endpoint reality (observed against the live gateway):
   *  - /presentation/simple/:id  → status always available (PENDING/APPROVED/REJECTED/EXPIRED)
   *  - /presentation/result/:id  → claims, only when APPROVED + within presentation TTL
   * We read status from `simple`, then claims from `result` only when APPROVED.
   */
  async fetchVerificationResult(externalTransactionId: string): Promise<NormalizedVerificationResult> {
    const token = await this.getAccessToken();

    // 1. Authoritative status from the session (simple endpoint)
    const session = await this.fetchJson<GatewayEnvelope<VpSessionSimpleData>>(
      `${this.config.baseUrl}/api/v1/verifier/presentation/simple/${encodeURIComponent(externalTransactionId)}`,
      { method: 'GET', headers: this.authHeaders(token) }
    );

    const rawStatus = (session.data?.status ?? 'PENDING').toUpperCase();
    const rejectReason = session.data?.reject_reason ?? undefined;

    // 2. Claims only when APPROVED (result endpoint 400s otherwise)
    let claims: Record<string, unknown> | undefined;
    let subject: string | undefined;
    let holderDid: string | undefined;
    let verifiedAt: Date | undefined;

    if (rawStatus === 'APPROVED') {
      try {
        const result = await this.fetchJson<GatewayEnvelope<VpResultData>>(
          `${this.config.baseUrl}/api/v1/verifier/presentation/result/${encodeURIComponent(externalTransactionId)}`,
          { method: 'GET', headers: this.authHeaders(token) }
        );
        const data = result.data;
        claims = data?.claims ?? data?.presentation?.claims;
        subject = data?.subject;
        holderDid = data?.holder_did ?? data?.holder;
        verifiedAt = data?.verified_at ? new Date(data.verified_at) : new Date();
      } catch {
        // Result TTL expired or unavailable — still VERIFIED by status, claims absent
        verifiedAt = new Date();
      }
    }

    return this.normalize(externalTransactionId, rawStatus, rejectReason, {
      claims,
      subject,
      holderDid,
      verifiedAt,
    });
  }

  // -------------------------------------------------------------------------

  /** Normalize provider payload → shared contract (FR-05) */
  private normalize(
    externalTransactionId: string,
    rawStatus: string,
    rejectReason: string | undefined,
    presented: {
      claims?: Record<string, unknown>;
      subject?: string;
      holderDid?: string;
      verifiedAt?: Date;
    }
  ): NormalizedVerificationResult {
    // Full VP session lifecycle: PENDING | WAITING_APPROVAL | SCANNED |
    // APPROVED | REJECTED | EXPIRED | CANCELED
    let status: VerificationStatus;
    switch (rawStatus) {
      case 'APPROVED':
        status = VerificationStatus.VERIFIED;
        break;
      case 'REJECTED':
        status = VerificationStatus.REJECTED;
        break;
      case 'EXPIRED':
      case 'CANCELED':
        // Terminal failure without presentation → fail closed
        status = VerificationStatus.SERVICE_UNAVAILABLE;
        break;
      case 'PENDING':
      case 'WAITING_APPROVAL':
      case 'SCANNED':
      default:
        // Awaiting holder action → still pending
        status = VerificationStatus.PENDING;
    }

    // Subject reference: prefer holder DID; never raw NIK (FR-07)
    const subjectReference =
      presented.holderDid ?? presented.subject ?? `verifier-${externalTransactionId.slice(-8)}`;

    // Display name from presented claims only (representative consented)
    const claims = presented.claims ?? {};
    const displayName =
      typeof claims.fullname === 'string'
        ? claims.fullname
        : typeof claims.full_name === 'string'
          ? claims.full_name
          : typeof claims.name === 'string'
            ? claims.name
            : undefined;

    return {
      status,
      subjectReference,
      subjectReferenceType: presented.holderDid ? 'did' : 'provider_ref',
      displayName,
      verifiedAt: presented.verifiedAt,
      evidenceExpiresAt: null,
      reasonCode: rejectReason,
      simulationMode: false, // LIVE — never labeled simulation
    };
  }

  /** OAuth client-credentials token with in-memory cache */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 10_000) {
      return this.accessToken;
    }

    const res = await this.fetchJson<GatewayEnvelope<TokenData>>(
      `${this.config.baseUrl}/api/v1/auth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
        }),
      }
    );

    const token = res.data?.token;
    if (!token) {
      throw new Error(`Verifier API auth failed: ${res.message ?? 'no token returned'}`);
    }

    this.accessToken = token;
    // Prefer provider expire timestamp; fallback to 1h
    this.tokenExpiresAt = res.data?.expire
      ? new Date(res.data.expire).getTime()
      : now + 3600_000;
    return this.accessToken;
  }

  private authHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  /** fetch wrapper with timeout + error mapping (fail-closed, §12.3) */
  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : ({} as T);

      if (!res.ok) {
        throw new Error(`Verifier API ${res.status}: ${text.slice(0, 200)}`);
      }
      return data;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Verifier API request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Factory (WP-07) */
export function createLiveVerifierAdapter(config: VerifierConfig): LiveVerifierAdapter {
  return new LiveVerifierAdapter(config);
}
