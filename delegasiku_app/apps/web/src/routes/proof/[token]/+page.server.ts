/**
 * Public proof page — SSR (§12.4: render < 2s)
 * Read-time status from api; never cached incorrectly (ADR-004)
 */

import type { PageServerLoad } from './$types';
import { API_BASE, type ProofResult } from '$lib/api';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const res = await fetch(`${API_BASE}/api/proofs/${params.token}`);
  const proof = (await res.json()) as ProofResult;
  return { proof, token: params.token };
};

// Always SSR fresh — read-time status must not be stale (ADR-004/FR-13)
export const ssr = true;
export const csr = true;
