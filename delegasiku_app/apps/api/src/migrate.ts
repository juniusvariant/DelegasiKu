/**
 * Migration + idempotent seed boot script (WP-09)
 * Runs in the `migrate` compose service: `node dist/migrate.js`
 * 1. prisma migrate deploy (schema at ../../prisma from apps/api)
 * 2. Idempotent upsert seed (safe on every boot, §12.6 / FR-01)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function findSchema(): string {
  const candidates = ['../../prisma/schema.prisma', '/app/prisma/schema.prisma', 'prisma/schema.prisma'];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error('schema.prisma not found');
}

function migrateDeploy(): void {
  const schema = findSchema();
  const prismaCli = './node_modules/prisma/build/index.js';
  console.log(`▶ prisma migrate deploy --schema=${schema}`);
  execSync(`node ${prismaCli} migrate deploy --schema=${schema}`, {
    stdio: 'inherit',
    env: process.env,
  });
}

const DEMO_ORG_ID = '550e8400-e29b-41d4-a716-446655440001';
const DEMO_CASE_ID = '550e8400-e29b-41d4-a716-446655440002';

async function seed(): Promise<void> {
  // Idempotent upserts — safe on every boot (unlike dev seed which wipes)
  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    create: {
      id: DEMO_ORG_ID,
      name: 'PT Maju Jakarta',
      demoStatus: 'demo', // labeled demo per FR-01
      status: 'enabled',
    },
    update: {}, // keep existing; never clobber live demo state
  });

  await prisma.case.upsert({
    where: { id: DEMO_CASE_ID },
    create: {
      id: DEMO_CASE_ID,
      organizationId: DEMO_ORG_ID,
      reference: 'PMT-JKS-2026-001',
      caseType: 'permit',
      title: 'Izin Mendirikan Bangunan - Gedung Kantor 5 Lantai',
      description:
        'Permohonan izin mendirikan bangunan gedung kantor berlantai 5 di Jakarta Selatan',
      status: 'active',
    },
    update: {},
  });

  console.log('✅ Seed verified (org PT Maju Jakarta + case PMT-JKS-2026-001)');
}

async function main(): Promise<void> {
  console.log('🚀 Running migrations...');
  migrateDeploy();
  console.log('✅ Migrations applied');
  await seed();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🎉 Migration + seed complete');
  })
  .catch(async (e) => {
    console.error('❌ Migration failed:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
