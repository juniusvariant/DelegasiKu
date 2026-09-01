/**
 * API client — all backend calls go through here (BFF pattern)
 * Base URL from env; never expose secrets to the browser (AC-15)
 */

import { env } from '$env/dynamic/public';

export const API_BASE = env.PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Only send Content-Type when there is a body — Fastify rejects an empty
  // body that declares application/json (FST_ERR_CTP_EMPTY_JSON_BODY).
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } }).error;
    throw new ApiError(err?.message ?? 'Request failed', err?.code ?? 'ERROR', res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
  }
}

// ---- Types (subset matching api responses) ----

export interface Organization {
  id: string;
  name: string;
  demoStatus: string;
  status: string;
}

export interface Case {
  id: string;
  reference: string;
  title: string;
  status: string;
}

export interface Delegation {
  id: string;
  organizationId: string;
  caseId: string;
  allowedAction: string;
  status: string;
  validFrom: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface AuditEvent {
  eventType: string;
  actorType: string;
  createdAt: string;
}

export interface ProofResult {
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'NOT_VALID';
  organizationName?: string;
  allowedAction?: string;
  validFrom?: string;
  expiresAt?: string;
  representativeDisplayName?: string | null;
  caseReference?: string;
  simulationMode?: boolean;
}

// ---- API calls ----

export const api = {
  getOrganization: () => request<{ organization: Organization }>('/api/organizations/current'),
  getCases: () => request<{ cases: Case[] }>('/api/cases'),
  getDiagnostics: () =>
    request<{ integrationMode: string; demoLabel: string | null }>('/api/diagnostics'),

  listDelegations: (organizationId: string) =>
    request<{ delegations: Delegation[] }>(`/api/delegations?organizationId=${organizationId}`),

  createDelegation: (input: {
    organizationId: string;
    caseId: string;
    allowedAction: string;
    validFrom: string;
    expiresAt: string;
  }) =>
    request<{ delegation: Delegation; invitationUrl: string }>('/api/delegations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getDelegation: (id: string) =>
    request<{ delegation: Delegation; auditEvents: AuditEvent[] }>(`/api/delegations/${id}`),

  revokeDelegation: (id: string, reason?: string) =>
    request<{ delegation: Delegation }>(`/api/delegations/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  resolveInvitation: (token: string) =>
    request<{
      delegationId: string;
      scopeSnapshot: { allowedAction: string; validFrom: string; expiresAt: string };
      expiresAt: string;
    }>(`/api/invitations/${token}`),

  recordConsent: (token: string) =>
    request<{ consentRecorded: boolean }>(`/api/invitations/${token}/consent`, { method: 'POST' }),

  startVerification: (token: string) =>
    request<{ simulationMode: boolean; verificationUrl?: string }>(
      `/api/invitations/${token}/verify`,
      { method: 'POST' }
    ),

  acceptDelegation: (token: string) =>
    request<{ delegation: Delegation; simulationMode: boolean }>(
      `/api/invitations/${token}/accept`,
      { method: 'POST' }
    ),

  checkInvitationStatus: (token: string) =>
    request<{ status: string; canAccept: boolean; isPending: boolean; isFailed: boolean }>(
      `/api/invitations/${token}/status`
    ),

  resolveProof: (token: string) => request<ProofResult>(`/api/proofs/${token}`),
};
