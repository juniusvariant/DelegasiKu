// Seed script for DelegasiKu demo data
// Creates demo organization "PT Maju Jakarta" and case "PMT-JKS-2026-001"
// Per WP-01 and BUILD-SPEC.md

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with demo data...');

  // Clear existing data (idempotent seed)
  console.log('  Clearing existing data...');
  await prisma.auditEvent.deleteMany();
  await prisma.verificationAttempt.deleteMany();
  await prisma.delegation.deleteMany();
  await prisma.representativeIdentity.deleteMany();
  await prisma.case.deleteMany();
  await prisma.organization.deleteMany();

  // Create demo organization
  console.log('  Creating demo organization: PT Maju Jakarta');
  const organization = await prisma.organization.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'PT Maju Jakarta',
      demoStatus: 'demo', // Labeled as demo per FR-01
      status: 'enabled',
    },
  });

  // Create demo case
  console.log('  Creating demo case: PMT-JKS-2026-001');
  const demoCase = await prisma.case.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      organizationId: organization.id,
      reference: 'PMT-JKS-2026-001',
      caseType: 'permit',
      title: 'Izin Mendirikan Bangunan - Gedung Kantor 5 Lantai',
      description: 'Permohonan izin mendirikan bangunan gedung kantor berlantai 5 di Jakarta Selatan',
      status: 'active',
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`   Organization ID: ${organization.id}`);
  console.log(`   Case ID: ${demoCase.id}`);
  console.log(`   Case Reference: ${demoCase.reference}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
