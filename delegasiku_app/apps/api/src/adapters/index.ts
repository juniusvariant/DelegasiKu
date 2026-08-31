/**
 * Verification adapter factory (ADR-005, §12.6)
 * Config-driven selection; unknown mode fails fast at startup
 */

import {
  createDemoAdapter,
  createLiveVerifierAdapter,
  IntegrationMode,
  type VerificationAdapter,
} from '@dku/shared';
import type { Config } from '../config/index.js';

export function createVerificationAdapter(config: Config): VerificationAdapter {
  switch (config.INTEGRATION_MODE) {
    case IntegrationMode.DEMO:
      return createDemoAdapter();

    case IntegrationMode.LIVE_VERIFIER: {
      // §13.1 startup validation: fail fast if credentials missing
      if (!config.EID_VERIFIER_BASE_URL || !config.EID_VERIFIER_CLIENT_ID || !config.EID_VERIFIER_CLIENT_SECRET) {
        throw new Error(
          'INTEGRATION_MODE=LIVE_VERIFIER requires EID_VERIFIER_BASE_URL, ' +
            'EID_VERIFIER_CLIENT_ID, and EID_VERIFIER_CLIENT_SECRET.'
        );
      }
      return createLiveVerifierAdapter({
        baseUrl: config.EID_VERIFIER_BASE_URL,
        clientId: config.EID_VERIFIER_CLIENT_ID,
        clientSecret: config.EID_VERIFIER_CLIENT_SECRET,
        verificationSchemaId: config.EID_VERIFIER_SCHEMA_ID,
      });
    }

    case IntegrationMode.LIVE_KYC:
      // Conditional path (§13.3); not built for MVP per ADR-005
      throw new Error(
        'INTEGRATION_MODE=LIVE_KYC is not implemented in this MVP. ' +
          'Use LIVE_VERIFIER (preferred) or DEMO.'
      );

    default:
      throw new Error(`Unknown INTEGRATION_MODE: ${String(config.INTEGRATION_MODE)}`);
  }
}
