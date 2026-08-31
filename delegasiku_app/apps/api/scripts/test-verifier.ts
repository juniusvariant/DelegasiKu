/**
 * Standalone live Verifier API connectivity test (WP-07)
 * Run: pnpm exec tsx scripts/test-verifier.ts
 * Uses env vars; never logs secrets.
 */

import { createLiveVerifierAdapter } from '@dku/shared';

async function main() {
  const baseUrl = process.env.EID_VERIFIER_BASE_URL ?? 'https://gateway.e.id';
  const clientId = process.env.EID_VERIFIER_CLIENT_ID ?? '';
  const clientSecret = process.env.EID_VERIFIER_CLIENT_SECRET ?? '';

  if (!clientId || !clientSecret) {
    console.error('❌ Missing EID_VERIFIER_CLIENT_ID / EID_VERIFIER_CLIENT_SECRET');
    process.exit(1);
  }

  console.log(`Testing LIVE_VERIFIER against ${baseUrl} ...`);
  const adapter = createLiveVerifierAdapter({ baseUrl, clientId, clientSecret });

  // 1. Health check (auth token)
  const health = await adapter.healthCheck();
  console.log('HEALTH:', JSON.stringify(health));

  if (!health.healthy) {
    console.error('❌ Health check failed');
    process.exit(1);
  }
  console.log('✅ Auth token acquired — Verifier API reachable');

  // 2. Create a VP request (start verification)
  try {
    const session = await adapter.startVerification(
      'test-delegation-0000',
      'http://localhost:3002/api/callbacks/eid/presentation'
    );
    console.log('✅ VP request created:');
    console.log('   referenceId:', session.referenceId);
    console.log('   externalTransactionId:', session.externalTransactionId);
    console.log('   verificationUrl:', session.verificationUrl ?? '(none)');
    console.log('   qrCodeData:', session.qrCodeData ? '(present)' : '(none)');
  } catch (err) {
    console.warn('⚠ VP request creation failed (may need verification_schema_id):');
    console.warn('  ', err instanceof Error ? err.message : err);
  }

  console.log('\n✅ LIVE_VERIFIER adapter is wired and reachable.');
}

main().catch((err) => {
  console.error('❌ Test failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
