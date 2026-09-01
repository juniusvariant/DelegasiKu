/**
 * Configuration validation with zod (CODING-STANDARDS §7)
 * Fail fast on missing/invalid env vars
 */

import { z } from 'zod';
import { IntegrationMode, DEFAULT_INTEGRATION_MODE } from '@dku/shared';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  VALKEY_URL: z.string().startsWith('redis://'),

  INTEGRATION_MODE: z
    .nativeEnum(IntegrationMode)
    .default(DEFAULT_INTEGRATION_MODE),

  APP_BASE_URL: z.string().url(),
  // Callback service URL for webhooks (must be publicly reachable in production)
  CALLBACK_BASE_URL: z.string().url().optional(),

  // Secrets (never logged; validated for presence)
  ADMIN_SESSION_SECRET: z.string().min(16),
  NIK_HMAC_SECRET: z.string().min(16),

  PROOF_CACHE_TTL_SECONDS: z.coerce.number().default(60),

  // e.id live mode config (optional; validated per mode in adapters)
  EID_VERIFIER_BASE_URL: z.string().url().optional().or(z.literal('')),
  EID_VERIFIER_CLIENT_ID: z.string().optional(),
  EID_VERIFIER_CLIENT_SECRET: z.string().optional(),
  EID_VERIFIER_WEBHOOK_SECRET: z.string().optional(),
  EID_VERIFIER_SCHEMA_ID: z.string().optional(),
  EID_KYC_BASE_URL: z.string().url().optional().or(z.literal('')),
  EID_KYC_CLIENT_ID: z.string().optional(),
  EID_KYC_CLIENT_SECRET: z.string().optional(),
  EID_KYC_HMAC_SECRET: z.string().optional(),
  EID_KYC_WEBHOOK_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Parse and validate environment, fail fast on error
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid configuration:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
