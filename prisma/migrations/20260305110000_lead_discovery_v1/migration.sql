-- CreateEnum
CREATE TYPE "LeadDiscoveryJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadCandidateStatus" AS ENUM ('NEW', 'REVIEWED', 'PROMOTED', 'REJECTED');

-- CreateTable
CREATE TABLE "LeadDiscoveryJob" (
    "id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "region" TEXT,
    "state" TEXT,
    "status" "LeadDiscoveryJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadDiscoveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCandidate" (
    "id" UUID NOT NULL,
    "discoveryJobId" UUID NOT NULL,
    "accountId" UUID,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "state" TEXT,
    "region" TEXT,
    "signalType" TEXT,
    "signalSummary" TEXT,
    "sourceUrl" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION,
    "dedupeKey" TEXT,
    "status" "LeadCandidateStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDiscoveryJob_status_idx" ON "LeadDiscoveryJob"("status");

-- CreateIndex
CREATE INDEX "LeadDiscoveryJob_createdAt_idx" ON "LeadDiscoveryJob"("createdAt");

-- CreateIndex
CREATE INDEX "LeadCandidate_status_idx" ON "LeadCandidate"("status");

-- CreateIndex
CREATE INDEX "LeadCandidate_companyName_idx" ON "LeadCandidate"("companyName");

-- CreateIndex
CREATE INDEX "LeadCandidate_state_idx" ON "LeadCandidate"("state");

-- CreateIndex
CREATE INDEX "LeadCandidate_region_idx" ON "LeadCandidate"("region");

-- CreateIndex
CREATE INDEX "LeadCandidate_accountId_idx" ON "LeadCandidate"("accountId");

-- CreateIndex
CREATE INDEX "LeadCandidate_discoveryJobId_idx" ON "LeadCandidate"("discoveryJobId");

-- CreateIndex
CREATE INDEX "LeadCandidate_dedupeKey_idx" ON "LeadCandidate"("dedupeKey");

-- AddForeignKey
ALTER TABLE "LeadCandidate" ADD CONSTRAINT "LeadCandidate_discoveryJobId_fkey" FOREIGN KEY ("discoveryJobId") REFERENCES "LeadDiscoveryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCandidate" ADD CONSTRAINT "LeadCandidate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
