-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStage" AS ENUM ('TARGET', 'QUALIFIED', 'CONTACTED', 'ENGAGED', 'OPPORTUNITY', 'CUSTOMER', 'LOST');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'IN_PROGRESS', 'ENRICHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL_SENT', 'EMAIL_REPLY', 'CALL_ATTEMPT', 'CALL_CONNECTED', 'MEETING', 'NOTE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'EMAIL_FOLLOWUP', 'VERIFY_CONTACT', 'RESEARCH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'SNOOZED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('COMPANY_INTEL', 'CONTACT_EXTRACT', 'DECISION_MAKER_SEARCH', 'EMAIL_VERIFY');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('EMAIL', 'CALL');

-- CreateEnum
CREATE TYPE "OutreachTouchStatus" AS ENUM ('PENDING', 'SENT', 'REPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT,
    "orgType" TEXT,
    "whatTheyMove" TEXT,
    "whyHireCouriers" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "region" TEXT,
    "stage" "AccountStage" NOT NULL DEFAULT 'TARGET',
    "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priorityScore" DOUBLE PRECISION,
    "notes" TEXT,
    "sourceRowJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "source" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "isDoNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "contactId" UUID,
    "type" "ActivityType" NOT NULL,
    "outcome" TEXT,
    "content" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "contactId" UUID,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "jobType" "JobType" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSequence" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachTouch" (
    "id" UUID NOT NULL,
    "sequenceId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "contactId" UUID,
    "stepNumber" INTEGER NOT NULL,
    "status" "OutreachTouchStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachTouch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_companyName_idx" ON "Account"("companyName");

-- CreateIndex
CREATE INDEX "Account_stage_idx" ON "Account"("stage");

-- CreateIndex
CREATE INDEX "Account_enrichmentStatus_idx" ON "Account"("enrichmentStatus");

-- CreateIndex
CREATE INDEX "Account_state_idx" ON "Account"("state");

-- CreateIndex
CREATE INDEX "Account_region_idx" ON "Account"("region");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_lastName_idx" ON "Contact"("lastName");

-- CreateIndex
CREATE INDEX "Contact_isDoNotContact_idx" ON "Contact"("isDoNotContact");

-- CreateIndex
CREATE INDEX "Activity_accountId_idx" ON "Activity"("accountId");

-- CreateIndex
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_occurredAt_idx" ON "Activity"("occurredAt");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "Task_accountId_idx" ON "Task"("accountId");

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

-- CreateIndex
CREATE INDEX "EnrichmentJob_jobType_idx" ON "EnrichmentJob"("jobType");

-- CreateIndex
CREATE INDEX "EnrichmentJob_accountId_idx" ON "EnrichmentJob"("accountId");

-- CreateIndex
CREATE INDEX "OutreachTouch_sequenceId_idx" ON "OutreachTouch"("sequenceId");

-- CreateIndex
CREATE INDEX "OutreachTouch_accountId_idx" ON "OutreachTouch"("accountId");

-- CreateIndex
CREATE INDEX "OutreachTouch_status_idx" ON "OutreachTouch"("status");

-- CreateIndex
CREATE INDEX "OutreachTouch_scheduledAt_idx" ON "OutreachTouch"("scheduledAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
