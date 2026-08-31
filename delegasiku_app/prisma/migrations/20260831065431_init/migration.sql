-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "demo_status" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "case_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representative_identities" (
    "id" TEXT NOT NULL,
    "subject_reference" TEXT NOT NULL,
    "subject_reference_type" TEXT NOT NULL,
    "display_name" TEXT,
    "verification_provider" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "evidence_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "representative_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "representative_identity_id" TEXT,
    "invitation_token_digest" TEXT NOT NULL,
    "public_proof_token_digest" TEXT NOT NULL,
    "allowed_action" TEXT NOT NULL,
    "scope_snapshot" JSONB NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "accepted_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_attempts" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "external_transaction_id" TEXT,
    "status" TEXT NOT NULL,
    "reason_code" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_reference" TEXT,
    "safe_metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_reference_key" ON "cases"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "representative_identities_subject_reference_key" ON "representative_identities"("subject_reference");

-- CreateIndex
CREATE UNIQUE INDEX "delegations_invitation_token_digest_key" ON "delegations"("invitation_token_digest");

-- CreateIndex
CREATE UNIQUE INDEX "delegations_public_proof_token_digest_key" ON "delegations"("public_proof_token_digest");

-- CreateIndex
CREATE INDEX "delegations_organization_id_idx" ON "delegations"("organization_id");

-- CreateIndex
CREATE INDEX "delegations_case_id_idx" ON "delegations"("case_id");

-- CreateIndex
CREATE INDEX "delegations_representative_identity_id_idx" ON "delegations"("representative_identity_id");

-- CreateIndex
CREATE INDEX "delegations_status_idx" ON "delegations"("status");

-- CreateIndex
CREATE INDEX "delegations_invitation_token_digest_idx" ON "delegations"("invitation_token_digest");

-- CreateIndex
CREATE INDEX "delegations_public_proof_token_digest_idx" ON "delegations"("public_proof_token_digest");

-- CreateIndex
CREATE INDEX "verification_attempts_delegation_id_idx" ON "verification_attempts"("delegation_id");

-- CreateIndex
CREATE INDEX "verification_attempts_reference_id_idx" ON "verification_attempts"("reference_id");

-- CreateIndex
CREATE INDEX "audit_events_delegation_id_idx" ON "audit_events"("delegation_id");

-- CreateIndex
CREATE INDEX "audit_events_event_type_idx" ON "audit_events"("event_type");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_representative_identity_id_fkey" FOREIGN KEY ("representative_identity_id") REFERENCES "representative_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
