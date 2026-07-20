-- CreateEnum
CREATE TYPE "QcSampleType" AS ENUM ('FINISHED_PRODUCT', 'STABILITY', 'RETENTION', 'INVESTIGATION', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "QcSampleStatus" AS ENUM ('WAITING_COLLECTION', 'COLLECTED', 'WAITING_LAB', 'IN_LABORATORY', 'TESTING', 'WAITING_RESULTS', 'APPROVED', 'REJECTED', 'RETENTION', 'EXPIRED', 'DISPOSED');

-- CreateTable
CREATE TABLE "QcSample" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "sampleId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "batchRecordId" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "sampleType" "QcSampleType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "collectedByName" TEXT,
    "collectionDate" TIMESTAMP(3),
    "collectionTime" TEXT,
    "bayId" TEXT,
    "warehouseLocationId" TEXT,
    "storageTemperature" TEXT,
    "storageCondition" TEXT,
    "sentToLab" BOOLEAN NOT NULL DEFAULT false,
    "sentDate" TIMESTAMP(3),
    "courierOrInternal" TEXT,
    "receivedByQcName" TEXT,
    "receivedDate" TIMESTAMP(3),
    "status" "QcSampleStatus" NOT NULL DEFAULT 'WAITING_COLLECTION',
    "remarks" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcLabTest" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "appearance" TEXT,
    "weightCheck" TEXT,
    "moisture" TEXT,
    "hardness" TEXT,
    "disintegration" TEXT,
    "microbiology" TEXT,
    "heavyMetals" TEXT,
    "activeIngredients" TEXT,
    "packagingInspection" TEXT,
    "labelInspection" TEXT,
    "photographUrls" TEXT,
    "coaReference" TEXT,
    "qcNotes" TEXT,
    "testedByName" TEXT,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcLabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcRetentionRecord" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "shelf" TEXT,
    "cabinet" TEXT,
    "boxNumber" TEXT,
    "position" TEXT,
    "quantityRemaining" DOUBLE PRECISION,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "lastChecked" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "destroyDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcRetentionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QcSample_sequence_key" ON "QcSample"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "QcSample_sampleId_key" ON "QcSample"("sampleId");

-- CreateIndex
CREATE INDEX "QcSample_batchNumber_idx" ON "QcSample"("batchNumber");

-- CreateIndex
CREATE INDEX "QcSample_status_idx" ON "QcSample"("status");

-- CreateIndex
CREATE INDEX "QcSample_sampleType_idx" ON "QcSample"("sampleType");

-- CreateIndex
CREATE INDEX "QcSample_bayId_idx" ON "QcSample"("bayId");

-- CreateIndex
CREATE INDEX "QcSample_warehouseLocationId_idx" ON "QcSample"("warehouseLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "QcLabTest_sampleId_key" ON "QcLabTest"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "QcRetentionRecord_sampleId_key" ON "QcRetentionRecord"("sampleId");

-- CreateIndex
CREATE INDEX "QcRetentionRecord_expiryDate_idx" ON "QcRetentionRecord"("expiryDate");

-- AddForeignKey
ALTER TABLE "QcSample" ADD CONSTRAINT "QcSample_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcSample" ADD CONSTRAINT "QcSample_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "DryingBay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcSample" ADD CONSTRAINT "QcSample_warehouseLocationId_fkey" FOREIGN KEY ("warehouseLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcLabTest" ADD CONSTRAINT "QcLabTest_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "QcSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcRetentionRecord" ADD CONSTRAINT "QcRetentionRecord_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "QcSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

