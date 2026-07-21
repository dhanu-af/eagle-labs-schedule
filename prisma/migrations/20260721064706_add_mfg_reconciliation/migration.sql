-- CreateEnum
CREATE TYPE "MfgBatchStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MfgMaterialGroup" AS ENUM ('RAW_INGREDIENT', 'RAW_ACTIVE_INGREDIENT', 'RAW_EXCIPIENT', 'PACKAGING_EMPTY_CAPSULE', 'PACKAGING_EMPTY_BOTTLE', 'PACKAGING_CAP', 'PACKAGING_DESICCANT', 'PACKAGING_LABEL', 'PACKAGING_CARTON', 'PACKAGING_INSERT', 'PACKAGING_SHRINK_WRAP', 'PACKAGING_SHIPPER', 'PACKAGING_PALLET');

-- CreateEnum
CREATE TYPE "MfgPackagingMaterialType" AS ENUM ('LABEL', 'CARTON', 'INSERT', 'SHRINK_WRAP', 'SHIPPER');

-- CreateTable
CREATE TABLE "MfgBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "batchRecordId" TEXT,
    "status" "MfgBatchStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "remarks" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgWarehouseIssue" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "issuedByName" TEXT,
    "issueDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgWarehouseIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgMaterialIssueLine" (
    "id" TEXT NOT NULL,
    "warehouseIssueId" TEXT NOT NULL,
    "materialGroup" "MfgMaterialGroup" NOT NULL,
    "materialCode" TEXT,
    "description" TEXT NOT NULL,
    "supplier" TEXT,
    "lotBatchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantityRequested" DOUBLE PRECISION,
    "quantityIssued" DOUBLE PRECISION,
    "quantityReturned" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MfgMaterialIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgBlending" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "totalTheoreticalWeightKg" DOUBLE PRECISION,
    "actualWeightKg" DOUBLE PRECISION,
    "blendBatchNumber" TEXT,
    "powderRemainingKg" DOUBLE PRECISION,
    "blenderResidueKg" DOUBLE PRECISION,
    "sieveLossKg" DOUBLE PRECISION,
    "dustLossKg" DOUBLE PRECISION,
    "spillagesKg" DOUBLE PRECISION,
    "qcSamplesQty" DOUBLE PRECISION,
    "retentionSamplesQty" DOUBLE PRECISION,
    "destroyedMaterialKg" DOUBLE PRECISION,
    "returnedToWarehouseKg" DOUBLE PRECISION,
    "totalBlendProducedKg" DOUBLE PRECISION,
    "blendedByName" TEXT,
    "blendedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgBlending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgEncapsulation" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "blendReceivedKg" DOUBLE PRECISION,
    "blendUsedKg" DOUBLE PRECISION,
    "blendRemainingKg" DOUBLE PRECISION,
    "blendReturnedKg" DOUBLE PRECISION,
    "powderWasteKg" DOUBLE PRECISION,
    "samplingKg" DOUBLE PRECISION,
    "capsuleSize" TEXT,
    "capsuleColour" TEXT,
    "capsuleLot" TEXT,
    "capsulesIssued" INTEGER,
    "capsulesUsed" INTEGER,
    "brokenCapsules" INTEGER,
    "machineRejects" INTEGER,
    "capsulesReturned" INTEGER,
    "targetFillWeightMg" DOUBLE PRECISION,
    "expectedCapsules" INTEGER,
    "goodCapsules" INTEGER,
    "rejectedCapsules" INTEGER,
    "sampleCapsules" INTEGER,
    "retentionCapsules" INTEGER,
    "encapsulatedByName" TEXT,
    "encapsulatedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgEncapsulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgBottling" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "capsulesReceived" INTEGER,
    "capsulesUsed" INTEGER,
    "capsulesRemaining" INTEGER,
    "bottlesIssued" INTEGER,
    "bottlesUsed" INTEGER,
    "damagedBottles" INTEGER,
    "bottlesReturned" INTEGER,
    "capsIssued" INTEGER,
    "capsUsed" INTEGER,
    "damagedCaps" INTEGER,
    "capsReturned" INTEGER,
    "desiccantsIssued" INTEGER,
    "desiccantsUsed" INTEGER,
    "damagedDesiccants" INTEGER,
    "desiccantsReturned" INTEGER,
    "bottleSize" TEXT,
    "targetCapsulesPerBottle" INTEGER,
    "expectedBottles" INTEGER,
    "filledBottles" INTEGER,
    "rejectedBottles" INTEGER,
    "qcSampleBottles" INTEGER,
    "retentionBottles" INTEGER,
    "bottledByName" TEXT,
    "bottledAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgBottling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgXrayInspection" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "bottlesReceived" INTEGER,
    "bottlesScanned" INTEGER,
    "passed" INTEGER,
    "failed" INTEGER,
    "reworked" INTEGER,
    "destroyed" INTEGER,
    "released" INTEGER,
    "rejectMetalDetection" INTEGER,
    "rejectXrayFailure" INTEGER,
    "rejectUnderweight" INTEGER,
    "rejectOverweight" INTEGER,
    "rejectDamagedBottle" INTEGER,
    "rejectMissingCap" INTEGER,
    "rejectMissingDesiccant" INTEGER,
    "inspectedByName" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgXrayInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgPackaging" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "packedBottles" INTEGER,
    "cartonsProduced" INTEGER,
    "casesProduced" INTEGER,
    "packedByName" TEXT,
    "packedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgPackagingMaterialLine" (
    "id" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "materialType" "MfgPackagingMaterialType" NOT NULL,
    "issued" DOUBLE PRECISION,
    "used" DOUBLE PRECISION,
    "damaged" DOUBLE PRECISION,
    "returned" DOUBLE PRECISION,
    "destroyed" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MfgPackagingMaterialLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgFinishedGoodsWarehouse" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "finishedGoodsReceived" INTEGER,
    "qaReleased" BOOLEAN NOT NULL DEFAULT false,
    "qaReleasedByName" TEXT,
    "qaReleasedAt" TIMESTAMP(3),
    "storageLocation" TEXT,
    "warehouseBalance" INTEGER,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfgFinishedGoodsWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfgDispatchEvent" (
    "id" TEXT NOT NULL,
    "mfgBatchId" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "salesOrder" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "casesDispatched" INTEGER,
    "bottlesDispatched" INTEGER,
    "dispatchDate" TIMESTAMP(3),
    "remainingStockAfter" INTEGER,
    "dispatchedByName" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfgDispatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfgBatch_batchNumber_idx" ON "MfgBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "MfgBatch_status_idx" ON "MfgBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MfgWarehouseIssue_mfgBatchId_key" ON "MfgWarehouseIssue"("mfgBatchId");

-- CreateIndex
CREATE INDEX "MfgMaterialIssueLine_warehouseIssueId_idx" ON "MfgMaterialIssueLine"("warehouseIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgBlending_mfgBatchId_key" ON "MfgBlending"("mfgBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgEncapsulation_mfgBatchId_key" ON "MfgEncapsulation"("mfgBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgBottling_mfgBatchId_key" ON "MfgBottling"("mfgBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgXrayInspection_mfgBatchId_key" ON "MfgXrayInspection"("mfgBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgPackaging_mfgBatchId_key" ON "MfgPackaging"("mfgBatchId");

-- CreateIndex
CREATE INDEX "MfgPackagingMaterialLine_packagingId_idx" ON "MfgPackagingMaterialLine"("packagingId");

-- CreateIndex
CREATE UNIQUE INDEX "MfgFinishedGoodsWarehouse_mfgBatchId_key" ON "MfgFinishedGoodsWarehouse"("mfgBatchId");

-- CreateIndex
CREATE INDEX "MfgDispatchEvent_mfgBatchId_idx" ON "MfgDispatchEvent"("mfgBatchId");

-- AddForeignKey
ALTER TABLE "MfgBatch" ADD CONSTRAINT "MfgBatch_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "BatchRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgWarehouseIssue" ADD CONSTRAINT "MfgWarehouseIssue_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgMaterialIssueLine" ADD CONSTRAINT "MfgMaterialIssueLine_warehouseIssueId_fkey" FOREIGN KEY ("warehouseIssueId") REFERENCES "MfgWarehouseIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgBlending" ADD CONSTRAINT "MfgBlending_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgEncapsulation" ADD CONSTRAINT "MfgEncapsulation_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgBottling" ADD CONSTRAINT "MfgBottling_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgXrayInspection" ADD CONSTRAINT "MfgXrayInspection_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgPackaging" ADD CONSTRAINT "MfgPackaging_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgPackagingMaterialLine" ADD CONSTRAINT "MfgPackagingMaterialLine_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "MfgPackaging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgFinishedGoodsWarehouse" ADD CONSTRAINT "MfgFinishedGoodsWarehouse_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfgDispatchEvent" ADD CONSTRAINT "MfgDispatchEvent_mfgBatchId_fkey" FOREIGN KEY ("mfgBatchId") REFERENCES "MfgBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
