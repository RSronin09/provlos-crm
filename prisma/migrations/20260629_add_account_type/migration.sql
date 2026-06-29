-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CUSTOMER', 'VENDOR', 'BANK', 'SUPPLIER', 'PARTNER', 'OTHER');

-- AlterTable: add accountType column with default CUSTOMER (existing rows become CUSTOMER)
ALTER TABLE "Account" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable: add new relationship-type-specific optional fields
ALTER TABLE "Account" ADD COLUMN "paymentTerms" TEXT;
ALTER TABLE "Account" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Account" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Account" ADD COLUMN "creditLimit" DOUBLE PRECISION;
ALTER TABLE "Account" ADD COLUMN "contractStart" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "contractEnd" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Account_accountType_idx" ON "Account"("accountType");
