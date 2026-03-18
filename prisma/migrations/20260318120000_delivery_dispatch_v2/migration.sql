-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('delayed', 'customer_unavailable', 'pickup_problem', 'address_issue', 'vehicle_problem', 'other');

-- AlterTable: add new fields to Delivery
ALTER TABLE "Delivery"
  ADD COLUMN "dispatcherNotes" TEXT,
  ADD COLUMN "assignedAt"      TIMESTAMP(3),
  ADD COLUMN "pickedUpAt"      TIMESTAMP(3),
  ADD COLUMN "deliveredAt"     TIMESTAMP(3),
  ADD COLUMN "cancelledAt"     TIMESTAMP(3),
  ADD COLUMN "pickupLat"       DOUBLE PRECISION,
  ADD COLUMN "pickupLng"       DOUBLE PRECISION,
  ADD COLUMN "deliveryLat"     DOUBLE PRECISION,
  ADD COLUMN "deliveryLng"     DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Delivery_deliveredAt_idx" ON "Delivery"("deliveredAt");

-- CreateTable
CREATE TABLE "DeliveryIssue" (
    "id"          UUID NOT NULL,
    "deliveryId"  UUID NOT NULL,
    "reportedBy"  TEXT NOT NULL,
    "issueType"   "IssueType" NOT NULL,
    "note"        TEXT,
    "status"      "IssueStatus" NOT NULL DEFAULT 'open',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"  TIMESTAMP(3),
    "resolvedBy"  TEXT,
    "resolveNote" TEXT,

    CONSTRAINT "DeliveryIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryIssue_deliveryId_idx" ON "DeliveryIssue"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryIssue_status_idx" ON "DeliveryIssue"("status");

-- CreateIndex
CREATE INDEX "DeliveryIssue_createdAt_idx" ON "DeliveryIssue"("createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryIssue" ADD CONSTRAINT "DeliveryIssue_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
