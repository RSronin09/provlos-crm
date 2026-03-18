-- AlterTable: add stopOrder to Delivery
ALTER TABLE "Delivery" ADD COLUMN "stopOrder" INTEGER;

-- CreateIndex
CREATE INDEX "Delivery_stopOrder_idx" ON "Delivery"("stopOrder");

-- CreateTable: DriverLocation (one row per driver - latest location)
CREATE TABLE "DriverLocation" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverLocation_driverId_key" ON "DriverLocation"("driverId");

-- CreateIndex
CREATE INDEX "DriverLocation_driverId_idx" ON "DriverLocation"("driverId");

-- CreateIndex
CREATE INDEX "DriverLocation_capturedAt_idx" ON "DriverLocation"("capturedAt");

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
