/**
 * Integration modes (ADR-005, §13.1)
 */
export enum IntegrationMode {
  DEMO = 'DEMO',
  LIVE_VERIFIER = 'LIVE_VERIFIER',
  LIVE_KYC = 'LIVE_KYC',
}

/**
 * Default integration mode if not specified
 */
export const DEFAULT_INTEGRATION_MODE = IntegrationMode.DEMO;
